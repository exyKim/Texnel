import React from 'react';
import '../styles/Alert.css';

export default function Alert({ icon, title, children, color = '#FFA02B' }) {
  return (
    <div className="alert-overlay">
      <div className="alert-box" style={{ borderColor: color }}>
        <div className="alert-head">
          <div className="alert-icon" style={{ color }}>
            {icon}
          </div>
          <div className="alert-title" style={{ color }}>{title}</div>
        </div>

        <div className="alert-content">
          {children}
        </div>
      </div>
    </div>
  );
}
