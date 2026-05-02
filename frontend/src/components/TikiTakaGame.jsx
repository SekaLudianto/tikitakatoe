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

function JerseyBadge({ number }) {
  return (
    <div className="jersey-badge" title={`#${number}`}>
      <svg viewBox="0 0 80 90" className="jersey-svg" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id={`jerseyGrad-${number}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#3b82f6" />
            <stop offset="100%" stopColor="#1e40af" />
          </linearGradient>
          <linearGradient id={`jerseyShine-${number}`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="rgba(255,255,255,0.15)" />
            <stop offset="50%" stopColor="rgba(255,255,255,0)" />
            <stop offset="100%" stopColor="rgba(255,255,255,0.08)" />
          </linearGradient>
        </defs>
        {/* Shirt body */}
        <path
          d="M15 28 L5 20 L0 35 L12 38 L12 85 C12 87 14 89 16 89 L64 89 C66 89 68 87 68 85 L68 38 L80 35 L75 20 L65 28 L58 18 C55 14 50 12 40 12 C30 12 25 14 22 18 Z"
          fill={`url(#jerseyGrad-${number})`}
          stroke="rgba(255,255,255,0.35)"
          strokeWidth="1.5"
        />
        {/* Shine overlay */}
        <path
          d="M15 28 L5 20 L0 35 L12 38 L12 85 C12 87 14 89 16 89 L64 89 C66 89 68 87 68 85 L68 38 L80 35 L75 20 L65 28 L58 18 C55 14 50 12 40 12 C30 12 25 14 22 18 Z"
          fill={`url(#jerseyShine-${number})`}
        />
        {/* Collar / neckline */}
        <path
          d="M30 12 C32 17 35 19 40 19 C45 19 48 17 50 12"
          fill="none"
          stroke="rgba(255,255,255,0.5)"
          strokeWidth="2"
        />
        {/* Number */}
        <text
          x="40"
          y="64"
          textAnchor="middle"
          className="jersey-number"
        >
          {number}
        </text>
      </svg>
    </div>
  );
}

function renderHeader(header) {
  if (header.type === 'jersey') {
    return <JerseyBadge number={header.id} />;
  }
  if (header.type === 'competition' && header.logoUrl) {
    return <ClubLogo src={header.logoUrl} name={header.name} className="club-logo" />;
  }
  if (header.textLogo) {
    return <div className="text-logo">{header.textLogo}</div>;
  }
  if (header.logoUrl) {
    return <ClubLogo src={header.logoUrl} name={header.name} className="club-logo" />;
  }
  return <div className="text-logo">{header.name.slice(0, 3).toUpperCase()}</div>;
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
  const [levelVotes, setLevelVotes] = useState(0);
  const [levelDownVotes, setLevelDownVotes] = useState(0);
  const [roseVotes, setRoseVotes] = useState(0);
  
  const messagesEndRef = useRef(null);
  const wsRef = useRef(null);
  const gridRef = useRef(null);
  const cellsRef = useRef(cells);
  const usedPlayersRef = useRef(new Set()); // Track used player names to prevent same player filling multiple cells

  // Keep refs in sync
  useEffect(() => { cellsRef.current = cells; }, [cells]);
  useEffect(() => { gridRef.current = gridData; }, [gridData]);

  // No longer loading the massive JSON file in browser.
  // Grids are served one-at-a-time via backend API.
  useEffect(() => {
    setGridsLoading(false);
    setGridsData(true); // flag: data available via API
  }, []);

  // Initialize a random grid without repeating until all are played
  const startNewGame = useCallback((overrideDiff) => {
    const targetDiff = overrideDiff || difficulty;

    let playedHistory = [];
    try {
      const historyStr = localStorage.getItem(`tikitaka_played_grids_${targetDiff}`);
      if (historyStr) playedHistory = JSON.parse(historyStr);
    } catch (e) {}

    const excludeParam = playedHistory.length > 0 ? `&exclude=${playedHistory.join(',')}` : '';
    
    fetch(`/api/grid?difficulty=${targetDiff}${excludeParam}`)
      .then(res => res.json())
      .then(data => {
        if (data.grid) {
          // Track played grids
          playedHistory.push(data.index);
          // Reset history if we've played all
          if (playedHistory.length >= data.total) playedHistory = [];
          try {
            localStorage.setItem(`tikitaka_played_grids_${targetDiff}`, JSON.stringify(playedHistory));
          } catch (e) {}

          setGridData(data.grid);
          setCells(Array(9).fill(null));
          setHints(Array(9).fill(0));
          setIsCompleted(false);
          setCountdown(15);
          setMvpStats([]);
          setRoundLikes(0);
          usedPlayersRef.current = new Set();
        }
      })
      .catch(err => {
        console.error('Failed to load grid:', err);
      });
  }, [difficulty]);

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

  // Load global leaderboard on mount
  useEffect(() => {
    const globalData = loadGlobalLeaderboard();
    const sortedGlobal = Object.values(globalData).sort((a, b) => b.score - a.score).slice(0, 5);
    setGlobalStats(sortedGlobal);
  }, []);

  // Start the first game once on mount
  const hasStartedRef = useRef(false);
  useEffect(() => {
    if (!hasStartedRef.current) {
      hasStartedRef.current = true;
      startNewGame();
    }
  }, [startNewGame]);

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

          if (msg.type === 'like') {
            setRoundLikes(prev => prev + msg.likeCount);
          }
          
          if (msg.type === 'gift') {
            addFeedMessage(msg.uniqueId, `sent ${msg.repeatCount}x ${msg.giftName} 🎁`, false);
            
            const giftName = msg.giftName.toLowerCase();
            
            // Massive Reveal (Rose / Mawar)
            if (giftName.includes('rose') || giftName.includes('mawar')) {
              setRoseVotes(prev => prev + msg.repeatCount);
            }
            
            // Level Up / Skip (Finger Heart / Jari Hati)
            if (giftName.includes('finger heart') || giftName.includes('hati')) {
               setLevelVotes(prev => prev + msg.repeatCount);
            }

            // Level Down (Overreact)
            if (giftName.includes('overreact')) {
               setLevelDownVotes(prev => prev + msg.repeatCount);
            }
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

  // Handle Level Up (Finger Heart)
  const VOTES_NEEDED = 2;
  useEffect(() => {
    if (levelVotes >= VOTES_NEEDED) {
      setLevelVotes(prev => prev - VOTES_NEEDED);
      const order = ['easy', 'medium', 'hard'];
      const nextIdx = (order.indexOf(difficulty) + 1) % order.length;
      const nextDiff = order[nextIdx];
      setDifficulty(nextDiff);
      startNewGame(nextDiff);
      
      // Level Up Effect
      confetti({
        particleCount: 150,
        spread: 120,
        origin: { y: 0.4 },
        colors: ['#3b82f6', '#8b5cf6', '#ffffff'],
        zIndex: 100
      });
    }
  }, [levelVotes, difficulty, startNewGame]);

  // Handle Level Down (Coffee)
  useEffect(() => {
    if (levelDownVotes >= VOTES_NEEDED) {
      setLevelDownVotes(prev => prev - VOTES_NEEDED);
      const order = ['easy', 'medium', 'hard'];
      const prevIdx = (order.indexOf(difficulty) - 1 + order.length) % order.length;
      const prevDiff = order[prevIdx];
      setDifficulty(prevDiff);
      startNewGame(prevDiff);
      
      // Level Down Effect
      confetti({
        particleCount: 150,
        spread: 120,
        origin: { y: 0.4 },
        colors: ['#ef4444', '#f87171', '#ffffff'],
        zIndex: 100
      });
    }
  }, [levelDownVotes, difficulty, startNewGame]);

  // Handle Massive Reveal (Rose)
  const ROSE_NEEDED = 5;
  useEffect(() => {
    if (roseVotes >= ROSE_NEEDED && !isCompleted) {
      setRoseVotes(prev => prev - ROSE_NEEDED);
      setHints(prev => {
        const newHints = [...prev];
        let changed = false;
        for(let i=0; i<9; i++) {
          if (cellsRef.current[i] === null) {
            if (newHints[i] < 1) { newHints[i] = 1; changed = true; }
            else if (newHints[i] === 1) { newHints[i] = 2; changed = true; }
          }
        }
        return newHints;
      });
      // Confetti effect for massive reveal
      confetti({
        particleCount: 80,
        spread: 100,
        origin: { y: 0.5 },
        colors: ['#f43f5e', '#fb7185', '#ffffff'],
        zIndex: 100
      });
    }
  }, [roseVotes, isCompleted]);

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

        // Runtime block: prevent same player from filling multiple cells
        const normalizedMatchName = match.name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
        if (usedPlayersRef.current.has(normalizedMatchName)) {
          continue; // Skip — this player already used in another cell
        }
        usedPlayersRef.current.add(normalizedMatchName);

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
          // Immediate minimal confetti for the 9th correct answer
          confetti({
            particleCount: 15,
            spread: 50,
            origin: { y: 0.6 },
            colors: ['#10b981', '#ffffff', '#fbbf24'],
            gravity: 1.5,
            ticks: 80,
            disableForReducedMotion: true
          });

          // Delay the MVP overlay by 3 seconds
          setTimeout(() => {
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

            // Light confetti burst for game completion (low-lag)
            confetti({
              particleCount: 40,
              spread: 80,
              origin: { y: 0.6 },
              colors: ['#f59e0b', '#fbbf24', '#ffffff'],
              gravity: 1.2,
              ticks: 120,
              disableForReducedMotion: true
            });
          }, 3000);
        } else {
          // Minimal confetti for correct answer (low-lag)
          confetti({
            particleCount: 12,
            spread: 45,
            origin: { y: 0.6 },
            colors: ['#10b981', '#ffffff', '#fbbf24'],
            gravity: 1.5,
            ticks: 80,
            disableForReducedMotion: true
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

  if (!gridData) {
    return (
      <div className="tikitaka-container" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div className="bg-blob blob-1"></div>
        <div className="bg-blob blob-2"></div>
        <div style={{ textAlign: 'center', zIndex: 10 }}>
          <div style={{ fontSize: '3rem', marginBottom: '1rem', animation: 'pulse 1.5s infinite' }}>⚽</div>
          <div style={{ color: '#94a3b8', fontSize: '1.2rem', fontWeight: 500 }}>Loading puzzle...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="tikitaka-container">
      <div className="bg-blob blob-1"></div>
      <div className="bg-blob blob-2"></div>

      <div className="game-content">


        <div className="game-header">
          <h1>B<span className="ball-icon">⚽</span>X 2 B<span className="ball-icon">⚽</span>X</h1>
          
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
                    <h3>🏆 MAN OF THE MATCH</h3>
                    {mvpStats.map((mvp, idx) => (
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
          
          {globalStats.length > 0 && (
            <div className="top-global-badge">
              <div className="top-global-title">THE GOAT</div>
              {globalStats[0].profilePictureUrl ? (
                <img src={globalStats[0].profilePictureUrl} alt="GOAT" className="top-global-avatar" />
              ) : (
                <div className="top-global-avatar-placeholder">{globalStats[0].nickname.charAt(0)}</div>
              )}
              <div className="top-global-name">{globalStats[0].nickname}</div>
            </div>
          )}

          <div className="col-headers">
            {gridData.cols.map((col, idx) => (
              <div key={`col-${idx}`} className="header-cell">
                {renderHeader(col)}
                {col.type !== 'jersey' && <span className="club-name">{col.name}</span>}
              </div>
            ))}
          </div>

          <div className="row-headers">
            {gridData.rows.map((row, idx) => (
              <div key={`row-${idx}`} className="header-cell">
                {renderHeader(row)}
                {row.type !== 'jersey' && <span className="club-name">{row.name}</span>}
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

        <div className="live-interactions-panel">
          <div className="interaction-col">
            <div className="interaction-label">❤️ {Math.min(roundLikes, 1000)} / 1000 Tap-Tap for Clue!</div>
            <div className="progress-bar">
              <div className="progress-fill like-fill" style={{ width: `${Math.min((roundLikes / 1000) * 100, 100)}%` }}></div>
            </div>
          </div>
          
          <div className="interaction-row-bottom">
            <div className="interaction-col">
              <div className="interaction-label" style={{ color: '#fb7185' }}>
                <span className="gift-icon">🌹</span> 
                {roseVotes} / {ROSE_NEEDED} Reveal
              </div>
              <div className="progress-bar">
                <div className="progress-fill" style={{ background: 'linear-gradient(90deg, #f43f5e, #fb7185)', boxShadow: '0 0 8px rgba(244, 63, 94, 0.5)', width: `${Math.min((roseVotes / ROSE_NEEDED) * 100, 100)}%` }}></div>
              </div>
            </div>
            <div className="interaction-col finger-heart-col">
              <div className="interaction-label">
                <img src="https://p16-webcast.tiktokcdn.com/img/maliva/webcast-va/a4c4dc437fd3a6632aba149769491f49.png~tplv-obj.webp" alt="Finger Heart" className="gift-img-icon" /> 
                {levelVotes} / {VOTES_NEEDED} Level Up
              </div>
              <div className="progress-bar">
                <div className="progress-fill level-fill" style={{ width: `${Math.min((levelVotes / VOTES_NEEDED) * 100, 100)}%` }}></div>
              </div>
            </div>
            <div className="interaction-col overreact-col">
              <div className="interaction-label" style={{color: '#f87171'}}>
                <img src="https://p16-webcast.tiktokcdn.com/img/alisg/webcast-sg/resource/dfd48ef1952b6d315856adda7705d02d.png~tplv-obj.webp" alt="Overreact" className="gift-img-icon" /> 
                {levelDownVotes} / {VOTES_NEEDED} Level Down
              </div>
              <div className="progress-bar">
                <div className="progress-fill" style={{ background: 'linear-gradient(90deg, #ef4444, #f87171)', boxShadow: '0 0 8px rgba(239, 68, 68, 0.5)', width: `${Math.min((levelDownVotes / VOTES_NEEDED) * 100, 100)}%` }}></div>
              </div>
            </div>
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
