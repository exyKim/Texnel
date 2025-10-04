import React, { useRef, useState, useCallback, useEffect } from 'react';
import Box from '../component/Box.jsx';
import Button from '../component/Button.jsx';
import uploadSvg from '../images/upload.svg';
import '../styles/Upload.css';

// Add: backend endpoints and helpers
const API_ENDPOINTS = {
  hwp: '/api/hwp_detect',
  docx: '/api/doc_detect',
};
// Add: file_scanner 후보 엔드포인트들(순차 시도)
const SCAN_CANDIDATES = ['/api/scan', '/api/scan_file', '/api/file_scan'];

// Add: IPC invoker 헬퍼
const getIpcInvoke = () =>
  (window?.electron && window.electron.invoke)
  || (window?.ipcRenderer && window.ipcRenderer.invoke)
  || null;

const normalizeDetections = (payload) => {
  // Expect array or {detections|result|data: []}
  let arr = Array.isArray(payload) ? payload : (payload?.detections ?? payload?.result ?? payload?.data ?? []);
  if (!Array.isArray(arr)) arr = [];
  return arr.map((item, idx) => ({
    id: item.id ?? idx + 1,
    // attack -> type 매핑 추가
    type: item.type ?? item.category ?? item.attack ?? 'unknown',
    keyword: item.keyword ?? item.key ?? item.match ?? '',
    // intent -> summary 매핑 추가
    summary: item.summary ?? item.message ?? item.desc ?? item.intent ?? '',
  }));
};

// Add: 스캐너 응답에서 파일명으로 해당 항목만 골라서 정규화
const pickDetectionsFromScanner = (json, filename) => {
  if (Array.isArray(json)) {
    // 다중 파일 응답: [{name|filename, detections:[...]}]
    if (json.length && typeof json[0] === 'object' && ('detections' in json[0])) {
      const match = json.find(x => (x?.name === filename) || (x?.filename === filename));
      if (match) return normalizeDetections(match);
      return []; // 매칭 실패 시 빈 결과
    }
    // 단일 파일 응답이 바로 배열
    return normalizeDetections(json);
  }
  if (json && typeof json === 'object' && Array.isArray(json.detections)) {
    return normalizeDetections(json);
  }
  return [];
};

// Add: file_scanner 우선 시도
const detectViaScanner = async (file) => {
  // A) Electron IPC 우선 (서버 없이 로컬 스캐너 실행)
  const invoke = getIpcInvoke();
  if (invoke) {
    try {
      console.debug('[detect][ipc] scan-file', file.name);
      const bytes = await file.arrayBuffer();
      const objOrArr = await invoke('scan-file', { name: file.name, bytes });
      const dets = pickDetectionsFromScanner(objOrArr, file.name);
      console.debug('[detect][ipc] OK', file.name, dets);
      return dets;
    } catch (e) {
      console.warn('[detect][ipc] fail', e);
      // 아래 REST 후보로 폴백
    }
  }

  // B) (선택) 개발 중에만 REST 후보 시도
  const form = new FormData();
  form.append('file', file, file.name);
  form.append('filename', file.name);
  form.append('ext', file.name.split('.').pop().toLowerCase());

  for (const ep of SCAN_CANDIDATES) {
    try {
      console.debug('[detect][scan] POST', ep, file.name);
      const res = await fetch(ep, { method: 'POST', body: form });
      const text = await res.text();
      if (!res.ok) {
        console.warn(`[detect][scan] ${ep} HTTP ${res.status} ${res.statusText}`);
        continue;
      }
      const json = text ? JSON.parse(text) : [];
      const dets = pickDetectionsFromScanner(json, file.name);
      console.debug('[detect][scan] OK', file.name, dets);
      return dets;
    } catch (e) {
      console.warn('[detect][scan] fail', e);
    }
  }
  return null;
};

