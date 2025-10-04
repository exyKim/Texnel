#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
ai_sanitize.py
- UI의 det.keyword("KEYWORD : ... at 13367") 형식을 받아 위험 키워드 구간을 치환
- 기본: LLM 치환 시도 → 실패 시 fill(0x00)로 채움
- 옵션: --mask "***" 를 주면 LLM을 사용하지 않고 길이만큼 패턴 반복으로 치환
- 입력 경로가 주어지고, 패치 결과는 {src}.sanitized 로 저장하며 .report.txt를 남김
"""

from pathlib import Path
from dataclasses import dataclass
from typing import List, Optional, Iterable
import json, re, sys

# === 마스킹 유틸 ============================================================

def make_mask(L: int, pattern: str = "***") -> bytes:
    """길이 L만큼 pattern을 반복/자르기해서 bytes로 반환."""
    if not pattern:
        pattern = "*"
    byt = pattern.encode("latin1", "ignore")
    if not byt:
        byt = b"*"
    return (byt * ((L // len(byt)) + 1))[:L]


# ---------------- A) LLM 로더 (4bit 실패하면 자동 폴백) ----------------------
USE_AI = True
gen = None
if USE_AI:
    try:
        from transformers import AutoTokenizer, AutoModelForCausalLM, pipeline
        MODEL = "TinyLlama/TinyLlama-1.1B-Chat-v1.0"
        tok = AutoTokenizer.from_pretrained(MODEL)
        try:
            mdl = AutoModelForCausalLM.from_pretrained(MODEL, device_map="auto", load_in_4bit=True)
        except Exception:
            mdl = AutoModelForCausalLM.from_pretrained(MODEL, device_map="auto")
        gen = pipeline("text-generation", model=mdl, tokenizer=tok)
    except Exception as e:
        print("[warn] LLM init failed -> fallback to rule-only:", e, file=sys.stderr)
        gen = None

# ---------------- B) 입력 스펙 ----------------------------------------------

@dataclass
class Patch:
    offset: int       # 바이트 오프셋
    keyword: str      # 해당 위치에서 덮어쓸 원문 키워드(길이 산정에 사용)
    label: str = ""   # 사람이 보기 좋은 라벨(옵션)

# UI에서 오는 "KEYWORD : ... at 13367" → Patch
def parse_det_keyword(s: str) -> Optional[Patch]:
    # "KEYWORD : %!PS at 13367 (hits=1)" 형태 대응
    m = re.search(r"KEYWORD\s*:\s*(.+?)\s+at\s+(\d+)", s, re.I)
    if not m:
        return None
    kw = m.group(1)
    off = int(m.group(2))
    return Patch(off, kw)

def patches_from_ui(dets: Iterable[dict]) -> List[Patch]:
    out: List[Patch] = []
    for d in dets:
        # 우선 priority: 명시 offset/keyword가 있으면 그대로
        if "offset" in d and "keyword" in d and isinstance(d["offset"], int):
            out.append(Patch(int(d["offset"]), str(d["keyword"]), d.get("label","")))
            continue
        # det.keyword 문자열 파싱
        p = parse_det_keyword(str(d.get("keyword","")))
        if p:
            p.label = d.get("label","")
            out.append(p)
    return out

# ---------------- C) LLM 헬퍼 -----------------------------------------------

SYSTEM = (
"너는 문서 보안 클린업 도우미다. "
"1) 주어진 키워드의 위험 의도를 한 줄로 한국어 요약하고, "
"2) 같은 길이의 무해한 ASCII 치환 문자열을 제안하라. "
"3) 결과는 JSON 한 줄로만: {\"summary\": \"...\", \"replacement\": \"...\"}"
)

def ask_llm(keyword: str, target_len: int) -> Optional[dict]:
    if gen is None:
        return None
    prompt = (
        f"{SYSTEM}\n"
        f"키워드: {keyword}\n"
        f"치환길이: {target_len} (정확히 이 길이로 맞춰)\n"
        f"- 치환은 영문/숫자/기호만 사용\n"
        f"- 실행 의미, URL 의미 제거\n"
        f"- 길이 모자라면 '_'로 패딩\n"
    )
    out = gen(prompt, max_new_tokens=180, temperature=0.0, do_sample=False)[0]["generated_text"]
    m = re.search(r"\{.*\}", out, re.S)
    if not m:
        return None
    try:
        return json.loads(m.group(0))
    except Exception:
        return None

def normalize_len(s: str, L: int) -> str:
    """라틴1 기반 길이 정확히 L로 맞추기(부족하면 '_' 패딩, 넘치면 절단)."""
    b = s.encode("latin1", "ignore")
    if len(b) >= L:
        return b[:L].decode("latin1", "ignore")
    return (b + b"_" * (L - len(b))).decode("latin1", "ignore")

# ---------------- D) 패치 적용 ----------------------------------------------

def sanitize_file(
    src_path: str,
    patches: List[Patch],
    fill: int = 0x00,
    make_report: bool = True,
    mask_pattern: Optional[str] = None,
):
    """
    원본 파일(src_path)을 읽어 patches에 명시된 offset~offset+len(keyword) 구간을 치환한다.

    치환 우선순위:
      1) mask_pattern이 지정되면, 해당 패턴을 keyword 길이에 맞춰 반복/패딩해 덮어씀 (AI 미사용)
      2) mask_pattern이 없고 LLM 가용 시 ask_llm() 결과 사용
      3) 그 외에는 fill(기본 0x00) 바이트로 채움

    Parameters
    ----------
    src_path : str
        입력 파일 경로
    patches : List[Patch]
        각 패치 항목 (offset: int, keyword: str, label: str="")
    fill : int
        AI/마스크 미사용 시 바이트 채우기 값 (기본 0x00)
    make_report : bool
        .report.txt 생성 여부
    mask_pattern : Optional[str]
        예: "***" 또는 "####" 등. 지정 시 AI 무시하고 패턴으로 치환.

    Returns
    -------
    (out_path: str, report: list)
        out_path는 '{src_path}.sanitized'
        report는 각 패치 처리 결과 딕셔너리 목록
    """
    data = bytearray(Path(src_path).read_bytes())
    report = []
    n = len(data)

    for p in patches:
        # keyword의 바이트 길이에 맞춰 동일 길이로 치환
        L = len(p.keyword.encode("latin1"))
        off = int(p.offset)
        if off < 0 or off + L > n:
            report.append({
                "label": p.label,
                "offset": off,
                "status": "skip-out-of-range"
            })
            continue

        used_ai = False
        rep: bytes

        if mask_pattern:
            # 1) 마스킹 패턴 우선
            rep = make_mask(L, mask_pattern)
            llm = None
        else:
            # 2) LLM 치환 시도
            llm = ask_llm(p.keyword, L)
            if llm and "replacement" in llm:
                rep = normalize_len(llm["replacement"], L).encode("latin1")
                used_ai = True
            else:
                # 3) 폴백: fill 바이트로 채우기
                rep = bytes([fill]) * L

        data[off:off + L] = rep

        item = {
            "label": p.label,
            "offset": off,
            "length": L,
            "status": "patched",
            "ai_used": used_ai,
        }
        # LLM 사용했고 요약이 있으면 붙이기
        if used_ai and (llm and "summary" in llm):
            item["ai_summary"] = llm["summary"]
        report.append(item)

    out_path = f"{src_path}.sanitized"
    Path(out_path).write_bytes(data)

    if make_report:
        lines = [f"Sanitized: {src_path} -> {out_path}"]
        for r in report:
            line = f"- [{r.get('label','')}] at {r['offset']} len={r.get('length','?')} "
            line += "AI" if r.get("ai_used") else "NIL"
            if r.get("ai_summary"):
                line += f" :: {r['ai_summary']}"
            lines.append(line)
        Path(out_path + ".report.txt").write_text("\n".join(lines), encoding="utf-8")

    return out_path, report

# ---------------- E) CLI 엔트리 (Electron/수동 둘 다) ------------------------
# 사용법:
# 1) dets.json을 넘기는 방식:
#    python ai_sanitize.py --in for_test.hwp --dets dets.json
#    (dets.json 예: [{"keyword":"KEYWORD : %!PS at 13367"}, {"keyword":"KEYWORD : MZ at 13312"}])
# 2) patches.json(오프셋/키워드 확실) 직접:
#    python ai_sanitize.py --in for_test.hwp --patches patches.json
# 3) STDIN으로 det 배열을 넘김(IPC에서 편함):
#    echo '[{"keyword":"KEYWORD : MZ at 13312"}]' | python ai_sanitize.py --in for_test.hwp --stdin
if __name__ == "__main__":
    import argparse
    ap = argparse.ArgumentParser()
    ap.add_argument("--in", dest="infile", required=True, help="원본 파일 경로")
    ap.add_argument("--out", dest="outfile", default=None, help="저장 파일 경로(옵션)")
    ap.add_argument("--dets", dest="dets_json", help="UI detections JSON 파일( det.keyword 형식 )")
    ap.add_argument("--patches", dest="patches_json", help="patches JSON 파일( offset/keyword 명시 )")
    ap.add_argument("--stdin", action="store_true", help="STDIN에서 det 배열(JSON) 수신")
    ap.add_argument("--no-ai", action="store_true", help="AI 비활성화(강제 0x00 또는 --mask 우선)")
    ap.add_argument("--mask", dest="mask", default=None, help="치환 패턴(예: ***, ####). 지정 시 길이만큼 반복/패딩")
    args = ap.parse_args()

    if args.no_ai:
        gen = None  # LLM 무효화

    # patches 준비
    det_list = []
    if args.dets_json:
        det_list = json.loads(Path(args.dets_json).read_text(encoding="utf-8"))
        patches = patches_from_ui(det_list)
    elif args.patches_json:
        raw = json.loads(Path(args.patches_json).read_text(encoding="utf-8"))
        patches = [Patch(int(r["offset"]), str(r["keyword"]), r.get("label","")) for r in raw]
    elif args.stdin:
        s = sys.stdin.read()
        det_list = json.loads(s)
        patches = patches_from_ui(det_list)
    else:
        # 데모: 하드코딩 예시
        patches = [
            Patch(13312, "MZ", "HWP: Embedded PE"),
            Patch(13367, "%!PS", "HWP: EPS/PS"),
        ]

    # 실제 치환
    out_path, report = sanitize_file(
        args.infile,
        patches,
        fill=0x00,
        make_report=True,
        mask_pattern=args.mask,   # ★ 마스킹 패턴 전달(있으면 AI 무시)
    )

    # --out 이 지정되면 복사
    if args.outfile:
        Path(args.outfile).write_bytes(Path(out_path).read_bytes())
        out_path = args.outfile

    # IPC에서 파싱하기 좋은 JSON 한 줄 출력
    print(json.dumps({"outPath": out_path, "patched": len(report), "report": report}, ensure_ascii=False))
