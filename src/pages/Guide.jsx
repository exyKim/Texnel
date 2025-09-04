import React from 'react';
import AboutContent from '../component/Box.jsx'; 

export default function Guide() {
  return (
    <div>
          <AboutContent 
            title="Guide" 
          >
            <p>
              이 도구는 HWP 또는 DOCX 파일을 업로드하면, 문서 안에 숨겨진 악성 패턴을 자동으로 스캔합니다.
              <br/><br/>
            </p>
          </AboutContent>
    </div>
  );
}

