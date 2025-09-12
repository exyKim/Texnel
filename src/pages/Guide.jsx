import React, { useRef, useCallback } from 'react';
import Box from '../component/Box.jsx';
import '../styles/Guide.css';

export default function Guide() {
  const scrollRef = useRef(null);

  const scrollToTop = useCallback(() => {
    const el = scrollRef.current;
    if (el) el.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  const scrollToBottom = useCallback(() => {
    const el = scrollRef.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
  }, []);

  return (
    <div className="guide-wrap">
      <Box>
        <h2 className="guide-title">Guide</h2>
        <p className="guide-intro">
          이 도구는 HWP 또는 DOCX 파일을 업로드하면, 문서 안에 숨겨진 악성 패턴을 자동으로 스캔합니다.
        </p>

        {/* ▼ 사진처럼: 둥근 패널 + 내부 스크롤 + 우측 화살표만 */}
        <div className="guide-panel">
          <div className="guide-scroll" ref={scrollRef}>
            <section className="guide-section">
              <h3 className="guide-h3">HWP (한글) Detection Rules</h3>
              <ol className="guide-list">
                <li>
                  <strong>BinData 내 실행 파일(MZ 헤더)</strong>
                  <div className="guide-desc">
                    BinData 스트림에 EXE, DLL 같은 PE 파일 포함 여부 탐지
                  </div>
                </li>
                <li>
                  <strong>EPS/PS (PostScript) 콘텐츠</strong>
                  <div className="guide-desc">
                    악용될 수 있는 PostScript/EPS 코드 포함 여부 확인
                  </div>
                </li>
                <li>
                  <strong>이상 확장자 첨부파일</strong>
                  <div className="guide-desc">
                    invoice.hwp.exe, report.txt.scr 같은 파일명 패턴 탐지
                  </div>
                </li>
                <li>
                  <strong>Raw IP links</strong>
                  <div className="guide-desc">
                    http://123.45.67.89/… 형태의 하드코딩 IP 링크 탐지
                  </div>
                </li>
              </ol>
            </section>

            <section className="guide-section">
              <h3 className="guide-h3">DOCX (워드) Detection Rules</h3>
              <ol className="guide-list">
                <li>
                  <strong>매크로(vbaProject.bin) 존재 여부</strong>
                  <div className="guide-desc">
                    word/vbaProject.bin 포함 시 매크로 사용 여부 확인
                  </div>
                </li>
                <li>
                  <strong>외부 템플릿 참조 (Template Injection)</strong>
                  <div className="guide-desc">
                    document.xml.rels에서 외부 URL 템플릿 연결 여부 검사
                  </div>
                </li>
                <li>
                  <strong>DDE/DDEAUTO 실행 플로우</strong>
                  <div className="guide-desc">
                    문서 내 DDE/DDEAUTO 필드 존재 및 실행 유도 탐지
                  </div>
                </li>
                <li>
                  <strong>의심 실행 키워드</strong>
                  <div className="guide-desc">
                    powershell, cmd.exe, regsvr32, mshta, rundll32 호출 탐지
                  </div>
                </li>
              </ol>
            </section>
          </div>

          {/* 우측 얇은 화살표 UI (사진처럼) */}
          <div className="guide-arrows">
            <button className="arrow-btn" onClick={scrollToTop} aria-label="top">
              <svg viewBox="0 0 24 24" width="16" height="16">
                <path d="M6 15l6-6 6 6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
            </button>
            <span className="arrow-dot" aria-hidden="true" />
            <button className="arrow-btn" onClick={scrollToBottom} aria-label="bottom">
              <svg viewBox="0 0 24 24" width="16" height="16">
                <path d="M18 9l-6 6-6-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
            </button>
          </div>
        </div>
      </Box>
    </div>
  );
}
