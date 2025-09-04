import React from 'react';
import { NavLink } from 'react-router-dom';
import MainLogo from '../images/Main_logo.svg';
import '../styles/MenuBar.css';

export default function MenuBar() {
  return (
    <>
      <header className="header">
        <img src={MainLogo} alt="Texnel Main Logo" className="logo" />
      </header>

      <nav className="nav-menu">
        <NavLink 
          to="/about"
          className={({ isActive }) => "menu-item" + (isActive ? " selected" : "")}
        >
          ABOUT
        </NavLink>
        <NavLink 
          to="/upload"
          className={({ isActive }) => "menu-item" + (isActive ? " selected" : "")}
        >
          UPLOAD & DETECT
        </NavLink>
        <NavLink 
          to="/information"
          className={({ isActive }) => "menu-item" + (isActive ? " selected" : "")}
        >
          INFORMATION
        </NavLink>
        <NavLink 
          to="/guide"
          className={({ isActive }) => "menu-item" + (isActive ? " selected" : "")}
        >
          GUIDE
        </NavLink>
      </nav>
    </>
  );
}
