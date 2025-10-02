import React from 'react';
import Box from '../component/Box.jsx';
import '../styles/Guide.css';

export default function Guide() {
  return (
    <div className="guide-wrap">
      <Box>
        <h2 className="guide-title">Guide</h2>
        <div className="guide-content">
          <p>
            안녕하세요! <strong>Texnel</strong>은 바이너리 차원의 시그니처 탐지 기법을
            활용하여 문서 내 악성 여부를 판별하는 탐지 시스템입니다.
          </p>
          <p>본 도구를 사용하시려면 다음 단계를 따라주세요.</p>

          <ul>
            <li><strong>UPLOAD & DETECT</strong>: 파일 업로드</li>
            <li><strong>Scanning</strong>: 자동 탐지 진행</li>
            <li><strong>결과 확인</strong>: 위험 요소 확인</li>
            <li><strong>Cleanup (선택)</strong>: 안전한 문서로 재생성</li>
          </ul>

          <hr />

          <p>
            클린업 기능은 <strong>LLM(대형 언어 모델)</strong>을 활용해 해당 부분을 제거하여 깨끗한 문서로 만들어 줍니다.
          </p>
          <p>
            Texnel은 여러분의 <strong>안전한 문서 작업 환경</strong>을 위해 노력합니다.
          </p>
        </div>
      </Box>
    </div>
  );
}
