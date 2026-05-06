import React, { useState, useEffect } from 'react';
import './MainMenu.css';

export default function MainMenu({ onSelectMode }) {
  const [showLeaderboard, setShowLeaderboard] = useState(null);
  const [leaderboardData, setLeaderboardData] = useState([]);

  useEffect(() => {
    if (showLeaderboard) {
      const key = showLeaderboard === 'grid' ? 'tikitaka_global_leaderboard' : 'whoami_global_leaderboard';
      try {
        const stored = localStorage.getItem(key);
        if (stored) {
          const parsed = JSON.parse(stored);
          const arr = Object.values(parsed).sort((a, b) => b.score - a.score);
          setLeaderboardData(arr);
        } else {
          setLeaderboardData([]);
        }
      } catch (e) {
        setLeaderboardData([]);
      }
    }
  }, [showLeaderboard]);

  const handleReset = () => {
    if (window.confirm('Are you sure you want to reset this leaderboard? This action cannot be undone.')) {
      const key = showLeaderboard === 'grid' ? 'tikitaka_global_leaderboard' : 'whoami_global_leaderboard';
      localStorage.removeItem(key);
      setLeaderboardData([]);
    }
  };

  if (showLeaderboard) {
    return (
      <div className="main-menu-container">
        <div className="menu-blob menu-blob-1"></div>
        <div className="menu-blob menu-blob-2"></div>
        <div className="menu-content">
          <div className="lb-header">
            <button className="back-btn" onClick={() => setShowLeaderboard(null)}>← Back</button>
            <h2>{showLeaderboard === 'grid' ? 'BOX2BOX' : 'Who Am I'} Leaderboard</h2>
            <button className="reset-btn" onClick={handleReset}>Reset Data</button>
          </div>
          
          <div className="lb-list-container">
            {leaderboardData.length === 0 ? (
              <div className="lb-empty">No data available. Play a game first!</div>
            ) : (
              <ul className="lb-list">
                {leaderboardData.map((player, idx) => (
                  <li key={player.uniqueId || idx} className="lb-list-item">
                    <span className="lb-rank">#{idx + 1}</span>
                    <img 
                      src={player.profilePictureUrl || 'https://p16-sign-va.tiktokcdn.com/tos-maliva-avt-0068/7342880053746614278~c5_100x100.jpeg'} 
                      alt="avatar" 
                      className="lb-avatar" 
                    />
                    <div className="lb-info">
                      <span className="lb-name">{player.nickname || player.uniqueId}</span>
                      <span className="lb-id">@{player.uniqueId}</span>
                    </div>
                    <span className="lb-score">{player.score} PTS</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    );
  }

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
          <div className="mode-card">
            <div className="mode-icon" onClick={() => onSelectMode('grid')}>🧠</div>
            <h2 className="mode-title" onClick={() => onSelectMode('grid')}>BOX2BOX</h2>
            <p className="mode-desc" onClick={() => onSelectMode('grid')}>
              The ultimate 3x3 football matrix. Viewers guess players who played for both clubs or fit the criteria.
            </p>
            <div className="mode-actions">
              <button className="lb-btn" onClick={(e) => { e.stopPropagation(); setShowLeaderboard('grid'); }}>🏆 Leaderboard</button>
              <button className="play-btn" onClick={() => onSelectMode('grid')}>Play Now</button>
            </div>
          </div>

          {/* Who Am I Mode Card */}
          <div className="mode-card">
            <div className="mode-icon" onClick={() => onSelectMode('whoami')}>👤</div>
            <h2 className="mode-title" onClick={() => onSelectMode('whoami')}>Who Am I?</h2>
            <p className="mode-desc" onClick={() => onSelectMode('whoami')}>
              Guess the mystery player! Get clues on nationality, league, club, position, age & shirt number.
            </p>
            <div className="mode-actions">
              <button className="lb-btn" onClick={(e) => { e.stopPropagation(); setShowLeaderboard('whoami'); }}>🏆 Leaderboard</button>
              <button className="play-btn" onClick={() => onSelectMode('whoami')}>Play Now</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
