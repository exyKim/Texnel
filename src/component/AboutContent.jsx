import React from 'react';
import '../styles/AboutContent.css';

const AboutContent = ({ title, iconSrc, iconAlt, children }) => {
    return (
        <div className="content-container">
            <div className="content-detail">
                <h1>{title}</h1>
                <div className="icon-paragraph-group">
                    <img src={iconSrc} alt={iconAlt} className="content-icon" />
                    <div className="main-paragraph">
                        {children}
                    </div>
                </div>
            </div>
            
            <div className="next-button">
                <span>Next</span> <span className="arrow">></span>
            </div>
        </div>
    );
};

export default AboutContent;
