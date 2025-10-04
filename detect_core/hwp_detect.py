# scan_hwp_detect.py
import os
import re
import json
import sys
import logging
import traceback
from typing import Optional, List, Dict
from pathlib import Path

# --- 공격 라벨 (영문/한글 동시 표기) ---
ATTACK_LABELS_EN = {
    "PE_MZ": "HWP: Embedded PE (MZ)",
    "EPS_PS": "HWP: EPS/PostScript",
    "DOUBLE_EXT": "HWP: Double-Extension Attachment",
    "RAW_IP": "HWP: Raw-IP Link",
}
ATTACK_LABELS_KO = {
    "PE_MZ": "HWP: BinData 내 실행파일(MZ) 삽입",
    "EPS_PS": "HWP: EPS/PS(PostScript) 포함",
    "DOUBLE_EXT": "HWP: 이중 확장자 첨부파일",
    "RAW_IP": "HWP: 원시 IP 기반 외부 링크",
}

def _label(key: str) -> str:
    eng = ATTACK_LABELS_EN.get(key, key)
    kor = ATTACK_LABELS_KO.get(key, key)
    return f"{eng} / {kor}"

def _attack_key_from_label(attack: str) -> Optional[str]:
    for k, en in ATTACK_LABELS_EN.items():
        if attack.startswith(en):
            return k
    for k, ko in ATTACK_LABELS_KO.items():
        if ko in attack:
            return k
    return None

# --- intent 하드코딩 ---
def _summarize_intent(attack: str, snippet: str) -> str:
    key = _attack_key_from_label(attack)
    if key == "PE_MZ":
        return f"{attack}는 문서 내부에 실행파일을 숨겨두는 것을 말합니다. 파일 실행 시 '{snippet}' 실행파일이 추출·실행될 수 있음이 의심됩니다."
    elif key == "EPS_PS":
        return f"{attack}는 그래픽 처리기 취약점을 노리는 기법을 말합니다. 파일 열람만으로도 '{snippet}' PostScript/EPS 코드가 실행되어 RCE가 유발될 수 있음이 의심됩니다."
    elif key == "DOUBLE_EXT":
        return f"{attack}는 사용자를 속여 실행을 유도하는 기법을 말합니다. '{snippet}' 형태의 이중 확장자 파일을 통해 악성 실행이 유도될 수 있음이 의심됩니다."
    elif key == "RAW_IP":
        return f"{attack}는 탐지 회피를 위해 원시 IP로 직접 연결하는 기법을 말합니다. '{snippet}' 링크를 통해 악성 서버와 통신할 의도가 의심됩니다."
    else:
        return f"{attack} 탐지 결과, '{snippet}'을(를) 통해 악성 행위를 수행할 의도가 의심됩니다."

# --- 헬퍼: 바이너리 읽기 ---
def _read_bytes(path: str) -> bytes:
    with open(path, "rb") as f:
        return f.read()

# --- 1) BinData 내 PE(MZ) 실행파일 삽입 검출(바이너리 시그니처 휴리스틱) ---
def hwp_pe_mz(file_path: str) -> Optional[Dict]:
    """
    간단 휴리스틱:
      - 'MZ' 서명 존재
      - 근처에 'PE\\x00\\x00' 또는 'This program cannot be run in DOS mode' 문자열 존재
    """
    try:
        data = _read_bytes(file_path)
        idx = 0
        hit_offsets: List[int] = []
        while True:
            off = data.find(b"MZ", idx)
            if off == -1:
                break
            # 합리성 체크
            window = data[off:off+4096]
            if (b"PE\x00\x00" in window) or (b"This program cannot be run in DOS mode" in window):
                hit_offsets.append(off)
            idx = off + 2

        if hit_offsets:
            attack = _label("PE_MZ")
            keyword = f"MZ at {hit_offsets[0]} (hits={len(hit_offsets)})"
            intent = _summarize_intent(attack, keyword)
            return {"attack": attack, "keyword": keyword, "intent": intent}
    except Exception:
        return None
    return None

