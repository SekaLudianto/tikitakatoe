import React, { useState, useEffect, useRef, useCallback } from 'react';
import confetti from 'canvas-confetti';
import { Trophy } from 'lucide-react';
import './TikiTakaGame.css';

const loadGlobalLeaderboard = () => {
  try {
    const data = localStorage.getItem('tikitaka_global_leaderboard');
    return data ? JSON.parse(data) : {};
  } catch (e) {
    return {};
  }
};

const saveGlobalLeaderboard = (data) => {
  try {
    localStorage.setItem('tikitaka_global_leaderboard', JSON.stringify(data));
  } catch (e) {}
};

function getInitials(name) {
  return name.split(' ').map(w => w[0]).join('').slice(0, 3).toUpperCase();
}

function proxyUrl(url) {
  if (!url) return url;
  // Club logos: tmssl.akamaized.net/images/wappen/head/XXX.png -> /proxy-club/XXX.png
  if (url.includes('tmssl.akamaized.net/images/wappen/head/')) {
    return url.replace('https://tmssl.akamaized.net/images/wappen/head/', '/proxy-club/');
  }
  // Player photos: img.a.transfermarkt.technology/portrait/header/XXX -> /proxy-player/XXX
  if (url.includes('img.a.transfermarkt.technology/portrait/header/')) {
    return url.replace('https://img.a.transfermarkt.technology/portrait/header/', '/proxy-player/');
  }
  // Flags: flagcdn.com/w80/xx.png -> /proxy-flag/w80/xx.png
  if (url.includes('flagcdn.com/')) {
    return url.replace('https://flagcdn.com/', '/proxy-flag/');
  }
  return url;
}

function ClubLogo({ src, name, className }) {
  const [broken, setBroken] = useState(false);
  const proxied = proxyUrl(src);
  if (broken || !proxied) {
    return (
      <div className="club-logo-fallback" title={name}>
        {getInitials(name)}
      </div>
    );
  }
  return (
    <img
      src={proxied}
      alt={name}
      className={className}
      title={name}
      onError={() => setBroken(true)}
    />
  );
}

