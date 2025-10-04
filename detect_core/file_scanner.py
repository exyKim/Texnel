from __future__ import annotations

import base64
import json
import os
import sys
import subprocess
import tempfile
from pathlib import Path
from typing import Iterable, List, Dict, Tuple, Optional, Any

# 로깅(옵션)
import logging
LOGGER = logging.getLogger("file_scanner")
if not LOGGER.handlers:
    _level = logging.DEBUG if os.getenv("DETECT_VERBOSE", "0") == "1" else logging.INFO
    logging.basicConfig(level=_level, format="[%(asctime)s][%(levelname)s][%(name)s] %(message)s")

# 감지 스크립트 경로 (detect_core 내)
BASE_DIR = Path(__file__).resolve().parent
DETECTOR_SCRIPTS = {
    "hwp": BASE_DIR / "hwp_detect.py",
    "docx": BASE_DIR / "doc_detect.py",
}
SUPPORTED = {"hwp", "docx"}


def _which_detector(filename: str) -> Optional[str]:
    ext = filename.rsplit(".", 1)[-1].lower() if "." in filename else ""
    return ext if ext in SUPPORTED else None


def _run_detector(script: Path, file_path: Path, timeout: int = 120) -> Any:
    """
    지정된 스크립트를 서브프로세스로 실행하여 stdout(JSON)을 파싱해 반환.
    JSON 배열 또는 { detections|result|data: [] } 형태를 기대.
    """
    if not script.exists():
        raise FileNotFoundError(f"Detector not found: {script}")

    LOGGER.debug("spawn detector script=%s target=%s", script.name, file_path)
    cmd_list = [sys.executable, str(script), str(file_path)]
    proc = subprocess.run(
        cmd_list,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        check=False,
        text=True,
        encoding="utf-8",
        errors="replace",
        timeout=timeout,
    )

    LOGGER.debug("detector finished script=%s rc=%s", script.name, proc.returncode)
    if proc.stderr:
        LOGGER.info("detector[%s] stderr: %s", script.name, proc.stderr.strip()[:1000])

    if proc.returncode != 0:
        err_snip = (proc.stderr or proc.stdout or "").strip()[:500]
        raise RuntimeError(f"Detector failed ({script.name}): {err_snip}")

    stdout = (proc.stdout or "").strip()
    if not stdout:
        return []

    # JSON 시도
    try:
        data = json.loads(stdout)
        return data
    except json.JSONDecodeError:
        # 라인 텍스트 fallback
        lines = [ln.strip() for ln in stdout.splitlines() if ln.strip()]
        return [{"keyword": ln} for ln in lines]


def _normalize_detections(payload: Any) -> List[Dict[str, Any]]:
    """
    업스트림 출력(payload)을 표준 포맷으로 정규화:
    [{ id, type, keyword, summary }]
    """
    if isinstance(payload, list):
        source = payload
    elif isinstance(payload, dict):
        source = payload.get("detections") or payload.get("result") or payload.get("data") or []
        if not isinstance(source, list):
            source = []
    else:
        source = []

    out: List[Dict[str, Any]] = []
    for idx, item in enumerate(source, start=1):
        if not isinstance(item, dict):
            item = {"keyword": str(item)}
        out.append({
            "id": item.get("id", idx),
            "type": item.get("type") or item.get("category") or item.get("attack") or "unknown",
            "keyword": item.get("keyword") or item.get("key") or item.get("match") or "",
            "summary": item.get("summary") or item.get("message") or item.get("desc") or item.get("intent") or "",
        })
    return out


def scan_file(file_bytes: bytes, filename: str) -> Dict[str, Any]:
    """
    단일 파일 스캔. 반환 형식:
    {
      "filename": "...",
      "detections": [ {id,type,keyword,summary}, ... ],
      "has_detection": bool
    }
    """
    LOGGER.info("scan start filename=%s", filename)
    kind = _which_detector(filename)
    if not kind:
        LOGGER.warning("unsupported extension filename=%s", filename)
        return {"filename": filename, "detections": [], "has_detection": False, "error": "unsupported_extension"}

    script = DETECTOR_SCRIPTS[kind]

    # 임시 파일 저장 후 스캐너에 경로 전달 (디텍터는 경로 기반이므로 여기서만 파일 생성)
    suffix = f".{kind}"
    with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tf:
        tf.write(file_bytes)
        tmp_path = Path(tf.name)

    try:
        raw = _run_detector(script, tmp_path)
        dets = _normalize_detections(raw)
        LOGGER.info("scan done filename=%s kind=%s detections=%d", filename, kind, len(dets))
        return {
            "filename": filename,
            "detections": dets,
            "has_detection": len(dets) > 0,
        }
    except Exception as e:
        LOGGER.exception("scan failed filename=%s", filename)
        return {
            "filename": filename,
            "detections": [],
            "has_detection": False,
            "error": str(e),
        }
    finally:
        try:
            os.remove(tmp_path)
            LOGGER.debug("temp removed %s", tmp_path)
        except Exception:
            LOGGER.debug("temp remove failed %s", tmp_path, exc_info=True)


