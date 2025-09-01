import os
import zipfile
import xml.etree.ElementTree as ET
import re
import json
import sys
from typing import Optional

# --- OpenAI ---
from openai import OpenAI
client = OpenAI() # OPENAI_API_KEY
MODEL = os.getenv("OPENAI_MODEL", "gpt-4o-mini")

# 공격 라벨 (영문/한글 동시 표기)
ATTACK_LABELS_EN = {
    "VBA": "DOCX: VBA Macro",
    "TEMPLATE": "DOCX: External Template",
    "DDE": "DOCX: DDE/DDEAUTO",
    "CMD": "DOCX: Suspicious Command",
}
ATTACK_LABELS_KO = {
    "VBA": "DOCX: 매크로 삽입",
    "TEMPLATE": "DOCX: 외부 템플릿 참조",
    "DDE": "DOCX: DDE/DDEAUTO 실행",
    "CMD": "DOCX: 의심 명령 실행",
}

def _label(key: str) -> str:
    eng = ATTACK_LABELS_EN.get(key, key)
    kor = ATTACK_LABELS_KO.get(key, key)
    return f"{eng} / {kor}"

def _attack_key_from_label(attack: str) -> Optional[str]:
    """attack 라벨(영/한 혼합 문자열)에서 키(VBA/TEMPLATE/DDE/CMD) 역추출"""
    for k, en in ATTACK_LABELS_EN.items():
        if attack.startswith(en):
            return k
    for k, ko in ATTACK_LABELS_KO.items():
        if ko in attack:
            return k
    return None

def _summarize_intent(attack: str, snippet: str) -> str:
    # try:
    #     prompt = f"공격 라벨: {attack}\n관련 코드/스니펫: {snippet}\n" \
    #              f"docx 파일이야. 위 탐지 결과를 기반으로 공격 의도를 한 줄로 한국어로 요약해줘."
        
    #     resp = client.chat.completions.create(
    #         model=MODEL,
    #         messages=[{"role": "user", "content": prompt}],
    #         max_tokens=50,
    #         temperature=0
    #     )
    #     return resp.choices[0].message.content.strip()
    # except Exception as e:
    #     return f"[{attack}] 요약 실패: {e}"
    key = _attack_key_from_label(attack)

    if key == "VBA":
        return f"해당 파일 실행 시 '{snippet}' 매크로가 자동 실행될 수 있음이 의심됩니다."
    elif key == "TEMPLATE":
        return f"해당 파일 실행 시 '{snippet}' 경로를 통해 외부 서버와 연결될 의도가 의심됩니다."
    elif key == "DDE":
        return f"해당 파일 실행 시 문서 내 '{snippet}' 구문을 통해 시스템 명령이 실행될 수 있음이 의심됩니다."
    elif key == "CMD":
        return f"해당 파일 실행 시 '{snippet}' 명령어를 이용해 추가 악성 행위를 수행하려는 의도가 의심됩니다."
    else:
        return f"{attack} 탐지 결과, '{snippet}'을(를) 통해 악성 행위를 수행할 의도가 의심됩니다."



def _read_xml(z: zipfile.ZipFile, path: str) -> ET.Element:
    with z.open(path) as f:
        return ET.fromstring(f.read())

# ---- 1) VBA: vbaProject.bin 존재하면 바로 악성 ----
def doc_vba(file_path: str):
    try:
        with zipfile.ZipFile(file_path) as z:
            try:
                z.getinfo("word/vbaProject.bin")  # 존재만 확인
            except KeyError:
                return None
            attack = _label("VBA")
            keyword = "word/vbaProject.bin"
            intent  = _summarize_intent(attack, keyword)
            return {"attack": attack, "keyword": keyword, "intent": intent}
    except Exception:
        return None

# ---- 2) External Template: attachedTemplate + 외부 Target이면 바로 악성 ----
def doc_template(file_path: str):
    REL_TAG = ".//{*}Relationship"
    ATTACHED_TEMPLATE_TYPE = "http://schemas.openxmlformats.org/officeDocument/2006/relationships/attachedTemplate"
    REL_PATHS = [
        "word/_rels/settings.xml.rels",
        "word/_rels/document.xml.rels",
    ]
    try:
        with zipfile.ZipFile(file_path) as z:
            for rel_path in REL_PATHS:
                try:
                    with z.open(rel_path) as f:
                        root = ET.fromstring(f.read())
                except KeyError:
                    continue
                for rel in root.findall(REL_TAG):
                    if rel.get("Type", "") != ATTACHED_TEMPLATE_TYPE:
                        continue
                    target = (rel.get("Target", "") or "").strip()
                    mode   = (rel.get("TargetMode", "") or "").strip()
                    if mode.lower() == "external" or target.startswith(("http://","https://","file://","\\\\","//")):
                        attack = _label("TEMPLATE")
                        keyword = target or "external-template"
                        intent  = _summarize_intent(attack, f"{target} mode={mode or 'N/A'}")
                        return {"attack": attack, "keyword": keyword, "intent": intent}
    except Exception:
        return None
    return None

