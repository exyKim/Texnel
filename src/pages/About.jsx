import React, { useState } from 'react';
import '../styles/About.css';    
import AboutContent from '../component/AboutContent.jsx'; 
import HwpIcon from '../images/HwpIcon.svg';
import DocxIcon from '../images/docxIcon.svg'; 

export default function About() {
  const [activeTab, setActiveTab] = useState('hwp');

  const renderContent = () => {
    switch (activeTab) {
      case 'hwp':
        return (
          <AboutContent 
            title="ABOUT HWP" 
            iconSrc={HwpIcon}
            iconAlt="HWP Icon"
          >
            <p>
              HWP 문서는 한국에서 특히 많이 사용되는 워드 프로세서 파일 형식으로, 업무·행정 환경에서 광범위하게 사용됩니다. 하지만 공격자들은 HWP 내부 구조의 특성을 악용하여 악성 행위를 감추거나 실행 파일을 삽입하는 방식으로 공격을 수행합니다.<br/>
              사용자가 단순히 문서를 열었을 뿐인데도, 추가 실행 파일이 내려오거나 원격 서버와 통신하면서 악성 행위로 이어질 수 있습니다. 
              따라서 HWP 보안 분석은 국내 보안 관점에서 매우 중요한 위치를 차지합니다.
              <br/><br/>
              따라서 이러한 보안 위협에 대응하기 위해 Texnel은 HWP 문서에서 발생할 수 있는 다양한 악성 행위를 정밀하게 분석하고, 그 중에서도 특히 빈번하게 활용되거나 피해 규모가 큰 대표적인 네 가지 공격 기법을 선별하여 집중적으로 탐지합니다. Texnel의 탐지 엔진은 단순한 패턴 매칭을 넘어 문서 구조, 내장된 객체, 실행 경로 등을 종합적으로 점검함으로써 사용자가 인지하지 못하는 위협까지 포착할 수 있도록 설계되었습니다. 이를 통해 사용자는 일상적인 문서 활용 과정에서도 보안성을 확보할 수 있으며, 기업과 기관은 문서 기반 공격에 대한 실질적인 방어 능력을 갖출 수 있습니다.
            </p>
          </AboutContent>
        );
      case 'docx':
        return (
          <AboutContent 
            title="ABOUT DOCX" 
            iconSrc={DocxIcon}
            iconAlt="DOCX Icon"
          >
            <p>
              DOCX는 전 세계적으로 가장 널리 사용되는 문서 형식으로, 업무 환경뿐만 아니라 개인 생활 전반에 걸쳐 활용도가 매우 높습니다.
              그러나 이처럼 보편적으로 사용되는 형식은 동시에 공격자들에게도 매력적인 표적이 됩니다.
              실제로 수많은 보안 위협이 DOCX를 통해 전파되었으며, 그 중 상당수는 문서 내부 기능을 교묘하게 악용한 사례였습니다.<br/>
              특히 매크로나 외부 템플릿 참조와 같은 기능은 본래 생산성을 높이기 위한 목적으로 설계되었지만, 
              공격자에게는 원격 코드 실행이나 악성 스크립트 주입을 가능하게 하는 수단으로 악용될 수 있습니다.
              <br/><br/>
              따라서 이러한 보안 위협에 대응하기 위해 Texnel은 DOCX 문서에서 발생할 수 있는 다양한 악성 행위를 정밀하게 분석하고, 
              그 중에서도 특히 빈번하게 활용되거나 피해 규모가 큰 대표적인 네 가지 공격 기법을 선별하여 집중적으로 탐지합니다.
              Texnel의 탐지 엔진은 단순한 패턴 매칭을 넘어 문서 구조, 내장된 객체, 실행 경로 등을 종합적으로 점검함으로써 사용자가 인지하지 못하는 위협까지 포착할 수 있도록 설계되었습니다.
              이를 통해 사용자는 일상적인 문서 활용 과정에서도 보안성을 확보할 수 있으며, 기업과 기관은 문서 기반 공격에 대한 실질적인 방어 능력을 갖출 수 있습니다.
            </p>
          </AboutContent>
        );
      default:
        return null;
    }
  };
  
  return (
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
  );
}