# --- 2) EPS/PS(PostScript) 포함 (시그니처: %!PS, EPSF-) ---
def hwp_eps_ps(file_path: str) -> Optional[Dict]:
    try:
        data = _read_bytes(file_path)
        # 대표 시그니처
        markers = [b"%!PS", b"%!PS-Adobe", b"EPSF-"]
        for m in markers:
            off = data.find(m)
            if off != -1:
                attack = _label("EPS_PS")
                keyword = f"{m.decode(errors='ignore')} at {off}"
                intent = _summarize_intent(attack, keyword)
                return {"attack": attack, "keyword": keyword, "intent": intent}
    except Exception:
        return None
    return None

# --- 3) 이중 확장자 첨부파일 (…pdf.exe, …hwp.exe 등) ---
_DOUBLE_EXT_RX = re.compile(
    r"\b[\w\-]+\.(?:docx|xlsx|pptx|pdf|hwp|txt|jpg|png)\.exe\b",
    re.IGNORECASE
)

def hwp_double_ext(file_path: str) -> Optional[Dict]:
    try:
        data = _read_bytes(file_path)
        text = data.decode(errors="ignore")
        m = _DOUBLE_EXT_RX.search(text)
        if m:
            attack = _label("DOUBLE_EXT")
            keyword = m.group(0)
            intent = _summarize_intent(attack, keyword)
            return {"attack": attack, "keyword": keyword, "intent": intent}
    except Exception:
        return None
    return None

# --- 4) 원시 IP 기반 외부 링크 ---
_RAW_IP_RX = re.compile(
    r"(?:https?|ftp)://(?:\d{1,3}\.){3}\d{1,3}(?::\d{1,5})?(?:/[^\s\"'<>\)]*)?",
    re.IGNORECASE
)

def hwp_raw_ip(file_path: str) -> Optional[Dict]:
    try:
        data = _read_bytes(file_path)
        text = data.decode(errors="ignore")
        m = _RAW_IP_RX.search(text)
        if m:
            attack = _label("RAW_IP")
            keyword = m.group(0)
            intent = _summarize_intent(attack, keyword)
            return {"attack": attack, "keyword": keyword, "intent": intent}
    except Exception:
        return None
    return None

# 로거 설정: stderr로만 출력 (stdout의 JSON과 분리)
_logger = logging.getLogger("hwp_detect")
if not _logger.handlers:
	# 기존 basicConfig 대신 개별 핸들러 부착(다른 곳에서 root 로거를 설정했어도 항상 출력)
	log_level = logging.DEBUG if os.getenv("DETECT_LOG", "1") != "0" else logging.INFO
	handler = logging.StreamHandler(stream=sys.stderr)
	handler.setFormatter(logging.Formatter("[%(asctime)s][%(levelname)s][%(name)s] %(message)s"))
	handler.setLevel(log_level)
	_logger.addHandler(handler)
	_logger.setLevel(log_level)
	_logger.propagate = False

def _log_start():
	try:
		_logger.info("start %s args=%s cwd=%s py=%s", Path(__file__).name, sys.argv, os.getcwd(), sys.version.split()[0])
		if len(sys.argv) > 1 and os.path.exists(sys.argv[1]):
			_logger.info("input=%s size=%d bytes", sys.argv[1], os.path.getsize(sys.argv[1]))
	except Exception:
		_logger.debug("pre-log failed", exc_info=True)

# ---- 메인 스캐너 ----
def scan_hwp(file_path: str) -> List[Dict]:
    checks = [hwp_pe_mz, hwp_eps_ps, hwp_double_ext, hwp_raw_ip]
    findings: List[Dict] = []
    for fn in checks:
        try:
            _logger.debug("run %s", fn.__name__)
            res = fn(file_path)
            _logger.debug("%s -> %s", fn.__name__, "HIT" if res else "MISS")
            if res:
                findings.append(res)
        except Exception:
            _logger.exception("%s error", fn.__name__)
            continue
    _logger.info("scan done file=%s hits=%d", file_path, len(findings))
    try:
        sys.stderr.flush()
    except Exception:
        pass
    return findings

if __name__ == "__main__":
	_log_start()
	try:
		if len(sys.argv) < 2:
			print(f"Usage: python {Path(__file__).name} <file.hwp>")
			sys.exit(1)
		path = sys.argv[1]
		out = scan_hwp(path)
		_logger.info("emit json len=%d", len(out))
		print(json.dumps(out, ensure_ascii=False, indent=2))
		try:
			sys.stdout.flush()
		except Exception:
			pass
	except SystemExit:
		raise
	except Exception:
		_logger.error("unhandled error", exc_info=True)
		sys.exit(1)