// Add: IPC로 여러 파일 한번에 스캔
const detectFilesViaIPC = async (files) => {
  const invoke = getIpcInvoke();
  if (!invoke) return null; // IPC 미지원 시 폴백
  // 파일 바이트 수집
  const items = await Promise.all(
    files.map(async (f) => ({ name: f.name, bytes: await f.arrayBuffer() }))
  );
  console.debug('[ipc] scan-files', items.map(i => i.name));
  const resp = await invoke('scan-files', items); // main.js IPC 핸들러 사용

  // resp: (1) [{ filename|name, detections: [...] }, ...]
  //       (2) { filename, detections: [...] }  // 단일 파일도 올 수 있음
  if (Array.isArray(resp)) {
    return resp.map(r => ({
      name: r.filename || r.name,
      detections: normalizeDetections(r), // object에 {detections:[...]} 지원
    }));
  }
  if (resp && typeof resp === 'object') {
    return [{
      name: resp.filename || resp.name || files[0]?.name,
      detections: normalizeDetections(resp),
    }];
  }
  return null;
};

const detectFile = async (file) => {
  // 1) file_scanner 경로 우선 시도
  const scanned = await detectViaScanner(file);
  if (scanned) return scanned;
  // 2) 확장자별 개별 엔드포인트 폴백
  const ext = file.name.split('.').pop().toLowerCase();
  const ep = ext === 'hwp' ? API_ENDPOINTS.hwp : API_ENDPOINTS.docx;
  const form = new FormData();
  form.append('file', file, file.name);

  console.debug('[detect] POST', ep, file.name);
  const res = await fetch(ep, { method: 'POST', body: form });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`HTTP ${res.status} ${res.statusText} - ${text?.slice(0, 300)}`);
  }
  let json;
  try {
    json = text ? JSON.parse(text) : [];
  } catch (e) {
    throw new Error(`Invalid JSON response from ${ep}: ${text?.slice(0, 300)}`);
  }
  const normalized = normalizeDetections(json);
  console.debug('[detect] OK', file.name, normalized);
  return normalized;
};

