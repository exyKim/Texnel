import React from "react";
import "../styles/AboutBox.css";

export default function AboutBox({ icon, title, subtitle, children }) {
  return (
    <div className="about-box">
      <div className="about-box__icon">
        {icon && <img src={icon} alt={title || "icon"} draggable="false" />}
      </div>
      <div className="about-box__text">
        {title && <h4 className="about-box__title">{title}</h4>}
        {subtitle && <div className="about-box__subtitle">{subtitle}</div>}
        {children && <p className="about-box__desc">{children}</p>}
      </div>
    </div>
  );
}