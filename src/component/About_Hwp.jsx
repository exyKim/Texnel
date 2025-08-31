import React from 'react';
import '../styles/About_Hwp.css';
import HwpIcon from '../images/HwpIcon.svg';

const HwpContent = () => {
    return (
        <div className="hwp-content-container"> {/*  부모 컨테이너 */}
            <div className="content-detail">
                <h1>ABOUT HWP</h1>
                <div className="icon-paragraph-group-hwp">
                    <img src={HwpIcon} alt="HWP Icon" className="hwp-icon" />
                    <p className="main-paragraph">
                        HWP 문서는 한국에서 특히 많이 사용되는 워드 프로세서 파일 형식으로, 업무·행정 환경에서 광범위하게 사용됩니다. 하지만 공격자들은 HWP 내부 구조의 특성을 악용하여 악성 행위를 감추거나 실행 파일을 삽입하는 방식으로 공격을 수행합니다.<br/>
                        사용자가 단순히 문서를 열었을 뿐인데도, 추가 실행 파일이 내려오거나 원격 서버와 통신하면서 악성 행위로 이어질 수 있습니다. 
                        따라서 HWP 보안 분석은 국내 보안 관점에서 매우 중요한 위치를 차지합니다.
                        <br/><br/>
                        따라서 이러한 보안 위협에 대응하기 위해 Texnel은 HWP 문서에서 발생할 수 있는 다양한 악성 행위를 정밀하게 분석하고, 그 중에서도 특히 빈번하게 활용되거나 피해 규모가 큰 대표적인 네 가지 공격 기법을 선별하여 집중적으로 탐지합니다. Texnel의 탐지 엔진은 단순한 패턴 매칭을 넘어 문서 구조, 내장된 객체, 실행 경로 등을 종합적으로 점검함으로써 사용자가 인지하지 못하는 위협까지 포착할 수 있도록 설계되었습니다. 이를 통해 사용자는 일상적인 문서 활용 과정에서도 보안성을 확보할 수 있으며, 기업과 기관은 문서 기반 공격에 대한 실질적인 방어 능력을 갖출 수 있습니다.
                    </p>
                </div>
            </div>
            
            <div className="next-button-hwp">
                <span>Next</span> <span className="arrow">></span>
            </div>
        </div>
    );
};

export default HwpContent;