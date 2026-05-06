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

          {/* Who Am I Mode Card */}
          <div 
            className="mode-card"
            onClick={() => onSelectMode('whoami')}
          >
            <div className="mode-icon">�️</div>
            <h2 className="mode-title">Who Am I?</h2>
            <p className="mode-desc">
              Guess the mystery player! Get clues on nationality, league, club, position, age & shirt number.
            </p>
            <button className="play-btn">Play Now</button>
          </div>
        </div>
      </div>
    </div>
  );
}
