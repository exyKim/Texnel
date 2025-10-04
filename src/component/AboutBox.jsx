import React from "react";
import "../styles/AboutBox.css";

export default function AboutBox({ icon, title, subtitle, description, order, children }) {
  const desc = description ?? children; // description 우선, 없으면 children 사용
  return (
    <div className="about-box">
      <div className="about-box__icon">
        {icon && <img src={icon} alt={title || "icon"} draggable="false" />}
      </div>
      <div className="about-box__text">
        {title && <h4 className="about-box__title">{title}</h4>}
        {subtitle && <div className="about-box__subtitle">{subtitle}</div>}
        {desc && <p className="about-box__desc">{desc}</p>}
      </div>
    </div>
  );
}