// 날짜 포맷터 (YYYY.MM.DD)
const fmtDate = (d = new Date()) => {
  const z = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}.${z(d.getMonth() + 1)}.${z(d.getDate())}`;
};

// 간단한 DOCX 아이콘
const DocxIcon = () => (
  <svg width="26" height="26" viewBox="0 0 24 24" aria-hidden>
    <path d="M14 2H6a2 2 0 0 0-2 2v16c0 1.1.9 2 2 2h12a2 2 0 0 0 2-2V8l-6-6z" fill="#3B82F6"/>
    <path d="M14 2v6h6" fill="#93C5FD"/>
    <rect x="6.5" y="11" width="11" height="1.6" rx="0.8" fill="#E5F0FF"/>
    <rect x="6.5" y="14" width="11" height="1.6" rx="0.8" fill="#E5F0FF"/>
  </svg>
);

export default function UploadAndDetect() {
  const inputRef = useRef(null);

  const [isDragging, setDragging] = useState(false);
  const [phase, setPhase] = useState('idle');  // idle | scanning | done | details
  const [progress, setProgress] = useState(0);
  const [rows, setRows] = useState([]);        // { name, date, detections?: [] }
  const [activeFile, setActiveFile] = useState(null);
  const [resultsReady, setResultsReady] = useState(false); // Add: gate 'done' until API finished

  useEffect(() => {
    if (phase !== 'details') return;
    if (activeFile) return;
    // Update: pick first file with detections; fallback to first
    const detected = rows.filter(r => (r.detections?.length ?? 0) > 0);
    const first = detected[0] || rows[0];
    setActiveFile(first ? first.name : null);
  }, [phase, rows, activeFile]);

  // IPC ping 확인
  useEffect(() => {
    (async () => {
      try {
        const inv = getIpcInvoke();
        if (!inv) return;
        const pong = await inv('ping');
        console.log('[renderer] ping ->', pong); // 'pong' 이면 OK
      } catch (e) {
        console.error('ping fail', e);
      }
    })();
  }, []);


  const acceptTypes =
    '.hwp,.docx,application/vnd.hancom.hwp,application/vnd.openxmlformats-officedocument.wordprocessingml.document';

  const openPicker = () => inputRef.current?.click();

  // 업로드 처리 -> call backend, collect detections
  const handleFiles = useCallback(async (fileList) => {
    const arr = Array.from(fileList || []);
    const filtered = arr.filter((f) => /\.(hwp|docx)$/i.test(f.name));
    if (!filtered.length) return;

    const today = fmtDate();
    setRows(filtered.map((f) => ({ name: f.name, date: today })));
    setProgress(0);
    setResultsReady(false);
    setPhase('scanning');

    // 1) IPC 우선 시도
    try {
      const ipcResults = await detectFilesViaIPC(filtered);
      if (ipcResults) {
        const merged = filtered.map(f => {
          const hit = ipcResults.find(r => r.name === f.name);
          return { name: f.name, date: today, detections: hit?.detections || [] };
        });
        console.debug('[ipc] merged rows', merged.map(m => ({ name: m.name, cnt: m.detections.length })));
        setRows(merged);
        setResultsReady(true);
        return;
      }
    } catch (e) {
      console.error('[ipc] scan-files fail', e);
      // 계속 HTTP 폴백 시도
    }

    // 2) HTTP 폴백(확장자별 엔드포인트)
    const promises = filtered.map(async (file) => {
      try {
        const detections = await detectFile(file);
        return { name: file.name, date: today, detections };
      } catch (e) {
        console.error('[detect] FAIL', file.name, e);
        return { name: file.name, date: today, detections: [], error: String(e?.message || e) };
      }
    });

    const results = await Promise.all(promises);
    setRows(results);
    setResultsReady(true);
  }, []);

  // 진행률 애니메이션 (~3s) and gate completion on resultsReady
  useEffect(() => {
    if (phase !== 'scanning') return;
    const id = setInterval(() => {
      setProgress((p) => {
        const next = Math.min(100, p + 1);
        if (next === 100) {
          clearInterval(id);
          if (resultsReady) {
            setTimeout(() => setPhase('done'), 250);
          }
        }
        return next;
      });
    }, 30); // ~3 seconds to 100%
    return () => clearInterval(id);
  }, [phase, resultsReady]);

  // If API finishes after progress hit 100, complete now
  useEffect(() => {
    if (phase === 'scanning' && resultsReady && progress >= 100) {
      const t = setTimeout(() => setPhase('done'), 250);
      return () => clearTimeout(t);
    }
  }, [phase, resultsReady, progress]);

  // Dropzone 핸들러
  const onDrop = (e) => {
    e.preventDefault();
    setDragging(false);
    if (e.dataTransfer?.files?.length) handleFiles(e.dataTransfer.files);
  };
  const onDragOver  = (e) => { e.preventDefault(); setDragging(true); };
  const onDragLeave = (e) => { e.preventDefault(); setDragging(false); };
  const onChange    = (e) => { handleFiles(e.target.files); e.target.value = ''; };

  // 상태
  const scanning = phase === 'scanning';
  const done = phase === 'done';
  const hasError = rows.some((r) => !!r.error);
  const hasDetection = rows.some((r) => (r.detections?.length ?? 0) > 0);

  const headerText = scanning
    ? '탐지 중이니 잠시 기다려 주세요.'
    : done
      ? (hasError ? 'SCAN ERROR' : (hasDetection ? 'DETECTED!' : 'NO DETECTED!'))
      : null;

  // 메인으로 복귀
  const handleGoToMain = () => {
    setRows([]);
    setProgress(0);
    setPhase('idle');
    setDragging(false);
    setActiveFile(null);
    setResultsReady(false);
  };

  // Remove: detectionMap and sampleDetections (demo data)
  // -- removed demo detection constants --

  // Derived: active file detections
  const activeRow = rows.find(r => r.name === activeFile);
  const activeDetections = activeRow?.detections || [];

  return (
    <Box>
      {/* 업로드 화면 */}
      {phase === 'idle' && (
        <div
          className={`ud-dropzone ${isDragging ? 'ud-dropzone--active' : ''}`}
          onDragOver={onDragOver}
          onDragLeave={onDragLeave}
          onDrop={onDrop}
        >
          <div className="ud-icons">
            <img src={uploadSvg} alt="" className="ud-icon ud-icon--lg" />
            <div className="ud-icon-row">
              <img src={uploadSvg} alt="" className="ud-icon ud-icon--md" />
              <img src={uploadSvg} alt="" className="ud-icon ud-icon--sm" />
            </div>
          </div>

          <p className="ud-headline">Enter your file.</p>
          <p className="ud-sub">
            *파일을 업로드 해주세요.
            <br />*HWP, DOCX only.
          </p>

          <div className="ud-actions">
            <Button variant="upload" size="md" onClick={openPicker}>
              Upload
            </Button>
          </div>
          <input
            ref={inputRef}
            type="file"
            accept={acceptTypes}
            onChange={onChange}
            multiple
            hidden
          />
        </div>
      )}

      {/* 스캔/결과 화면 */}
      {phase === 'scanning' || phase === 'done' ? (
        <div className="scan-wrap">
          <h2 className={`scan-title ${done ? (hasDetection ? 'hot' : 'ok') : ''}`}>
            {headerText}
          </h2>
          <div className="scan-table">
            <div className="scan-head">
              <div className="col name">NAME</div>
              <div className="col date">DATE</div>
              <div className="col err">DETECTED ERROR</div>
            </div>
            <div className="scan-body">
              {rows.map((r, i) => (
                <div className="scan-row" key={`${r.name}-${i}`}>
                  <div className="col name">
                    <DocxIcon />
                    <span className="fname" title={r.name}>{r.name}</span>
                  </div>
                  <div className="col date">{r.date}</div>
                  <div className="col err" title={r.error ? `Error: ${r.error}` : ''}>
                    <span className={`dot ${done && (r.detections?.length > 0) ? 'on' : ''}`} />
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="scan-progress">
            {scanning && (
              <>
                <div className="bar">
                  <div className="fill" style={{ width: `${progress}%` }} />
                </div>
                <div className="label">Scanning ...</div>
              </>
            )}

            {done && (
              <div className="scan-actions">
                {hasDetection ? (
                  <Button size="md" className="btn-inline" onClick={() => setPhase('details')}>
                    Read more...
                  </Button>
                ) : (
                  <Button size="md" className="btn-inline" onClick={handleGoToMain}>
                    Go to main
                  </Button>
                )}
                <div className="label done">Completed</div>
              </div>
            )}
          </div>
        </div>
      ) : null}

      {/* 상세 화면 */}
      {phase === 'details' && (
        <div className="dd-wrap">
          <header className="dd-header">
            <div className="dd-header-left">
              <div className="dt-title">DETAILS</div>
              <div className="scan-date">Scan date : {fmtDate()}</div>
            </div>
            <div className="dd-header-right">
              <Button size="sm" className="dd-head-btn" onClick={handleGoToMain}>Go to main</Button>
              <Button size="sm" className="dd-head-btn">Clean up</Button>
            </div>
          </header>

          <div className="dd-body">
            <aside className="dd-left">
              <h3>DETECTED LOG</h3>
              <ul>
                {rows.map((f) => (
                  <li
                    key={f.name}
                    className={activeFile === f.name ? 'active' : ''}
                    onClick={() => setActiveFile(f.name)}
                    title={f.name}
                  >
                    <DocxIcon />
                    <span>{f.name}</span>
                  </li>
                ))}
              </ul>
            </aside>

            <section className="dd-right">
              <div className="dd-right-head">
                {activeFile ? `${activeFile} : ${activeDetections.length} Detected` : '파일을 선택하세요'}
              </div>
              <div className="dd-grid">
                {activeFile &&
                  activeDetections.map((det) => (
                    <div key={det.id} className="dd-card">
                      <div className="dd-badge">DETECTED ERROR {det.id}. {det.type}</div>
                      <div className="dd-keyword">KEYWORD : {det.keyword}</div>
                      <p>{det.summary}</p>
                    </div>
                  ))}
              </div>
            </section>
          </div>
        </div>
      )}
    </Box>
  );
}