# ---- 3) DDE/DDEAUTO: 토큰 보이면 바로 악성 ----
_RX_DDE = re.compile(r"\bDDE(?:AUTO)?\b", re.I)
def doc_dde(file_path: str):
    try:
        with zipfile.ZipFile(file_path) as z:
            for part in [
                "word/document.xml","word/comments.xml","word/footnotes.xml","word/endnotes.xml",
                "word/header1.xml","word/header2.xml","word/header3.xml",
                "word/footer1.xml","word/footer2.xml","word/footer3.xml",
            ]:
                try:
                    root = _read_xml(z, part)
                except KeyError:
                    continue
                # fldSimple @instr
                for fld in root.findall(".//{*}fldSimple"):
                    for v in (fld.attrib or {}).values():
                        if isinstance(v, str):
                            m = _RX_DDE.search(v)
                            if m:
                                attack  = _label("DDE")
                                keyword = m.group(0).upper()
                                intent  = _summarize_intent(attack, v[:220])
                                return {"attack": attack, "keyword": keyword, "intent": intent}
                # instrText 조각
                buf = "".join((n.text or "") for n in root.findall(".//{*}instrText"))
                m = _RX_DDE.search(buf)
                if m:
                    attack  = _label("DDE")
                    keyword = m.group(0).upper()
                    intent  = _summarize_intent(attack, buf[:220])
                    return {"attack": attack, "keyword": keyword, "intent": intent}
    except Exception:
        return None
    return None

# ---- 4) 의심 명령 키워드: 핵심 토큰 하나라도 보이면 바로 악성 ----
_SUSPICIOUS = [
    r"\bpowershell(?:\.exe)?\b", r"\bcmd(?:\.exe)?\s*/c\b",
    r"\brundll32(?:\.exe)?\b", r"\bregsvr32(?:\.exe)?\b",
    r"\bwscript(?:\.exe)?\b",  r"\bcscript(?:\.exe)?\b",
    r"\bmshta(?:\.exe)?\b",    r"\bbitsadmin(?:\.exe)?\b",
    r"\bcertutil(?:\.exe)?\b",
]
_SUSPICIOUS_RX = [re.compile(p, re.I) for p in _SUSPICIOUS]

def doc_cmd(file_path: str):
    try:
        with zipfile.ZipFile(file_path) as z:
            for part in [
                "word/document.xml","word/comments.xml","word/footnotes.xml","word/endnotes.xml",
                "word/header1.xml","word/header2.xml","word/header3.xml",
                "word/footer1.xml","word/footer2.xml","word/footer3.xml",
            ]:
                try:
                    root = _read_xml(z, part)
                except KeyError:
                    continue
                # 전체 텍스트 플랫하게 긁어서 토큰 매칭
                texts = []
                for node in root.iter():
                    if node.text: texts.append(node.text)
                    if node.tail: texts.append(node.tail)
                whole = " ".join(texts)
                for rx in _SUSPICIOUS_RX:
                    m = rx.search(whole)
                    if m:
                        attack  = _label("CMD")
                        keyword = m.group(0)
                        intent  = _summarize_intent(attack, keyword)
                        return {"attack": attack, "keyword": keyword, "intent": intent}
    except Exception:
        return None
    return None

# ---- 메인: 파일 경로 하나 넣고 빠르게 테스트 ----
def scan_docx(file_path: str):
    checks = [doc_vba, doc_template, doc_dde, doc_cmd]
    findings = []
    for fn in checks:
        try:
            res = fn(file_path)
            if res:
                findings.append(res)
        except Exception:
            # 개별 탐지 실패는 전체 실패로 보지 않음
            continue
    return findings

if __name__ == "__main__":
    if len(sys.argv) != 2:
        print("Usage: python scan_docx_detect.py <file.docx>")
        sys.exit(1)
    path = sys.argv[1]
    out = scan_docx(path)
    print(json.dumps(out, ensure_ascii=False, indent=2))
