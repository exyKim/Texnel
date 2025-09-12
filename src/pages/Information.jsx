import React from "react";
import Box from "../component/Box.jsx";
import "../styles/Information.css";

export default function Information() {
  return (
    <div className="information-container">
      <Box>
        <h2 className="info-title">Development Information</h2>

        <div className="timeline">
          <div className="timeline-item">
            <div className="circle">✓</div>
            <span>TEAM</span>
          </div>
          <div className="timeline-item">
            <div className="circle">✓</div>
            <span>SOFTWARE</span>
          </div>
          <div className="timeline-item">
            <div className="circle">✓</div>
            <span>TECHNOLOGY</span>
          </div>
        </div>

        <div className="info-grid">
          <div className="info-block">
            <p>Team : Return 0</p>
            <p>Project Leader : Seyeon Kim</p>
            <p>Designer : Kyungmin Yoo</p>
            <p>Frontend / Backend : Seyeon Kim</p>
            <p>Acknowledgement : Dongyoung Lee</p>
          </div>
          <div className="info-block">
            <p>Version : .01</p>
            <p>Affiliation : Myoungji College</p>
            <p>
              Github :{" "}
              <a href="https://github.com/exyKim/Texnel" target="_blank">
                https://github.com/exyKim/Texnel
              </a>
            </p>
          </div>
          <div className="info-block">
            <p>Frontend : React, CSS, Electron, React Router</p>
            <p>Backend : Python, Node.js</p>
            <p>Design : Figma, Adobe PSD</p>
            <p>Tech Stack : React + Vite + Electron</p>
            <p>Etc :</p>
          </div>
        </div>
      </Box>
    </div>
  );
}