export default function TikiTakaGame() {
  const [gridsData, setGridsData] = useState(null);
  const [gridsLoading, setGridsLoading] = useState(true);
  const [gridData, setGridData] = useState(null);
  const [cells, setCells] = useState(Array(9).fill(null));
  const [feed, setFeed] = useState([]);
  const [inputValue, setInputValue] = useState('');
  const [liveStatus, setLiveStatus] = useState({ connected: false, username: '' });
  const [viewerCount, setViewerCount] = useState(0);
  const [isCompleted, setIsCompleted] = useState(false);
  const [countdown, setCountdown] = useState(15);
  const [mvpStats, setMvpStats] = useState([]);
  const [globalStats, setGlobalStats] = useState([]);
  const [hints, setHints] = useState(Array(9).fill(0));
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [difficulty, setDifficulty] = useState('medium');
  const [roundLikes, setRoundLikes] = useState(0);
  
  const messagesEndRef = useRef(null);
  const wsRef = useRef(null);
  const gridRef = useRef(null);
  const cellsRef = useRef(cells);

  // Keep cellsRef in sync
  useEffect(() => { cellsRef.current = cells; }, [cells]);
  useEffect(() => { gridRef.current = gridData; }, [gridData]);

  // Lazy-load sample-grids.json on mount (34MB file, not bundled)
  useEffect(() => {
    let cancelled = false;
    setGridsLoading(true);
    fetch('/sample-grids.json')
      .then(res => res.json())
      .then(data => {
        if (!cancelled) {
          setGridsData(data);
          setGridsLoading(false);
        }
      })
      .catch(err => {
        console.error('Failed to load grids data:', err);
        if (!cancelled) setGridsLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  // Initialize a random grid without repeating until all are played
  const startNewGame = useCallback(() => {
    if (!gridsData) return;

    let playedHistory = [];
    try {
      const historyStr = localStorage.getItem(`tikitaka_played_grids_${difficulty}`);
      if (historyStr) playedHistory = JSON.parse(historyStr);
    } catch (e) {}

    const availableGrids = gridsData[difficulty] || gridsData.medium;

    let availableIndices = [];
    for (let i = 0; i < availableGrids.length; i++) {
      if (!playedHistory.includes(i)) {
        availableIndices.push(i);
      }
    }

    // Reset jika semua soal sudah pernah keluar
    if (availableIndices.length === 0) {
      availableIndices = Array.from({ length: availableGrids.length }, (_, i) => i);
      playedHistory = [];
    }

    const randomIndex = availableIndices[Math.floor(Math.random() * availableIndices.length)];
    const chosenGrid = availableGrids[randomIndex];

    playedHistory.push(randomIndex);
    try {
      localStorage.setItem(`tikitaka_played_grids_${difficulty}`, JSON.stringify(playedHistory));
    } catch (e) {}

    setGridData(chosenGrid);
    setCells(Array(9).fill(null));
    setHints(Array(9).fill(0));
    setIsCompleted(false);
    setCountdown(15);
    setMvpStats([]);
    setRoundLikes(0);
  }, [difficulty, gridsData]);

  // Automatic countdown for next game
  useEffect(() => {
    let timer;
    if (isCompleted && countdown > 0) {
      timer = setTimeout(() => setCountdown(c => c - 1), 1000);
    } else if (isCompleted && countdown === 0) {
      startNewGame();
    }
    return () => clearTimeout(timer);
  }, [isCompleted, countdown, startNewGame]);

  useEffect(() => {
    const globalData = loadGlobalLeaderboard();
    const sortedGlobal = Object.values(globalData).sort((a, b) => b.score - a.score).slice(0, 5); // Limit global to top 5
    setGlobalStats(sortedGlobal);
    if (gridsData) startNewGame();
  }, [startNewGame, gridsData]);

  // Fullscreen change listener
  useEffect(() => {
    const handler = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', handler);
    return () => document.removeEventListener('fullscreenchange', handler);
  }, []);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen();
    } else {
      document.exitFullscreen();
    }
  };

  // Connect to WebSocket backend
  useEffect(() => {
    let ws;
    let reconnectTimer;

    function connect() {
      ws = new WebSocket('ws://localhost:3001');
      wsRef.current = ws;

      ws.onopen = () => {
        console.log('🔌 Connected to backend');
      };

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);

          if (msg.type === 'status') {
            setLiveStatus({ connected: msg.connected, username: msg.username || '', error: msg.error });
          }

          if (msg.type === 'viewerCount') {
            setViewerCount(msg.count);
          }

          if (msg.type === 'chat') {
            // Process the comment as a guess, pass full user info
            handleGuess(msg.comment, {
              uniqueId: msg.user.uniqueId,
              nickname: msg.user.nickname,
              profilePictureUrl: msg.user.profilePictureUrl,
            });
          }

          if (msg.type === 'member') {
            addFeedMessage(msg.uniqueId, 'joined the stream', false);
          }

          if (msg.type === 'gift') {
            addFeedMessage(msg.uniqueId, `sent ${msg.repeatCount}x ${msg.giftName} 🎁`, false);
          }

          if (msg.type === 'follow') {
            addFeedMessage(msg.uniqueId, 'followed! ❤️', false);
          }
          
          if (msg.type === 'like') {
            setRoundLikes(prev => prev + msg.likeCount);
          }
        } catch (e) {
          // ignore
        }
      };

      ws.onclose = () => {
        console.log('🔌 Disconnected from backend, reconnecting in 3s...');
        setLiveStatus(prev => ({ ...prev, connected: false }));
        reconnectTimer = setTimeout(connect, 3000);
      };

      ws.onerror = () => {
        // Will trigger onclose
      };
    }

    connect();

    return () => {
      clearTimeout(reconnectTimer);
      if (ws) ws.close();
    };
  }, []);

  // Handle auto-hint on 1000 likes
  useEffect(() => {
    if (roundLikes >= 1000 && !isCompleted) {
      setRoundLikes(prev => prev - 1000); // Reset tapi biarkan lebihannya
      
      setHints(prev => {
        const newHints = [...prev];
        const currentCells = cellsRef.current;
        const emptyIndices = [];
        
        for (let i = 0; i < 9; i++) {
          if (!currentCells[i] && newHints[i] < 2) {
            emptyIndices.push(i);
          }
        }
        
        if (emptyIndices.length > 0) {
          const randomIdx = emptyIndices[Math.floor(Math.random() * emptyIndices.length)];
          newHints[randomIdx] += 1;
        }
        return newHints;
      });
    }
  }, [roundLikes, isCompleted]);

  // Scroll feed to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [feed]);

  const addFeedMessage = (username, text, isCorrect = false) => {
    setFeed(prev => {
      const newFeed = [...prev, { id: Date.now() + Math.random(), username, text, isCorrect }];
      if (newFeed.length > 30) return newFeed.slice(newFeed.length - 30);
      return newFeed;
    });
  };

  const handleGuess = async (guess, userInfo = { uniqueId: 'You', nickname: 'You', profilePictureUrl: '' }) => {
    // Support simple string for manual input
    if (typeof userInfo === 'string') {
      userInfo = { uniqueId: userInfo, nickname: userInfo, profilePictureUrl: '' };
    }

    const currentGrid = gridRef.current;
    const currentCells = cellsRef.current;
    if (!currentGrid) return;
    
    // Normalize: strip accents/diacritics, lowercase, remove hyphens
    const normalize = (str) => 
      str.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[-']/g, ' ').trim();

    const searchName = normalize(guess);
    if (searchName.length < 3) return;
    let found = false;

    // Try each unfilled cell
    for (let i = 0; i < currentGrid.cells.length; i++) {
      if (currentCells[i] !== null) continue;

      const cellData = currentGrid.cells[i];
      const rowIdx = Math.floor(i / 3);
      const colIdx = i % 3;
      const header1 = currentGrid.rows[rowIdx]; // { type, id, name }
      const header2 = currentGrid.cols[colIdx]; // { type, id, name }

      // 1) Try backend API validation (full database: 16,258 players)
      let apiMatch = null;
      try {
        const res = await fetch('/api/validate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ guess, header1, header2 }),
        });
        if (res.ok) {
          const data = await res.json();
          if (data.match && data.player) {
            apiMatch = data.player;
          }
        }
      } catch (err) {
        // API not available, will fall back to sampleAnswers
      }

      // 2) Fallback: check sampleAnswers (offline/backup)
      let match = null;
      if (apiMatch) {
        match = apiMatch;
      } else {
        const localMatch = cellData.sampleAnswers.find(ans => {
          const normalizedName = normalize(ans.name);
          const nameParts = normalizedName.split(' ');
          const lastName = nameParts[nameParts.length - 1];
          
          return (
            normalizedName.includes(searchName) ||
            searchName.includes(normalizedName) ||
            lastName === searchName ||
            (searchName.length >= 4 && nameParts.some(part => part === searchName))
          );
        });
        if (localMatch) {
          match = { name: localMatch.name, imageUrl: localMatch.imageUrl };
        }
      }

      if (match) {
        // Re-check cells haven't changed during await
        const latestCells = cellsRef.current;
        if (latestCells[i] !== null) continue;

        const newCells = [...latestCells];
        newCells[i] = {
          playerName: match.name,
          imageUrl: match.imageUrl,
          uniqueId: userInfo.uniqueId,
          nickname: userInfo.nickname,
          profilePictureUrl: userInfo.profilePictureUrl,
        };
        setCells(newCells);
        addFeedMessage(userInfo.uniqueId, `guessed ${match.name} correctly! ✅`, true);
        
        // Check if game is completed
        const completed = newCells.every(c => c !== null);
        if (completed) {
          setIsCompleted(true);
          
          // Calculate MVP Stats
          const stats = {};
          newCells.forEach(c => {
            const key = c.uniqueId;
            if (!stats[key]) {
              stats[key] = {
                uniqueId: c.uniqueId,
                nickname: c.nickname,
                profilePictureUrl: c.profilePictureUrl,
                score: 0
              };
            }
            stats[key].score += 1;
          });
          
          const sortedMvps = Object.values(stats).sort((a, b) => b.score - a.score);
          setMvpStats(sortedMvps);

          // Update Global Leaderboard
          const globalData = loadGlobalLeaderboard();
          newCells.forEach(c => {
            const key = c.uniqueId;
            if (!globalData[key]) {
              globalData[key] = {
                uniqueId: c.uniqueId,
                nickname: c.nickname,
                profilePictureUrl: c.profilePictureUrl,
                score: 0
              };
            }
            // Update profile picture and nickname if changed
            globalData[key].nickname = c.nickname;
            if (c.profilePictureUrl) globalData[key].profilePictureUrl = c.profilePictureUrl;
            
            globalData[key].score += 1;
          });
          saveGlobalLeaderboard(globalData);
          const sortedGlobal = Object.values(globalData).sort((a, b) => b.score - a.score).slice(0, 5);
          setGlobalStats(sortedGlobal);

          // Single burst confetti for performance
          confetti({
            particleCount: 80,
            spread: 80,
            origin: { y: 0.6 },
            colors: ['#f59e0b', '#fbbf24', '#ffffff'],
            disableForReducedMotion: true
          });
        } else {
          // Normal confetti (reduced)
          confetti({
            particleCount: 40,
            spread: 60,
            origin: { y: 0.6 },
            colors: ['#10b981', '#ffffff', '#fbbf24']
          });
        }
        
        found = true;
        break;
      }
    }

    if (!found) {
      addFeedMessage(userInfo.uniqueId, guess, false);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!inputValue) return;
    handleGuess(inputValue, 'You');
    setInputValue('');
  };

  const handleCellClick = (idx) => {
    if (cells[idx] !== null) return; // already guessed
    setHints(prev => {
      const next = [...prev];
      next[idx] = (next[idx] + 1) % 3; // Cycle: 0 -> 1 -> 2 -> 0
      return next;
    });
  };

  const getHint = (name, level) => {
    if (!name || level === 0) return '?';
    const parts = name.split(' ');
    if (level === 1) {
      return parts.map(p => p[0].toUpperCase() + '.').join(' ');
    }
    if (level === 2) {
      return parts.map((p, i) => {
        if (i === parts.length - 1) { // last name
          if (p.length <= 2) return p;
          return p[0].toUpperCase() + ' ' + '_ '.repeat(p.length - 2).trim() + ' ' + p[p.length - 1].toLowerCase();
        }
        return p[0].toUpperCase() + '.';
      }).join(' ');
    }
    return '?';
  };

  if (gridsLoading) {
    return (
      <div className="tikitaka-container" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div className="bg-blob blob-1"></div>
        <div className="bg-blob blob-2"></div>
        <div style={{ textAlign: 'center', zIndex: 10 }}>
          <div style={{ fontSize: '3rem', marginBottom: '1rem', animation: 'pulse 1.5s infinite' }}>⚽</div>
          <div style={{ color: '#94a3b8', fontSize: '1.2rem', fontWeight: 500 }}>Loading game data...</div>
        </div>
      </div>
    );
  }

  if (!gridData) return null;

  return (
    <div className="tikitaka-container">
      <div className="bg-blob blob-1"></div>
      <div className="bg-blob blob-2"></div>

      <div className="game-content">


        <div className="game-header">
          <h1>TIKI TAKA T<span className="ball-icon">⚽</span>E</h1>
          
          <div className="difficulty-selector">
            <button 
              className={`diff-btn ${difficulty === 'easy' ? 'active easy' : ''}`}
              onClick={() => { setDifficulty('easy'); startNewGame(); }}
            >
              EASY
            </button>
            <button 
              className={`diff-btn ${difficulty === 'medium' ? 'active medium' : ''}`}
              onClick={() => { setDifficulty('medium'); startNewGame(); }}
            >
              MEDIUM
            </button>
            <button 
              className={`diff-btn ${difficulty === 'hard' ? 'active hard' : ''}`}
              onClick={() => { setDifficulty('hard'); startNewGame(); }}
            >
              HARD
            </button>
          </div>
        </div>

        <div className="board-container">
          {isCompleted && (
            <div className="completion-overlay">
              <div className="completion-card">
                <div className="ft-badge">FULL TIME</div>
                <h2>MATCH COMPLETED</h2>
                <div className="leaderboards-container">
                  <div className={`mvp-list ${countdown > 7 ? 'fade-in' : 'fade-out'}`}>
                    <h3>🏆 MATCH MVP</h3>
                    {mvpStats.slice(0, 3).map((mvp, idx) => (
                      <div key={mvp.uniqueId} className="mvp-row">
                        <div className="mvp-rank">#{idx + 1}</div>
                        {mvp.profilePictureUrl ? (
                          <img src={mvp.profilePictureUrl} alt="avatar" className="mvp-avatar" />
                        ) : (
                          <div className="mvp-avatar-placeholder">{mvp.nickname.charAt(0)}</div>
                        )}
                        <div className="mvp-name">{mvp.nickname}</div>
                        <div className="mvp-score">{mvp.score} pt</div>
                      </div>
                    ))}
                  </div>
                  <div className={`mvp-list global-list ${countdown <= 7 ? 'fade-in' : 'fade-out'}`}>
                    <h3>🌍 GLOBAL TOP 5</h3>
                    {globalStats.map((mvp, idx) => (
                      <div key={mvp.uniqueId} className="mvp-row">
                        <div className="mvp-rank">#{idx + 1}</div>
                        {mvp.profilePictureUrl ? (
                          <img src={mvp.profilePictureUrl} alt="avatar" className="mvp-avatar" />
                        ) : (
                          <div className="mvp-avatar-placeholder">{mvp.nickname.charAt(0)}</div>
                        )}
                        <div className="mvp-name">{mvp.nickname}</div>
                        <div className="mvp-score">{mvp.score} pt</div>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="countdown-container">
                  <svg className="countdown-svg" viewBox="0 0 100 100">
                    <circle className="countdown-bg" cx="50" cy="50" r="45"></circle>
                    <circle 
                      className="countdown-progress" 
                      cx="50" cy="50" r="45"
                      style={{ strokeDashoffset: `${283 - (283 * countdown) / 15}` }}
                    ></circle>
                  </svg>
                  <div className="countdown-number">{countdown}</div>
                  <div className="countdown-label">NEXT MATCH</div>
                </div>
              </div>
            </div>
          )}
          
          <div className="col-headers">
            {gridData.cols.map((col, idx) => (
              <div key={`col-${idx}`} className="header-cell">
                {col.type === 'position' ? (
                  <div className="text-logo">{col.textLogo}</div>
                ) : (
                  <ClubLogo src={col.logoUrl} name={col.name} className="club-logo" />
                )}
                <span className="club-name">{col.name}</span>
              </div>
            ))}
          </div>

          <div className="row-headers">
            {gridData.rows.map((row, idx) => (
              <div key={`row-${idx}`} className="header-cell">
                {row.type === 'position' ? (
                  <div className="text-logo">{row.textLogo}</div>
                ) : (
                  <ClubLogo src={row.logoUrl} name={row.name} className="club-logo" />
                )}
                <span className="club-name">{row.name}</span>
              </div>
            ))}
          </div>

          <div className="grid">
            {gridData.cells.map((cell, idx) => {
              const filled = cells[idx];
              return (
                <div 
                  key={`cell-${idx}`} 
                  className={`grid-cell ${filled ? 'filled' : ''} ${!filled && hints[idx] > 0 ? 'hint-active' : ''}`}
                  onClick={() => handleCellClick(idx)}
                >
                  <div className="cell-number">{idx + 1}</div>
                  
                  {filled ? (
                    <div className="filled-content">
                      <div className="player-image-container">
                        <img src={proxyUrl(filled.imageUrl)} alt={filled.playerName} className="player-image" />
                      </div>
                      <div className="player-name-badge">{filled.playerName}</div>
                      <div className="guesser-badge">
                        {filled.profilePictureUrl && (
                          <img src={filled.profilePictureUrl} alt={filled.nickname} className="guesser-avatar" />
                        )}
                        <span className="guesser-nick">{filled.nickname || filled.uniqueId}</span>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="player-name" style={{ opacity: hints[idx] > 0 ? 0.8 : 0.1, color: hints[idx] > 0 ? '#fbbf24' : 'inherit' }}>
                        {hints[idx] > 0 ? getHint(cell.sampleAnswers[0]?.name, hints[idx]) : '?'}
                      </div>
                      <div className="answer-count">{cell.answerCount} valid players</div>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <div className="like-progress-container">
          <div className="like-progress-text">❤️ {Math.min(roundLikes, 1000)} / 1000 Tap-Tap for Clue!</div>
          <div className="like-progress-bar">
            <div 
              className="like-progress-fill" 
              style={{ width: `${Math.min((roundLikes / 1000) * 100, 100)}%` }}
            ></div>
          </div>
        </div>

        <div className="status-bar">
          <div className="status-left">
            <div className={`pulse ${liveStatus.connected ? '' : 'pulse-gray'}`}></div>
            {liveStatus.connected 
              ? <span>LIVE @{liveStatus.username} • 👀 {viewerCount}</span>
              : <span>Offline {liveStatus.error ? `— ${liveStatus.error}` : ''}</span>
            }
          </div>
          <button className="fullscreen-btn" onClick={toggleFullscreen} title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}>
            {isFullscreen ? '⛶' : '⛶'}
          </button>
        </div>

        <form className="mock-input" onSubmit={handleSubmit}>
          <input 
            type="text" 
            placeholder="Type player name (e.g. 'Messi')" 
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
          />
          <button type="submit">Guess</button>
        </form>
      </div>
    </div>
  );
}
