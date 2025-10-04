import React, { useRef, useState, useCallback, useEffect } from 'react';
import Box from '../component/Box.jsx';
import Button from '../component/Button.jsx';
import Alert from '../component/Alert.jsx';
import uploadSvg from '../images/upload.svg';
import fileInputAlert from '../images/fileInputAlert.svg';
import cleanupAlert from '../images/cleanupAlert.svg';
import downloadAlert from '../images/downloadAlert.svg';
import '../styles/Upload.css';

// --- API endpoints
const API_ENDPOINTS = {
  hwp: '/api/hwp_detect',
  docx: '/api/doc_detect',
};

// --- 허용 확장자
const ALLOWED = /\.(hwp|docx)$/i;

// --- (선택) REST 후보 엔드포인트
const SCAN_CANDIDATES = ['/api/scan', '/api/scan_file', '/api/file_scan'];

// --- Electron IPC invoker
const getIpcInvoke = () =>
  (window?.electron && window.electron.invoke) ||
  (window?.ipcRenderer && window.ipcRenderer.invoke) ||
  null;

// --- 공통 정규화
const normalizeDetections = (payload) => {
  let arr = Array.isArray(payload)
    ? payload
    : (payload?.detections ?? payload?.result ?? payload?.data ?? []);
  if (!Array.isArray(arr)) arr = [];
  return arr.map((item, idx) => ({
    id: item.id ?? idx + 1,
    type: item.type ?? item.category ?? item.attack ?? 'unknown',
    keyword: item.keyword ?? item.key ?? item.match ?? '',
    summary: item.summary ?? item.message ?? item.desc ?? item.intent ?? '',
  }));
};

// --- 스캐너 응답에서 파일명으로 해당 항목 추출
const pickDetectionsFromScanner = (json, filename) => {
  if (Array.isArray(json)) {
    if (json.length && typeof json[0] === 'object' && ('detections' in json[0])) {
      const match = json.find(
        (x) => x?.name === filename || x?.filename === filename
      );
      if (match) return normalizeDetections(match);
      return [];
    }
    return normalizeDetections(json);
  }
  if (json && typeof json === 'object' && Array.isArray(json.detections)) {
    return normalizeDetections(json);
  }
  return [];
};