def scan_files(files: Iterable[Tuple[str, bytes]]) -> List[Dict[str, Any]]:
    """
    여러 파일 스캔. 입력: [(filename, bytes), ...]
    반환: 각 파일에 대한 scan_file(...) 결과 리스트
    """
    results: List[Dict[str, Any]] = []
    for name, data in files:
        results.append(scan_file(data, name))
    return results


def to_front_single(result: Dict[str, Any]) -> List[Dict[str, Any]]:
    """ 프론트 normalizeDetections와 호환되게 배열만 반환 """
    return result.get("detections", [])


def to_front_multi(results: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """ 파일명 기준 매칭용 리스트 """
    out = []
    for r in results:
        out.append({
            "name": r.get("filename"),
            "detections": r.get("detections", []),
            "has_detection": bool(r.get("has_detection")),
        })
    return out


# stdout을 UTF-8로 강제
try:
    import io  # noqa
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    else:
        sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")
except Exception:
    pass


def _read_all_stdin_bytes() -> bytes:
    return sys.stdin.buffer.read()


def _read_stdin_json() -> Any:
    data = sys.stdin.read()
    if not data.strip():
        return None
    return json.loads(data)


def _decode_files_from_json(obj: Any) -> List[Tuple[str, bytes]]:
    """
    JSON 스키마:
    - {"files":[{"name":"a.hwp","bytes_b64":"..."} , ... ]}
    - 혹은 바로 [{"name":"...","bytes_b64":"..."}]
    """
    if obj is None:
        return []

    if isinstance(obj, dict) and "files" in obj:
        arr = obj.get("files", [])
    elif isinstance(obj, list):
        arr = obj
    else:
        raise ValueError("invalid stdin JSON: expected {files:[...] } or [ ... ]")

    out: List[Tuple[str, bytes]] = []
    for it in arr:
        if not isinstance(it, dict):
            continue
        name = it.get("name") or it.get("filename")
        b64 = it.get("bytes_b64") or it.get("b64") or it.get("data_b64")
        if not name or not b64:
            continue
        out.append((name, base64.b64decode(b64)))
    return out


if __name__ == "__main__":
    args = [s for s in sys.argv[1:] if s]

    # 모드 1: --stdin-json
    if args and args[0] == "--stdin-json":
        try:
            obj = _read_stdin_json()
            files = _decode_files_from_json(obj)
            if not files:
                print("[]")
                sys.exit(0)

            if len(files) == 1:
                name, data = files[0]
                res = scan_file(data, name)
                print(json.dumps(res, ensure_ascii=False))
            else:
                res = scan_files(files)
                print(json.dumps(res, ensure_ascii=False))
            sys.exit(0)
        except Exception as e:
            LOGGER.exception("stdin-json mode failed")
            print(json.dumps({"error": str(e)}, ensure_ascii=False))
            sys.exit(1)

    # 모드 2: --stdin-bytes <name>
    if args and args[0] == "--stdin-bytes":
        if len(args) < 2:
            print(json.dumps({"error": "missing filename for --stdin-bytes"}, ensure_ascii=False))
            sys.exit(2)
        name = args[1]
        try:
            data = _read_all_stdin_bytes()
            res = scan_file(data, name)
            print(json.dumps(res, ensure_ascii=False))
            sys.exit(0)
        except Exception as e:
            LOGGER.exception("stdin-bytes mode failed")
            print(json.dumps({"error": str(e)}, ensure_ascii=False))
            sys.exit(1)

    # 모드 3: 기존 경로 인자
    raw_args = args
    if not raw_args:
        print("[]")
        sys.exit(0)

    def read_bytes(p: Path) -> bytes:
        with open(p, "rb") as f:
            return f.read()

    # 인자 파싱: "path::orig" 지원
    pairs: List[Tuple[str, Path]] = []  # (orig_name, path)
    for s in raw_args:
        if "::" in s:
            ps, orig = s.split("::", 1)
            pairs.append((orig, Path(ps)))
        else:
            pp = Path(s)
            pairs.append((pp.name, pp))

    try:
        if len(pairs) == 1:
            orig, p = pairs[0]
            res = scan_file(read_bytes(p), orig)
            print(json.dumps(res, ensure_ascii=False))
        else:
            files = [(orig, read_bytes(p)) for (orig, p) in pairs]
            res = scan_files(files)
            print(json.dumps(res, ensure_ascii=False))
    except Exception as e:
        LOGGER.exception("path mode failed")
        print(json.dumps({"error": str(e)}, ensure_ascii=False))
        sys.exit(1)
