import React from 'react';
import { HashRouter as Router, Routes, Route } from 'react-router-dom';

import MenuBar from './component/MenuBar.jsx'; 
import About from './pages/About.jsx';
import UploadAndDetect from './pages/Upload&Detect.jsx';
import Information from './pages/Information.jsx';
import Guide from './pages/Guide.jsx';

import './App.css';

export default function App() {
  return (
    <Router>
      <div className="main-container">
        <MenuBar />
        
        <main className="content-section">
          <Routes>
            <Route path="/" element={<About />} />
            <Route path="/about" element={<About />} />
            <Route path="/upload" element={<UploadAndDetect />} />
            <Route path="/information" element={<Information />} />
            <Route path="/guide" element={<Guide />} />
          </Routes>
        </main>
      </div>
    </Router>
  );
}

