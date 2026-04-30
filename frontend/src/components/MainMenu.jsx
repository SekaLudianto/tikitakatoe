import React from 'react';
import './MainMenu.css';

export default function MainMenu({ onSelectMode }) {
  return (
    <div className="main-menu-container">
      {/* Background Animated Blobs */}
      <div className="menu-blob menu-blob-1"></div>
      <div className="menu-blob menu-blob-2"></div>
      <div className="menu-blob menu-blob-3"></div>

      <div className="menu-content">
        <h1 className="menu-title" style={{ fontSize: '3.5rem' }}>FOOTBALL TRIVIA</h1>
        <p className="menu-subtitle">Select a Game Mode to start playing on your TikTok Live!</p>

        <div className="modes-grid">
          {/* Grid Mode Card */}
          <div 
            className="mode-card"
            onClick={() => onSelectMode('grid')}
          >
            <div className="mode-icon">🧠</div>
            <h2 className="mode-title">BOX2BOX</h2>
            <p className="mode-desc">
              The ultimate 3x3 football matrix. Viewers guess players who played for both clubs or fit the criteria.
            </p>
            <button className="play-btn">Play Now</button>
          </div>

          {/* Career Path Mode Card (Coming Soon) */}
          <div className="mode-card disabled">
            <div className="coming-soon-badge">Coming Soon</div>
            <div className="mode-icon">🛫</div>
            <h2 className="mode-title">Career Path</h2>
            <p className="mode-desc">
              "Who Am I?" style trivia. Viewers guess the player based on their sequence of transfer history and clubs.
            </p>
            <button className="play-btn">Locked</button>
          </div>
        </div>
      </div>
    </div>
  );
}