// --- 날짜 포맷 (YYYY.MM.DD)
const fmtDate = (d = new Date()) => {
  const z = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}.${z(d.getMonth() + 1)}.${z(d.getDate())}`;
};

// --- 간단 Docx 아이콘
const DocxIcon = () => (
  <svg width="26" height="26" viewBox="0 0 24 24" aria-hidden>
    <path d="M14 2H6a2 2 0 0 0-2 2v16c0 1.1.9 2 2 2h12a2 2 0 0 0 2-2V8l-6-6z" fill="#3B82F6"/>
    <path d="M14 2v6h6" fill="#93C5FD"/>
    <rect x="6.5" y="11" width="11" height="1.6" rx="0.8" fill="#E5F0FF"/>
    <rect x="6.5" y="14" width="11" height="1.6" rx="0.8" fill="#E5F0FF"/>
  </svg>
);

// ========================
//   Component (상단부)
// ========================
export default function UploadAndDetect() {
  const inputRef = useRef(null);

  // --- Alert 상태 & 제어
  const [showInvalidType, setShowInvalidType] = useState(false);
  const [lastSanitizedPath, setLastSanitizedPath] = useState(null);
  const [origByName, setOrigByName] = useState({});
  const openInvalidTypeAlert  = useCallback(() => setShowInvalidType(true), []);
  const closeInvalidTypeAlert = useCallback(() => setShowInvalidType(false), []);

  // --- 화면/진행 상태
  const [isDragging, setDragging] = useState(false);
  const [phase, setPhase] = useState('idle'); // idle | scanning | done | details
  const [progress, setProgress] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const [doneCount, setDoneCount] = useState(0);
  const [rows, setRows] = useState([]);       // { name, date, detections?, error? }
  const [activeFile, setActiveFile] = useState(null);
  const [resultsReady, setResultsReady] = useState(false);
  const [showDownloadComplete, setShowDownloadComplete] = useState(false);

  const pct = (done, total) => (total ? Math.round((done / total) * 100) : 0);

  // --- IPC Progress 구독
  const subscribeIpcProgress = useCallback(() => {
    const api = getIpcInvoke() && window?.electron;
    if (!api?.onScanProgress) return () => {};
    const unsub = api.onScanProgress((ev) => {
      setDoneCount(ev.done);
      setProgress(pct(ev.done, ev.total));
    });
    return unsub;
  }, []);

  // --- IPC Result 구독
  const subscribeIpcResult = useCallback(() => {
    const api = getIpcInvoke() && window?.electron;
    if (!api?.onScanResult) return () => {};
    const unsub = api.onScanResult(({ name, result }) => {
      setRows((prev) =>
        prev.map((r) =>
          r.name === (result?.filename || name)
            ? { ...r, detections: normalizeDetections(result) }
            : r
        )
      );
    });
    return unsub;
  }, []);

  // --- IPC Complete 구독
  const subscribeIpcComplete = useCallback(() => {
    const api = getIpcInvoke() && window?.electron;
    if (!api?.onScanComplete) return () => {};
    const unsub = api.onScanComplete(({ total, results }) => {
      setRows((prev) => {
        const map = new Map(prev.map((r) => [r.name, r]));
        (results || []).forEach((res) => {
          const key = res?.filename || res?.name;
          if (!key) return;
          const existed = map.get(key) || { name: key, date: fmtDate() };
          map.set(key, {
            ...existed,
            detections: normalizeDetections(res),
          });
        });
        return Array.from(map.values());
      });
      setResultsReady(true);
    });
    return unsub;
  }, []);

  // --- IPC 우선 스캔 (배열)
  const detectFilesViaIPC = useCallback(async (files) => {
    const invoke = getIpcInvoke();
    if (!invoke) return null;
    const items = await Promise.all(
      files.map(async (f) => ({ name: f.name, bytes: await f.arrayBuffer() }))
    );
    const resp = await invoke('scan-files', items);
    if (Array.isArray(resp)) {
      return resp.map((r) => ({
        name: r.filename || r.name,
        detections: normalizeDetections(r),
      }));
    }
    if (resp && typeof resp === 'object') {
      return [
        {
          name: resp.filename || resp.name || files[0]?.name,
          detections: normalizeDetections(resp),
        },
      ];
    }
    return null;
  }, []);

  // --- 단일 파일 스캔 (IPC -> REST)
  const detectViaScanner = useCallback(async (file) => {
    const invoke = getIpcInvoke();
    if (invoke) {
      try {
        const bytes = await file.arrayBuffer();
        const objOrArr = await invoke('scan-file', { name: file.name, bytes });
        return pickDetectionsFromScanner(objOrArr, file.name);
      } catch {
        // fallthrough to REST
      }
    }
    const form = new FormData();
    form.append('file', file, file.name);
    form.append('filename', file.name);
    form.append('ext', file.name.split('.').pop().toLowerCase());
    for (const ep of SCAN_CANDIDATES) {
      try {
        const res = await fetch(ep, { method: 'POST', body: form });
        const text = await res.text();
        if (!res.ok) continue;
        const json = text ? JSON.parse(text) : [];
        return pickDetectionsFromScanner(json, file.name);
      } catch {}
    }
    return null;
  }, []);

  const detectFile = useCallback(async (file) => {
    const scanned = await detectViaScanner(file);
    if (scanned) return scanned;
    const ext = file.name.split('.').pop().toLowerCase();
    const ep = ext === 'hwp' ? API_ENDPOINTS.hwp : API_ENDPOINTS.docx;
    const form = new FormData();
    form.append('file', file, file.name);
    const res = await fetch(ep, { method: 'POST', body: form });
    const text = await res.text();
    if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText} - ${text?.slice(0, 300)}`);
    const json = text ? JSON.parse(text) : [];
    return normalizeDetections(json);
  }, [detectViaScanner]);

  // --- accept & picker
  const acceptTypes =
    '.hwp,.docx,application/vnd.hancom.hwp,application/vnd.openxmlformats-officedocument.wordprocessingml.document';
  const openPicker = () => inputRef.current?.click();

  // --- 파일 업로드 진입점 (단 하나만 유지)
  const handleFiles = useCallback(async (fileList) => {
    const arr = Array.from(fileList || []);

    // 1) 하나라도 무효 확장자 → Alert
    const hasInvalid = arr.some((f) => !ALLOWED.test(f.name));
    if (hasInvalid) openInvalidTypeAlert();

    // 2) 유효 파일만 추려서 진행
    const filtered = arr.filter((f) => ALLOWED.test(f.name));
    if (!filtered.length) return;

    setOrigByName(Object.fromEntries(filtered.map(f => [f.name, f])));

    const today = fmtDate();
    setRows(filtered.map((f) => ({ name: f.name, date: today })));
    setProgress(0);
    setDoneCount(0);
    setTotalCount(filtered.length);
    setResultsReady(false);
    setPhase('scanning');

    // IPC 구독 시작
    const unsubProgress = subscribeIpcProgress();
    const unsubResult   = subscribeIpcResult();
    const unsubComplete = subscribeIpcComplete();

    try {
      // 1) IPC 일괄 스캔
      const ipcResults = await detectFilesViaIPC(filtered);
      if (ipcResults) {
        const merged = filtered.map((f) => {
          const hit = ipcResults.find((r) => r.name === f.name);
          return { name: f.name, date: today, detections: hit?.detections || [] };
        });
        setRows(merged);
        setDoneCount(filtered.length);
        setProgress(100);
        setResultsReady(true);
        return;
      }
    } catch (e) {
      console.error('[ipc] scan-files fail', e);
      // fallback below
    } finally {
      // IPC 구독 해제
      unsubProgress?.();
      unsubResult?.();
      unsubComplete?.();
    }

    // 2) REST/단일 폴백
    const results = [];
    let done = 0;
    for (const file of filtered) {
      try {
        const detections = await detectFile(file);
        results.push({ name: file.name, date: today, detections });
      } catch (e) {
        console.error('[detect] FAIL', file.name, e);
        results.push({ name: file.name, date: today, detections: [], error: String(e?.message || e) });
      }
      done += 1;
      setDoneCount(done);
      setProgress(pct(done, filtered.length));
    }
    setRows(results);
    setResultsReady(true);
  }, [
    openInvalidTypeAlert,
    subscribeIpcProgress,
    subscribeIpcResult,
    subscribeIpcComplete,
    detectFilesViaIPC,
    detectFile,
  ]);

  // --- details 진입 시 첫 파일 선택
  useEffect(() => {
    if (phase !== 'details' || activeFile) return;
    const detected = rows.filter((r) => (r.detections?.length ?? 0) > 0);
    const first = detected[0] || rows[0];
    setActiveFile(first ? first.name : null);
  }, [phase, rows, activeFile]);

  // --- IPC ping (선택)
  useEffect(() => {
    (async () => {
      try {
        const inv = getIpcInvoke();
        if (!inv) return;
        const pong = await inv('ping');
        console.log('[renderer] ping ->', pong);
      } catch (e) {
        console.error('ping fail', e);
      }
    })();
  }, []);

  // --- 스캔 완료 → done 전환
  useEffect(() => {
    if (phase === 'scanning' && resultsReady && progress >= 100) {
      const t = setTimeout(() => setPhase('done'), 250);
      return () => clearTimeout(t);
    }
  }, [phase, resultsReady, progress]);

  const handleGoToMain = useCallback(() => {
    setRows([]);
    setProgress(0);
    setTotalCount(0);
    setDoneCount(0);
    setPhase('idle');
    setDragging(false);
    setActiveFile(null);
    setResultsReady(false);
    setShowInvalidType(false);
    setShowCleanupConfirm(false);
    setIsCleaning(false);
    setIsCleanComplete(false);
    setCleanupProgress(0);
    setShowDownloadComplete(false);
  }, []);

    // 드롭존 핸들러들
