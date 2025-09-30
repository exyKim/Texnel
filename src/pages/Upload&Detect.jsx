import React, { useRef, useState, useCallback, useEffect } from 'react';
import Box from '../component/Box.jsx';
import Button from '../component/Button.jsx';
import uploadSvg from '../images/upload.svg';
import '../styles/Upload.css';

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

export default function UploadAndDetect({ onSelect, onReadMore, onGoToMain }) {
  const inputRef = useRef(null);

  const [isDragging, setDragging] = useState(false);
  const [phase, setPhase] = useState('idle');     // 'idle' | 'scanning' | 'done'
  const [progress, setProgress] = useState(0);
  const [rows, setRows] = useState([]);           // { name, date, willDetect }

  const acceptTypes =
    '.hwp,.docx,application/vnd.hancom.hwp,application/vnd.openxmlformats-officedocument.wordprocessingml.document';

  const openPicker = () => inputRef.current?.click();

  // 업로드 처리
  const handleFiles = useCallback((fileList) => {
    const arr = Array.from(fileList || []);
    const filtered = arr.filter((f) => /\.(hwp|docx)$/i.test(f.name));
    if (!filtered.length) return;

    onSelect && onSelect(filtered);

    const today = fmtDate();
    // 데모 규칙: 파일명 길이 짝수 = 탐지 true
    const mapped = filtered.map((f) => ({
      name: f.name,
      date: today,
      willDetect: f.name.replace(/\s+/g, '').length % 2 === 0,
    }));

    setRows(mapped);
    setProgress(0);
    setPhase('scanning');
  }, [onSelect]);

  // 진행률 애니메이션
  useEffect(() => {
    if (phase !== 'scanning') return;
    const id = setInterval(() => {
      setProgress((p) => {
        const next = Math.min(100, p + 1);
        if (next === 100) {
          clearInterval(id);
          setTimeout(() => setPhase('done'), 250);
        }
        return next;
      });
    }, 40);
    return () => clearInterval(id);
  }, [phase]);

  // Dropzone 핸들러
  const onDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragging(false);
    if (e.dataTransfer?.files?.length) handleFiles(e.dataTransfer.files);
  };
  const onDragOver  = (e) => { e.preventDefault(); e.stopPropagation(); setDragging(true);  };
  const onDragLeave = (e) => { e.preventDefault(); e.stopPropagation(); setDragging(false); };
  const onChange    = (e) => { handleFiles(e.target.files); e.target.value = ''; };

  // 상태
  const scanning = phase === 'scanning';
  const done = phase === 'done';
  const hasDetection = rows.some((r) => r.willDetect);

  const headerText = scanning
    ? '탐지 중이니 잠시 기다려 주세요.'
    : done
      ? (hasDetection ? 'DETECTED!' : 'NO DETECTED!')
      : null;

  // 메인으로 복귀 (드롭존으로)
  const handleGoToMain = () => {
    // 콜백 먼저 호출(원하면 라우팅 등)
    onGoToMain && onGoToMain();
    // 로컬 상태 리셋
    setRows([]);
    setProgress(0);
    setPhase('idle');
    setDragging(false);
  };

  return (
    <Box>
      {/* 업로드 화면 */}
      {phase === 'idle' && (
        <div
          className={`ud-dropzone ${isDragging ? 'ud-dropzone--active' : ''}`}
          onDragOver={onDragOver}
          onDragLeave={onDragLeave}
          onDrop={onDrop}
          role="button"
          tabIndex={0}
          aria-label="파일을 드래그 앤 드롭하거나 Upload 버튼으로 선택"
        >
          {/* 아이콘 */}
          <div className="ud-icons">
            <img src={uploadSvg} alt="" className="ud-icon ud-icon--lg" draggable="false" />
            <div className="ud-icon-row">
              <img src={uploadSvg} alt="" className="ud-icon ud-icon--md" draggable="false" />
              <img src={uploadSvg} alt="" className="ud-icon ud-icon--sm" draggable="false" />
            </div>
          </div>

          {/* 텍스트 */}
          <p className="ud-headline">Enter your file.</p>
          <p className="ud-sub">
            *파일을 업로드 해주세요.
            <br />
            *HWP, DOCX only.
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
      {phase !== 'idle' && (
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
                  <div className="col date">{r.date || '·'}</div>
                  <div className="col err">
                    <span className={`dot ${done && r.willDetect ? 'on' : ''}`} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* 진행바 */}
          <div className="scan-progress">
            <div className="bar">
              <div className="fill" style={{ width: `${progress}%` }} />
            </div>
            <div className="label">{scanning ? 'Scanning ...' : 'Completed'}</div>
          </div>

          {/* CTA */}
          {done && (
            <div className="scan-cta">
              {hasDetection ? (
                <Button size="md" onClick={onReadMore}>
                  Read more...
                </Button>
              ) : (
                <Button size="md" onClick={handleGoToMain}>
                  Go to main
                </Button>
              )}
            </div>
          )}
        </div>
      )}
    </Box>
  );
}
