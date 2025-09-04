import React from "react";
import "../styles/Box.css";

const Box = ({ children }) => {
  return (
    <div className="box-container">
      {children}
    </div>
  );
};

export default Box;
