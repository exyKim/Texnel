import React, { useState } from 'react';
import MainLogo from '../images/Main_logo.svg';
import '../styles/About.css';     // About 페이지 서브 메뉴 스타일
import HwpContent from '../component/About_Hwp.jsx';
import DocxContent from '../component/About_Docx.jsx';

export default function About() {
  // 하단 서브 메뉴(HWP, DOCX)의 활성화 상태를 관리합니다.
  const [activeTab, setActiveTab] = useState('hwp');
  
  // 상단 메뉴(ABOUT, UPLOAD 등)의 활성화 상태를 관리합니다.
  // 이 페이지가 About이므로 'about'으로 초기값을 설정합니다.
  const [activeMenu, setActiveMenu] = useState('about');

  const handlePing = async () => {
    if (window.api) {
      const res = await window.api.ping();
      alert(`Electron IPC 응답: ${res}`);
    } else {
      alert("window.api 없음!");
    }
  };

  const renderContent = () => {
    switch (activeTab) {
      case 'hwp':
        return <HwpContent />;
      case 'docx':
        return <DocxContent />;
      default:
        return null;
    }
  };
  
  // 메인 메뉴 클릭 이벤트 핸들러.
  // 이 컴포넌트가 About 페이지 자체이므로, UI 상태만 변경하는 용도로 사용합니다.
  const handleMenuClick = (menu) => {
    setActiveMenu(menu);
  };

  return (
    <div className="main-container">
      {/* 상단 로고 */}
      <header className="header">
        <img src={MainLogo} alt="Texnel Main Logo" className="logo" />
      </header>

      {/* 네비게이션 메뉴 */}
      <nav className="nav-menu">
        <div 
          className={`menu-item ${activeMenu === 'about' ? 'selected' : ''}`}
          onClick={() => handleMenuClick('about')}
        >
          <span className="blur-effect"></span>
          ABOUT
        </div>
        <div 
          className={`menu-item ${activeMenu === 'upload' ? 'selected' : ''}`}
          onClick={() => handleMenuClick('upload')}
        >
          <span className="blur-effect"></span>
          UPLOAD & DETECT
        </div>
        <div 
          className={`menu-item ${activeMenu === 'information' ? 'selected' : ''}`}
          onClick={() => handleMenuClick('information')}
        >
          <span className="blur-effect"></span>
          INFORMATION
        </div>
        <div 
          className={`menu-item ${activeMenu === 'guide' ? 'selected' : ''}`}
          onClick={() => handleMenuClick('guide')}
        >
          <span className="blur-effect"></span>
          GUIDE
        </div>
      </nav>

      {/* About 페이지의 서브 메뉴 및 콘텐츠 */}
      <main className="content-section">
        <div className="about-container">
          <div className="sub-menu">
            <div 
              className={`sub-tab ${activeTab === 'hwp' ? 'active' : ''}`} 
              onClick={() => setActiveTab('hwp')}
            >
              HWP
            </div>
            <div 
              className={`sub-tab ${activeTab === 'docx' ? 'active' : ''}`} 
              onClick={() => setActiveTab('docx')}
            >
              DOCX
            </div>
          </div>
          <div className="content-area">
            {renderContent()}
          </div>
        </div>
      </main>
    </div>
  );
}