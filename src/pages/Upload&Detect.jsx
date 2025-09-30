import React, { useRef, useState, useCallback } from 'react';
import Box from '../component/Box.jsx';
import Button from '../component/Button.jsx';
import uploadSvg from '../images/upload.svg';
import '../styles/Upload.css';

export default function UploadAndDetect({ onSelect }) {
  const inputRef = useRef(null);
  const [isDragging, setDragging] = useState(false);
  const [files, setFiles] = useState([]);

  const acceptTypes =
    '.hwp,.docx,application/vnd.hancom.hwp,application/vnd.openxmlformats-officedocument.wordprocessingml.document';

  const openPicker = () => inputRef.current?.click();

  const handleFiles = useCallback((fileList) => {
    const arr = Array.from(fileList || []);
    const filtered = arr.filter((f) => /\.(hwp|docx)$/i.test(f.name));
    setFiles(filtered);
    if (onSelect && filtered.length) onSelect(filtered);
  }, [onSelect]);

  const onDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragging(false);
    if (e.dataTransfer?.files?.length) handleFiles(e.dataTransfer.files);
  };
  const onDragOver = (e) => { e.preventDefault(); e.stopPropagation(); setDragging(true); };
  const onDragLeave = (e) => { e.preventDefault(); e.stopPropagation(); setDragging(false); };
  const onChange = (e) => { handleFiles(e.target.files); e.target.value = ''; };

  return (
    <Box>
      <div
        className={`ud-dropzone ${isDragging ? 'ud-dropzone--active' : ''}`}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        role="button"
        tabIndex={0}
        aria-label="파일을 드래그 앤 드롭하거나 Upload 버튼으로 선택"
      >
        {/* 아이콘 영역 (대/중/소) */}
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
          multiple={false}
          hidden
        />
      </div>

    </Box>
  );
}
