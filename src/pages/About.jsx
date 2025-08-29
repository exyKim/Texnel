import React from 'react';

export default function About() {
  const handlePing = async () => {
    if (window.api) {
      const res = await window.api.ping();
      alert(`Electron IPC 응답: ${res}`);
    } else {
      alert("window.api 없음!");
    }
  };

  return (
    <div>
      <h1>About Page</h1>
      <button onClick={handlePing}>Ping Electron</button>
    </div>
  );
}
