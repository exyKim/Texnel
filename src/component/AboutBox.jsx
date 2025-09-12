import React from "react";
import "../styles/AboutBox.css";

export default function AboutBox({ icon, title, description }) {
  return (
    <div className="about-box">
      <div className="about-box-icon">
        <img src={icon} alt={title} />
      </div>
      <div className="about-box-text">
        <h3>{title}</h3>
        <p>{description}</p>
      </div>
    </div>
  );
}