const onDrop = (e) => {
    e.preventDefault();
    setDragging(false);
    if (e.dataTransfer?.files?.length) handleFiles(e.dataTransfer.files);
  };
  const onDragOver = (e) => { e.preventDefault(); setDragging(true); };
  const onDragLeave = (e) => { e.preventDefault(); setDragging(false); };
  const onChange = (e) => { handleFiles(e.target.files); e.target.value = ''; };

  // 상태 파생 값들 (JSX에서 사용)
  const scanning = phase === 'scanning';
  const done = phase === 'done';
  const hasError = rows.some((r) => !!r.error);
  const hasDetection = rows.some((r) => (r.detections?.length ?? 0) > 0);

  const headerText = scanning
    ? '탐지 중이니 잠시 기다려 주세요.'
    : done
      ? (hasError ? 'SCAN ERROR' : (hasDetection ? 'DETECTED!' : 'NO DETECTED!'))
      : null;

  // details 화면용
  const activeRow = rows.find(r => r.name === activeFile);
  const activeDetections = activeRow?.detections || [];

  // Clean up 확인 모달 상태/핸들러 추가  ⬇️ 이 블록을 UploadAndDetect 내부에 넣어주세요
  const [showCleanupConfirm, setShowCleanupConfirm] = useState(false);
  const openCleanupConfirm  = useCallback(() => setShowCleanupConfirm(true), []);
  const [isCleaning, setIsCleaning] = useState(false);        // 진행중 화면
  const [isCleanComplete, setIsCleanComplete] = useState(false); // 완료 화면
  const [cleanupProgress, setCleanupProgress] = useState(0);  // 진행률(더미)
  const closeCleanupConfirm = useCallback(() => setShowCleanupConfirm(false), []);

  const confirmCleanup = useCallback(async () => {
  try {
    if (!activeFile) return;
    setShowCleanupConfirm(false);
    setIsCleanComplete(false);
    setIsCleaning(true);
    setCleanupProgress(0);

    const inv = getIpcInvoke();
    let outPath = null;

    if (inv) {
      // 원본 바이트 확보 (이름으로 보관해둔 File에서 꺼냄)
      const srcFile = origByName[activeFile];
      const bytes = srcFile ? await srcFile.arrayBuffer() : null;

      // 실제 클린업 실행 (별표 마스킹 / LLM 비활성화)
      const resp = await inv('sanitize-file', {
        filename: activeFile,
        srcPath: null,             // 경로가 있으면 채워도 됨
        bytes,                     // 경로 없으면 바이트 사용
        detections: activeDetections, // [{ keyword: "KEYWORD : ... at 13367", ... }]
        mask: '***',
        noAI: true,
      });
      outPath = resp?.outPath || null;
      setLastSanitizedPath(outPath);
    } else {
      // 브라우저 환경 폴백(데모)
      await new Promise(r => setTimeout(r, 800));
    }

    // 진행 애니메이션 (UX 유지)
    const duration = 2000;
    const start = Date.now();
    const timer = setInterval(() => {
      const p = Math.min(100, Math.round(((Date.now() - start) / duration) * 100));
      setCleanupProgress(p);
      if (p >= 100) {
        clearInterval(timer);
        setIsCleaning(false);
        setIsCleanComplete(true);
      }
    }, 16);
  } catch (e) {
    console.error('[cleanup] fail', e);
    setIsCleaning(false);
    alert('클린업 중 오류가 발생했습니다.\n' + (e?.message || e));
  }
}, [activeFile, activeDetections, origByName]);


