// src/pages/About.jsx
import React, { useState } from 'react';
import '../styles/About.css';
import Box from '../component/Box.jsx';
import HwpIcon from '../images/HwpIcon.svg';
import DocxIcon from '../images/DocxIcon.svg';
import nextbtn from '../images/nextBtn.svg';

// HWP icons
import HwpMz from '../images/hwp_mz.svg';
import HwpEps from '../images/hwp_eps.svg';
import HwpIp from '../images/hwp_ip.svg';
import HwpEx from '../images/hwp_ex.svg';

// DOCX icons (실제 파일명 기준)
import DocVba from '../images/doc_vba.svg';
import DocFile from '../images/doc_file.svg';
import DocPs from '../images/doc_ps.svg';
import DocDdt from '../images/doc_ddt.svg';

// 카드 컴포넌트 (component/ 단수 폴더)
import AboutBox from '../component/AboutBox.jsx';

export default function About() {
  const [activeTab, setActiveTab] = useState('hwp');
  const [showDetails, setShowDetails] = useState(false); // Next 누르면 상세 카드 모드

  const handleNext = () => setShowDetails(true);
  const switchTab = (tab) => {
    setActiveTab(tab);
    setShowDetails(false); // 탭 바꾸면 항상 소개 화면부터
  };

  return (
    <div className="about-container">
      <Box>
        {/* 탭 메뉴는 항상 고정 */}
        <div className="tab-menu">
          <button
            className={`tab-btn ${activeTab === 'hwp' ? 'active' : ''}`}
            onClick={() => switchTab('hwp')}
          >
            HWP
          </button>
          <button
            className={`tab-btn ${activeTab === 'docx' ? 'active' : ''}`}
            onClick={() => switchTab('docx')}
          >
            DOCX
          </button>
        </div>


        {!showDetails && (
          <div className="about-inner">
            <div className="tab-content">
              {activeTab === 'hwp' && (
                <>
                  <div className="about-title">ABOUT HWP</div>
                  <div className="about-row">
                    <div className="about-icon">
                      <img src={HwpIcon} alt="HWP Icon" />
                    </div>
                    <div className="about-text">
                      <p>
                        HWP 문서는 한국에서 특히 많이 사용되는 워드 프로세서 파일 형식으로,
                        업무·행정 환경에서 광범위하게 사용됩니다. 하지만 공격자들은 HWP 내부
                        구조의 특성을 악용하여 악성 행위를 감추거나 실행 파일을 삽입하는 방식으로
                        공격을 수행합니다. 사용자가 단순히 문서를 열었을 뿐인데도, 추가 실행 파일이
                        내려오거나 원격 서버와 통신하면서 악성 행위로 이어질 수 있습니다. 따라서
                        HWP 보안 분석은 국내 보안 관점에서 매우 중요한 위치를 차지합니다.
                      </p>
                      <p>
                        이러한 보안 위협에 대응하기 위해 <strong>Texnel</strong>은 HWP 문서에서
                        발생할 수 있는 다양한 악성 행위를 정밀하게 분석하고, 그 중에서도 특히
                        빈번하게 악용되거나 피해 규모가 큰 대표적인 네 가지 공격 기법을 집중적으로
                        탐지합니다. Texnel의 탐지 엔진은 단순한 패턴 매칭을 넘어 문서 구조, 내장된
                        객체, 실행 경로 등을 종합적으로 점검함으로써 사용자가 인지하지 못하는
                        위협까지 포착할 수 있도록 설계되었습니다.
                      </p>
                    </div>
                  </div>
                </>
              )}

              {activeTab === 'docx' && (
                <>
                  <div className="about-title">ABOUT DOCX</div>
                  <div className="about-row">
                    <div className="about-icon">
                      <img src={DocxIcon} alt="DOCX Icon" />
                    </div>
                    <div className="about-text">
                      <p>
                        DOCX는 전 세계적으로 가장 널리 사용되는 문서 형식으로, 업무 환경뿐만 아니라
                        개인 생활 전반에 걸쳐 활용도가 매우 높습니다. 그러나 이러한 보편적 사용은
                        동시에 공격자들에게 매력적인 표적이 되며, 실제로 수많은 보안 위협이 DOCX를
                        통해 전파되었습니다.
                      </p>
                      <p>
                        특히 매크로나 외부 템플릿 참조와 같은 기능은 원래 생산성을 높이기 위한
                        목적으로 설계되었지만, 공격자들에게는 원격 코드 실행이나 악성 스크립트
                        주입을 가능하게 하는 수단으로 악용될 수 있습니다.
                      </p>
                      <p>
                        이러한 보안 위협에 대응하기 위해 <strong>Texnel</strong>은 DOCX 문서에서
                        발생할 수 있는 다양한 악성 행위를 정밀하게 분석하고, 그 중에서도 특히
                        빈번하게 악용되거나 피해 규모가 큰 대표적인 네 가지 공격 기법을 집중적으로
                        탐지합니다. Texnel의 탐지 엔진은 단순한 패턴 매칭을 넘어 문서 구조, 내장된
                        객체, 실행 경로 등을 종합적으로 점검함으로써 사용자가 인지하지 못하는
                        위협까지 포착할 수 있도록 설계되었습니다.
                      </p>
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* Next 버튼: 소개 → 상세 카드 화면으로 전환 */}
            <button className="next-button" onClick={handleNext}>
              <span>Next</span>
              <img src={nextbtn} alt="Next" draggable="false" />
            </button>
          </div>
        )}

        {/* ===== 상세 카드 모드 (Box 내부 요소 갈아끼움) ===== */}
        {showDetails && activeTab === 'hwp' && (
          <div className="about-grid">
            <AboutBox
              icon={HwpMz}
              title="실행 파일 삽입"
              description="문서 내부에 실행파일('MZ')을 몰래 삽입해 두는 기법. 문서가 열리며 추출·실행되어 감염으로 이어질 수 있음."
            />
            <AboutBox
              icon={HwpEps}
              title="PostScript/EPS 포함"
              description="EPS/PS 그래픽 포맷의 취약점 악용. 단순 열람만으로도 원격 코드 실행(RCE) 발생 가능."
            />
            <AboutBox
              icon={HwpIp}
              title="원시 IP 사용"
              description="도메인 대신 원시 IP 직접 연결로 C2 통신/악성 다운로드 유도."
            />
            <AboutBox
              icon={HwpEx}
              title="이중확장자 파일"
              description="report.pdf.exe처럼 겉 확장자로 속여 사용자 실행 유도."
            />
          </div>
        )}

        {showDetails && activeTab === 'docx' && (
          <div className="about-grid">
            <AboutBox
              icon={DocFile}
              title="외부 파일 참조"
              description="원격 서버에서 템플릿/파일을 불러와 실행하는 기법."
            />
            <AboutBox
              icon={DocPs}
              title="명령 실행 키워드 포함"
              description="powershell, cmd 등 실행 키워드가 문서 내부에 숨어 실행을 유도."
            />
            <AboutBox
              icon={DocDdt}
              title="DDE/DDEAUTO"
              description="DDEAUTO 코드 삽입을 통해 다른 프로그램 자동 실행 유도."
            />
            <AboutBox
              icon={DocVba}
              title="매크로 포함"
              description="문서 내 VBA 코드로 악성 동작 수행. 자동실행 매크로 악용."
            />
          </div>
        )}
      </Box>
    </div>
  );
}