const handleDownloadSanitized = useCallback(async (dirPath) => {
  try {
    const inv = getIpcInvoke();
    if (inv && lastSanitizedPath) {
      if (dirPath) {
        const saved = await inv('save-sanitized-to', { src: lastSanitizedPath, dir: dirPath });
        if (saved) { await inv('open-path', saved); return; }
      } else {
        // 경로 지정 없으면 산출물 위치 보여주기
        await inv('open-path', lastSanitizedPath);
        return;
      }
    }
  } catch (e) {
    console.error('[download]', e);
  }
  // 폴백(브라우저): 더미 파일 내려주기
  const blob = new Blob([`Sanitized file: ${activeFile}\n(dummy)`], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = (activeFile || 'sanitized') + '.txt';
  a.click(); URL.revokeObjectURL(url);
}, [activeFile, lastSanitizedPath]);


const [showDownloadAlert, setShowDownloadAlert] = useState(false);
const [downloadPath, setDownloadPath] = useState('');
const openDownloadAlert  = useCallback(() => setShowDownloadAlert(true), []);
const closeDownloadAlert = useCallback(() => setShowDownloadAlert(false), []);

// 경로 선택(IPC가 있으면 네이티브 다이얼로그 호출, 없으면 폴백)
const pickDownloadPath = useCallback(async () => {
  try {
   const inv = getIpcInvoke();
    if (inv) {
      const picked = await inv('pick-directory'); // main에서 showOpenDialog({properties:['openDirectory']})
      if (picked) setDownloadPath(picked);
      return;
    }
  } catch {}
  // 폴백: 브라우저 환경에선 경로 개념이 없으니 안내만
  alert('데스크톱 앱에서 경로를 선택할 수 있습니다. (브라우저에서는 자동 다운로드로 진행됩니다)');
}, []);

  // Download 버튼 → 저장 실행 후 완료 화면 표시
  const handleDownloadAndShowComplete = useCallback(async () => {
    try {
      await handleDownloadSanitized(); // dirPath 없으면 브라우저는 자동 다운로드
    } finally {
      setShowDownloadComplete(true);
    }
  }, [handleDownloadSanitized]);

  // 완료 화면의 Back: 상세 기본 화면으로 복귀
  const handleBackToDetails = useCallback(() => {
    setShowDownloadComplete(false);
    setIsCleaning(false);
    setIsCleanComplete(false);
  }, []);

  // 리턴
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
        <Button
          size="sm"
          className="dd-head-btn"
          onClick={handleGoToMain}
          disabled={isCleaning}
        >
          Go to main
        </Button>
        <Button
          size="sm"
          className="dd-head-btn"
          onClick={openCleanupConfirm}
          disabled={!activeFile || isCleaning || isCleanComplete}
        >
          Clean up
        </Button>
      </div>
    </header>

    {/* ① 기본 상세 화면 (클린업 전) */}
    {!isCleaning && !isCleanComplete && (
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
            {activeFile
              ? `${activeFile} : ${activeDetections.length} Detected`
              : '파일을 선택하세요'}
          </div>
          <div className="dd-grid">
            {activeFile &&
              activeDetections.map((det) => (
                <div key={det.id} className="dd-card">
                  <div className="dd-badge">
                    DETECTED ERROR {det.id}. {det.type}
                  </div>
                  <div className="dd-keyword">KEYWORD : {det.keyword}</div>
                </div>
              ))}
          </div>
        </section>
      </div>
    )}

    {/* ② Clean up… 진행 화면 (2초) */}
    {isCleaning && (
      <div
        className="cleanup-screen"
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '360px',
          gap: '20px',
        }}
      >
        <div style={{ fontSize: '28px', letterSpacing: '2px', color: '#FFA02B' }}>
          Clean up....
        </div>
        <div className="scan-progress" style={{ width: '78%' }}>
          <div className="bar">
            <div className="fill" style={{ width: `${cleanupProgress}%` }} />
          </div>
        </div>
      </div>
    )}

    {/* ③ 완료 화면 + 다운로드 버튼 */}
    {isCleanComplete && !showDownloadComplete && (
      <div
        className="cleanup-done"
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '360px',
          gap: '24px',
        }}
      >
        <div style={{ fontSize: '28px', letterSpacing: '2px', color: '#FFA02B' }}>
          Complete
        </div>
        <div className="scan-progress" style={{ width: '78%' }}>
          <div className="bar">
            <div className="fill" style={{ width: '100%' }} />
          </div>
        </div>
        <Button variant="ghost" size="sm" onClick={openDownloadAlert}>
          Download
        </Button>
      </div>
    )}
    {/* ④ Download Complete 화면 */}
   {showDownloadComplete && (
     <div
       className="download-complete"
       style={{
         display: 'flex',
         flexDirection: 'column',
         alignItems: 'center',
         justifyContent: 'center',
         minHeight: '360px',
         gap: '22px',
       }}
     >
       <img src={downloadAlert} alt="" style={{ width: 92, height: 92 }} />
       <div style={{ fontSize: '22px', letterSpacing: '4px', color: '#FFA02B' }}>
         Download Complete
       </div>
       <div style={{ display: 'flex', gap: 12 }}>
         <Button size="sm" variant="ghost" onClick={handleBackToDetails}>
          Back
         </Button>
         <Button size="sm" onClick={handleGoToMain}>
           Go to main
         </Button>
       </div>
     </div>
   )}
  </div>
)}


      {/* pop up alert */}
      {showInvalidType && (
        <Alert
          color="#FFA02B"
          title="Input ERROR"
          icon={<img src={fileInputAlert} alt="" />}
        >
          <p>Texnel은 hwp 또는 docx 문서만 검사할 수 있습니다.</p>
          <div className="alert-actions">
            <Button size="sm" variant="ghost" onClick={closeInvalidTypeAlert}>
              CLOSE ✕
            </Button>
          </div>
        </Alert>
      )}

      {showCleanupConfirm && (
        <Alert
          color="#FFA02B"
          title="Clean up?"
          icon={<img src={cleanupAlert} alt="" />}
        >
          <p style={{ marginBottom: '0.5rem' }}>
            <strong>{activeFile || '선택된 파일 없음'}</strong>
          </p>
          <p>해당 문서를 클린업 시키겠습니까?</p>

          <div className="alert-actions" style={{ gap: '12px' }}>
            <Button size="sm" onClick={confirmCleanup}>Yes</Button>
            <Button size="sm" variant="ghost" onClick={closeCleanupConfirm}>Close ✕</Button>
          </div>
        </Alert>
      )}

      {showDownloadAlert && (
        <Alert
          color="#FFA02B"
          title="Download?"
          icon={<img src={downloadAlert} alt="" />}
        >
          <div style={{textAlign:'center', margin:'6px 0 18px', lineHeight:1.6}}>
            <div style={{opacity:.9}}>
              클린업 작업이 끝난 문서가<br/>저장될 위치를 골라주세요.
            </div>
          </div>

          {/* 경로 표시 바(스샷 느낌의 회색 바) */}
          <div
            style={{
              display:'flex', gap:'12px', alignItems:'center', justifyContent:'center',
              margin:'12px 0 18px'
            }}
          >
            <div
              className="dl-pathbar"
              title={downloadPath || '경로를 지정하세요'}
              style={{
                flex:'0 1 72%', height:'44px', borderRadius:'22px',
                background:'#8F95A0', opacity:.85, display:'flex', alignItems:'center',
                padding:'0 16px', color:'#121316', overflow:'hidden', whiteSpace:'nowrap',
                textOverflow:'ellipsis'
              }}
            >
              {downloadPath || '저장 경로 미선택'}
            </div>
            <Button size="sm" onClick={pickDownloadPath}>경로 지정</Button>
          </div>

          <div className="alert-actions" style={{ gap:'12px', justifyContent:'center' }}>
            <Button
              size="sm"
              onClick={async () => { await handleDownloadSanitized(downloadPath); closeDownloadAlert(); setShowDownloadComplete(true); }}
            >
              다운로드
            </Button>
            <Button size="sm" variant="ghost" onClick={closeDownloadAlert}>닫기 ✕</Button>
          </div>
        </Alert>
      )}
    </Box>
  );

}