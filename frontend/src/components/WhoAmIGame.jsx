import React, { useState, useEffect, useRef, useCallback } from 'react';
import confetti from 'canvas-confetti';
import { Trophy, ArrowUp, ArrowDown, RefreshCw, Type, Maximize, Minimize } from 'lucide-react';
import './WhoAmIGame.css';

// Normalize player name for comparison
const normalize = (str) => {
  if (!str || typeof str !== 'string') return '';
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/ø/g, 'o')
    .replace(/æ/g, 'ae')
    .replace(/œ/g, 'oe')
    .replace(/ß/g, 'ss')
    .replace(/đ/g, 'd')
    .replace(/ł/g, 'l')
    .replace(/[-']/g, ' ')
    .trim();
};

// Category comparison result types
const COMPARE = {
  EXACT: 'exact',      // Green - exact match
  DIFFERENT: 'diff',   // Red - different
  CLOSE: 'close',      // Yellow - related/close
  HIGHER: 'higher',    // Arrow up
  LOWER: 'lower',      // Arrow down
};

// Categories for the game
const CATEGORIES = [
  { key: 'country', label: 'NAT' },
  { key: 'league', label: 'LEAGUE' },
  { key: 'club', label: 'CLUB' },
  { key: 'position', label: 'POS' },
  { key: 'age', label: 'AGE' },
  { key: 'number', label: 'NUM' },
];

// League name mapping from competition ID codes
const LEAGUE_NAMES = {
  'GB1': 'Premier League',
  'ES1': 'La Liga',
  'IT1': 'Serie A',
  'L1': 'Bundesliga',
  'FR1': 'Ligue 1',
  'NL1': 'Eredivisie',
  'PO1': 'Liga Portugal',
  'TR1': 'Süper Lig',
  'MLS1': 'MLS',
  'SA1': 'Saudi Pro League',
  'JAP1': 'J1 League',
  'BRA1': 'Brasileirão',
  'ARG1': 'Liga Argentina',
  'MEX1': 'Liga MX',
  'AUS1': 'A-League',
  'RSK1': 'K League 1',
  'SC1': 'Scottish Premiership',
  'BE1': 'Pro League',
  'GR1': 'Super League',
  'RU1': 'Russian Premier Liga',
  'UKR1': 'Ukrainian Premier League',
  'GB2': 'Championship',
  'ES2': 'La Liga 2',
  'IT2': 'Serie B',
  'L2': '2. Bundesliga',
  'FR2': 'Ligue 2',
  'CL': 'Champions League',
  'EL': 'Europa League',
};

// League mapping from club (simplified fallback)
const getLeagueFromClub = (clubName, clubId) => {
  const leagueMap = {
    // England
    'Manchester City': 'Premier League',
    'Manchester United': 'Premier League',
    'Liverpool': 'Premier League',
    'Arsenal': 'Premier League',
    'Chelsea': 'Premier League',
    'Tottenham Hotspur': 'Premier League',
    'Newcastle United': 'Premier League',
    'West Ham United': 'Premier League',
    'Aston Villa': 'Premier League',
    'Brighton & Hove Albion': 'Premier League',
    'Everton': 'Premier League',
    'Wolverhampton Wanderers': 'Premier League',
    'Crystal Palace': 'Premier League',
    'Nottingham Forest': 'Premier League',
    'Fulham FC': 'Premier League',
    'AFC Bournemouth': 'Premier League',
    'Brentford FC': 'Premier League',
    // Spain
    'Real Madrid': 'La Liga',
    'FC Barcelona': 'La Liga',
    'Atlético de Madrid': 'La Liga',
    'Sevilla FC': 'La Liga',
    'Real Sociedad': 'La Liga',
    'Real Betis': 'La Liga',
    'Villarreal CF': 'La Liga',
    'Valencia CF': 'La Liga',
    // Germany
    'Bayern Munich': 'Bundesliga',
    'Borussia Dortmund': 'Bundesliga',
    'RB Leipzig': 'Bundesliga',
    'Bayer 04 Leverkusen': 'Bundesliga',
    'VfB Stuttgart': 'Bundesliga',
    'Eintracht Frankfurt': 'Bundesliga',
    'VfL Wolfsburg': 'Bundesliga',
    'Borussia Mönchengladbach': 'Bundesliga',
    // Italy
    'AC Milan': 'Serie A',
    'Inter Milan': 'Serie A',
    'Juventus': 'Serie A',
    'SSC Napoli': 'Serie A',
    'AS Roma': 'Serie A',
    'SS Lazio': 'Serie A',
    'Atalanta BC': 'Serie A',
    'ACF Fiorentina': 'Serie A',
    // France
    'Paris Saint-Germain': 'Ligue 1',
    'AS Monaco': 'Ligue 1',
    'Olympique Lyon': 'Ligue 1',
    'Olympique Marseille': 'Ligue 1',
    'LOSC Lille': 'Ligue 1',
    // Netherlands
    'Ajax': 'Eredivisie',
    'PSV Eindhoven': 'Eredivisie',
    'Feyenoord': 'Eredivisie',
    // Portugal
    'Benfica': 'Primeira Liga',
    'FC Porto': 'Primeira Liga',
    'Sporting CP': 'Primeira Liga',
    // Turkey
    'Galatasaray': 'Süper Lig',
    'Fenerbahce': 'Süper Lig',
    'Besiktas': 'Süper Lig',
    // Scotland
    'Celtic': 'Scottish Premiership',
    'Rangers': 'Scottish Premiership',
    // Belgium
    'Club Brugge': 'Pro League',
    'Anderlecht': 'Pro League',
    // Brazil
    'Flamengo': 'Série A',
    'Palmeiras': 'Série A',
    'São Paulo': 'Série A',
    'Santos': 'Série A',
    'Grêmio': 'Série A',
    'Internacional': 'Série A',
    // Argentina
    'Boca Juniors': 'Primera División',
    'River Plate': 'Primera División',
    'Independiente': 'Primera División',
  };
  return leagueMap[clubName] || 'Other';
};

// Compare two players and return comparison results
const comparePlayers = (guessed, target) => {
  const results = {};
  
  // Get current club (from enriched data) or fallback to clubs[0]
  const guessedCurrentClub = guessed.currentClub || (guessed.clubs.length > 0 ? { id: guessed.clubs[0].id, name: guessed.clubs[0].name, league: '' } : null);
  const targetCurrentClub = target.currentClub || (target.clubs.length > 0 ? { id: target.clubs[0].id, name: target.clubs[0].name, league: '' } : null);
  
  // Country comparison
  if (guessed.country === target.country) {
    results.country = { status: COMPARE.EXACT, value: guessed.country };
  } else {
    results.country = { status: COMPARE.DIFFERENT, value: guessed.country };
  }
  
  // League comparison — use currentClub.league or fallback to getLeagueFromClub
  const guessedLeagueCode = guessedCurrentClub?.league || '';
  const targetLeagueCode = targetCurrentClub?.league || '';
  const guessedLeague = guessedLeagueCode 
    ? LEAGUE_NAMES[guessedLeagueCode] || guessedLeagueCode
    : (guessedCurrentClub ? getLeagueFromClub(guessedCurrentClub.name, guessedCurrentClub.id) : 'Unknown');
  const targetLeague = targetLeagueCode 
    ? LEAGUE_NAMES[targetLeagueCode] || targetLeagueCode
    : (targetCurrentClub ? getLeagueFromClub(targetCurrentClub.name, targetCurrentClub.id) : 'Unknown');
  
  if (guessedLeague === targetLeague) {
    results.league = { status: COMPARE.EXACT, value: guessedLeague, leagueCode: guessedLeagueCode };
  } else {
    results.league = { status: COMPARE.DIFFERENT, value: guessedLeague, leagueCode: guessedLeagueCode };
  }
  
  // Club comparison - compare CURRENT clubs
  if (guessedCurrentClub && targetCurrentClub && guessedCurrentClub.id === targetCurrentClub.id) {
    results.club = { status: COMPARE.EXACT, value: guessedCurrentClub.name, id: guessedCurrentClub.id };
  } else {
    results.club = { status: COMPARE.DIFFERENT, value: guessedCurrentClub?.name || 'Unknown', id: guessedCurrentClub?.id };
  }
  
  // Position comparison — use detailedPosition (CB, LB, RW, etc.)
  const guessedPos = guessed.detailedPosition || guessed.position;
  const targetPos = target.detailedPosition || target.position;
  
  if (guessedPos === targetPos) {
    results.position = { status: COMPARE.EXACT, value: guessedPos };
  } else {
    // Group related positions for "close" detection
    const positionGroups = {
      'CB': 'DEF', 'LB': 'DEF', 'RB': 'DEF',
      'CDM': 'MID', 'CM': 'MID', 'CAM': 'MID', 'LM': 'MID', 'RM': 'MID',
      'LW': 'ATT', 'RW': 'ATT', 'CF': 'ATT', 'SS': 'ATT',
      'GK': 'GK',
      // Fallback for generic positions
      'Defender': 'DEF', 'Midfield': 'MID', 'Attack': 'ATT', 'Goalkeeper': 'GK',
    };
    const guessedGroup = positionGroups[guessedPos] || guessedPos;
    const targetGroup = positionGroups[targetPos] || targetPos;
    
    results.position = { 
      status: guessedGroup === targetGroup ? COMPARE.CLOSE : COMPARE.DIFFERENT, 
      value: guessedPos 
    };
  }
  
  // Age comparison
  const guessedAge = guessed.age || 0;
  const targetAge = target.age || 0;
  if (guessedAge === targetAge) {
    results.age = { status: COMPARE.EXACT, value: guessedAge };
  } else if (guessedAge < targetAge) {
    results.age = { status: COMPARE.HIGHER, value: guessedAge }; // arrow up = target is older
  } else {
    results.age = { status: COMPARE.LOWER, value: guessedAge }; // arrow down = target is younger
  }
  
  // Shirt number comparison
  const guessedNum = guessed.shirtNumber || 0;
  const targetNum = target.shirtNumber || 0;
  if (guessedNum === targetNum && guessedNum > 0) {
    results.number = { status: COMPARE.EXACT, value: `#${guessedNum}` };
  } else if (guessedNum > 0 && targetNum > 0) {
    if (guessedNum < targetNum) {
      results.number = { status: COMPARE.HIGHER, value: `#${guessedNum}` }; // arrow up = target number is higher
    } else {
      results.number = { status: COMPARE.LOWER, value: `#${guessedNum}` }; // arrow down = target number is lower
    }
  } else {
    results.number = { status: COMPARE.DIFFERENT, value: guessedNum > 0 ? `#${guessedNum}` : '?' };
  }
  
  return results;
};

// Check if guess matches target
const isCorrectGuess = (guessed, target) => {
  return normalize(guessed.name) === normalize(target.name);
};

export default function WhoAmIGame() {
  const [targetPlayer, setTargetPlayer] = useState(null);
  const [guesses, setGuesses] = useState([]);
  const [gameWon, setGameWon] = useState(false);
  const [leaderboard, setLeaderboard] = useState(() => {
    try {
      const saved = localStorage.getItem('whoami_leaderboard');
      return saved ? JSON.parse(saved) : {};
    } catch (e) {
      return {};
    }
  });
  const [showLeaderboardOverlay, setShowLeaderboardOverlay] = useState(false);
  const [liveStatus, setLiveStatus] = useState({ connected: false, username: '' });
  const [sessionLikes, setSessionLikes] = useState(0);
  const [revealedIndices, setRevealedIndices] = useState([]);
  const [isFullscreen, setIsFullscreen] = useState(false);
  
  const wsRef = useRef(null);
  const reconnectTimerRef = useRef(null);
  const processedGuessesRef = useRef(new Set());
  
  // Use ref for handleGuess so WebSocket always calls the latest version
  const handleGuessRef = useRef(null);
  const handleRevealLetterRef = useRef(null);

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

  // Start new game
  const startNewGame = useCallback(() => {
    fetch('/api/whoami/target')
      .then(r => {
        if (!r.ok) throw new Error('Network error');
        return r.json();
      })
      .then(player => {
        if (player) {
          setTargetPlayer(player);
          setGuesses([]);
          setGameWon(false);
          setSessionLikes(0);
          setRevealedIndices([]);
          processedGuessesRef.current.clear();
          console.log('🎯 New target:', player.name);
        }
      })
      .catch(err => {
        console.error('Failed to load target player, retrying...', err);
        setTimeout(startNewGame, 2000);
      });
  }, []);

  // Load target player on mount
  useEffect(() => {
    startNewGame();
  }, [startNewGame]);

  const handleRevealLetter = useCallback(() => {
    if (!targetPlayer || gameWon) return;
    const name = targetPlayer.name;
    
    setRevealedIndices(prev => {
      const unrevealed = [];
      for (let i = 0; i < name.length; i++) {
        if (name[i] !== ' ' && name[i] !== '-' && !prev.includes(i)) {
          unrevealed.push(i);
        }
      }
      if (unrevealed.length > 0) {
        const randomIdx = unrevealed[Math.floor(Math.random() * unrevealed.length)];
        return [...prev, randomIdx];
      }
      return prev;
    });
  }, [targetPlayer, gameWon]);

  // Keep refs up-to-date
  useEffect(() => {
    handleRevealLetterRef.current = handleRevealLetter;
  }, [handleRevealLetter]);

  const renderMaskedName = () => {
    if (!targetPlayer) return '?????';
    if (revealedIndices.length === 0) return '?????';
    const name = targetPlayer.name.toUpperCase();
    return name.split('').map((char, i) => {
      if (char === ' ') return <span key={i}>&nbsp;&nbsp;</span>;
      if (char === '-') return <span key={i}>-</span>;
      const isRevealed = revealedIndices.includes(i);
      return (
        <span key={i} style={{ color: isRevealed ? '#fbbf24' : '#fff' }}>
          {isRevealed ? char : '_'}&nbsp;
        </span>
      );
    });
  };

  // Handle a guess — this function is kept up-to-date via handleGuessRef
  const handleGuess = useCallback(async (guessName, userInfo) => {
    if (!targetPlayer || gameWon) {
      console.log('⚠️ handleGuess skipped: targetPlayer=', !!targetPlayer, 'gameWon=', gameWon);
      return;
    }
    
    const searchName = normalize(guessName);
    if (searchName.length < 3) return;
    
    console.log('🔍 Searching for:', guessName);
    
    let matchedPlayer = null;
    try {
      const res = await fetch(`/api/whoami/search?q=${encodeURIComponent(guessName)}`);
      if (res.ok) {
        const data = await res.json();
        matchedPlayer = data.player;
      }
    } catch (err) {
      console.error('Failed to search player:', err);
    }
    
    if (!matchedPlayer) {
      console.log(`❌ "${guessName}" tidak ditemukan di database`);
      return;
    }
    
    console.log('✅ Found player:', matchedPlayer.name);
    
    // Check if this user already guessed this player
    const guessKey = `${userInfo.uniqueId}:${matchedPlayer.id}`;
    if (processedGuessesRef.current.has(guessKey)) {
      console.log(`⚠️ ${userInfo.uniqueId} already guessed ${matchedPlayer.name}`);
      return;
    }
    processedGuessesRef.current.add(guessKey);
    
    // Compare with target
    const comparison = comparePlayers(matchedPlayer, targetPlayer);
    const isCorrect = isCorrectGuess(matchedPlayer, targetPlayer);
    
    const guessEntry = {
      id: Date.now(),
      player: matchedPlayer,
      user: userInfo,
      comparison,
      isCorrect,
      timestamp: new Date().toISOString()
    };
    
    setGuesses(prev => [guessEntry, ...prev]);
    
    if (isCorrect) {
      setGameWon(true);
      setLeaderboard(prev => {
        const currentScore = prev[userInfo.uniqueId]?.score || 0;
        const newLeaderboard = {
          ...prev,
          [userInfo.uniqueId]: {
            nickname: userInfo.nickname || userInfo.uniqueId,
            avatar: userInfo.profilePictureUrl || `https://api.dicebear.com/7.x/avataaars/svg?seed=${userInfo.uniqueId}`,
            score: currentScore + 1
          }
        };
        try {
          localStorage.setItem('whoami_leaderboard', JSON.stringify(newLeaderboard));
        } catch (e) {
          console.error('Failed to save leaderboard', e);
        }
        return newLeaderboard;
      });
      confetti({
        particleCount: 25,
        spread: 70,
        origin: { y: 0.6 },
        colors: ['#10b981', '#3b82f6', '#f59e0b', '#ef4444']
      });

      // Show leaderboard overlay after 7 seconds (let them see the answer), then restart
      setTimeout(() => {
        setShowLeaderboardOverlay(true);
        setTimeout(() => {
          setShowLeaderboardOverlay(false);
          setTimeout(() => {
            startNewGame();
          }, 500); // Wait for fade out
        }, 5000); // Show overlay for 5 seconds
      }, 7000); // Wait 7s before showing
    }
  }, [targetPlayer, gameWon, startNewGame]);

  // Keep handleGuessRef always pointing to latest handleGuess
  useEffect(() => {
    handleGuessRef.current = handleGuess;
  }, [handleGuess]);

  // WebSocket connection for live chat
  useEffect(() => {
    let reconnectAttempts = 0;
    const BASE_DELAY = 3000;
    const MAX_DELAY = 30000;
    
    const connect = () => {
      const ws = new WebSocket('ws://localhost:3001');
      wsRef.current = ws;
      
      ws.onopen = () => {
        console.log('✅ Connected to backend WebSocket');
        reconnectAttempts = 0;
        setLiveStatus(prev => ({ ...prev, connected: true }));
      };
      
      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          
          if (msg.type === 'chat') {
            console.log(`💬 WS chat received: "${msg.comment}" from @${msg.user?.uniqueId}`);
            // Use ref to always call latest version of handleGuess
            if (handleGuessRef.current) {
              handleGuessRef.current(msg.comment, {
                uniqueId: msg.user.uniqueId,
                nickname: msg.user.nickname,
                profilePictureUrl: msg.user.profilePictureUrl
              });
            }
          } else if (msg.type === 'status') {
            setLiveStatus({ connected: msg.connected, username: msg.username || '' });
          } else if (msg.type === 'like') {
            setSessionLikes(prev => prev + (msg.likeCount || 1));
          } else if (msg.type === 'gift') {
            // Secretly reveal a letter when any gift (>= 1 diamond) is sent
            // We do it per repeatCount to handle combo gifts smoothly
            if (msg.diamondCount >= 1 && handleRevealLetterRef.current) {
              const times = msg.repeatCount || 1;
              for (let i = 0; i < times; i++) {
                handleRevealLetterRef.current();
              }
            }
          }
        } catch (e) {
          console.error('WS message error:', e);
        }
      };
      
      ws.onclose = () => {
        reconnectAttempts++;
        const delay = Math.min(BASE_DELAY * Math.pow(2, reconnectAttempts - 1), MAX_DELAY);
        console.log(`🔌 Disconnected, reconnecting in ${delay/1000}s...`);
        setLiveStatus(prev => ({ ...prev, connected: false }));
        reconnectTimerRef.current = setTimeout(connect, delay);
      };
      
      ws.onerror = (err) => {
        console.log('WS error:', err);
        ws.close();
      };
    };
    
    connect();
    
    return () => {
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
      if (wsRef.current) wsRef.current.close();
    };
  }, []);

  // Get border color for comparison status
  const getStatusColor = (status) => {
    switch (status) {
      case COMPARE.EXACT: return '#10b981';   // Green
      case COMPARE.CLOSE: return '#f59e0b';   // Orange
      default: return '#ef4444';               // Red
    }
  };

  // Country to flag code mapping
  const COUNTRY_FLAG_CODES = {
    'Brazil': 'br', 'Argentina': 'ar', 'France': 'fr', 'Germany': 'de', 'Spain': 'es',
    'England': 'gb-eng', 'Portugal': 'pt', 'Italy': 'it', 'Netherlands': 'nl', 'Belgium': 'be',
    'Colombia': 'co', 'Uruguay': 'uy', 'Croatia': 'hr', 'Nigeria': 'ng', 'Senegal': 'sn',
    'Morocco': 'ma', 'Ghana': 'gh', 'Ivory Coast': 'ci', 'Cameroon': 'cm', 'Japan': 'jp',
    'Ecuador': 'ec', 'Chile': 'cl', 'Peru': 'pe', 'Switzerland': 'ch', 'Denmark': 'dk',
    'Austria': 'at', 'Turkey': 'tr', 'Wales': 'gb-wls', 'Scotland': 'gb-sct', 'Serbia': 'rs',
    'Poland': 'pl', 'Sweden': 'se', 'Algeria': 'dz', 'Egypt': 'eg', 'South Korea': 'kr',
    'USA': 'us', 'Mexico': 'mx', 'Canada': 'ca', 'Australia': 'au',
    'Paraguay': 'py', 'Venezuela': 've', 'Norway': 'no', 'Czech Republic': 'cz', 'Romania': 'ro',
    'Greece': 'gr', 'Hungary': 'hu', 'Ukraine': 'ua', 'Bosnia-Herzegovina': 'ba',
    'Republic of Ireland': 'ie', 'Northern Ireland': 'gb-nir', 'North Macedonia': 'mk',
    'Montenegro': 'me', 'Iceland': 'is', 'Finland': 'fi', 'Tunisia': 'tn',
    'DR Congo': 'cd', 'Mali': 'ml', 'Guinea': 'gn', 'Iran': 'ir', 'Saudi Arabia': 'sa',
    'Indonesia': 'id', 'Jamaica': 'jm', 'Costa Rica': 'cr', 'Honduras': 'hn',
    'Gabon': 'ga', 'Burkina Faso': 'bf', 'Congo': 'cg', 'Togo': 'tg', 'Benin': 'bj',
    'Cape Verde': 'cv', 'Equatorial Guinea': 'gq', 'Mozambique': 'mz', 'Zambia': 'zm',
    'Zimbabwe': 'zw', 'Angola': 'ao', 'South Africa': 'za', 'Slovakia': 'sk', 'Slovenia': 'si',
    'Albania': 'al', 'Georgia': 'ge', 'Armenia': 'am', 'Kosovo': 'xk', 'Luxembourg': 'lu',
    'Lithuania': 'lt', 'Latvia': 'lv', 'Estonia': 'ee', 'Cyprus': 'cy', 'Malta': 'mt',
    'Israel': 'il', 'Uzbekistan': 'uz', 'China': 'cn', 'Thailand': 'th',
  };

  // League code to logo file mapping
  const LEAGUE_LOGO_MAP = {
    'GB1': 'gb1', 'ES1': 'es1', 'IT1': 'it1', 'L1': 'l1', 'FR1': 'fr1',
    'NL1': 'nl1', 'PO1': 'po1', 'TR1': 'tr1', 'MLS1': 'mls1', 'SA1': 'sa1',
    'JAP1': 'jap1', 'BRA1': 'bra1', 'ARG1': 'arg1', 'MEX1': 'mex1',
    'AUS1': 'aus1', 'RSK1': 'rsk1', 'CL': 'cl', 'EL': 'el',
  };

  // Render a single comparison box (compact, minimalist)
  const renderCompareBox = (result, category) => {
    const color = getStatusColor(result.status);
    const isArrow = result.status === COMPARE.HIGHER || result.status === COMPARE.LOWER;
    let displayValue = String(result.value || '?');

    let imgSrc = null;
    if (category.key === 'country') {
      const code = COUNTRY_FLAG_CODES[result.value];
      if (code) imgSrc = `/flags/${code}.png`;
    } else if (category.key === 'league' && result.leagueCode) {
      const logo = LEAGUE_LOGO_MAP[result.leagueCode];
      if (logo) imgSrc = `/logos/competitions/${logo}.png`;
    } else if (category.key === 'club' && result.id) {
      imgSrc = `/proxy-club/${result.id}.png`;
    }

    return (
      <div key={category.key} style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px', flex: '1', minWidth: '0',
      }}>
        <div style={{
          width: '42px', height: '42px', borderRadius: '8px',
          border: `2.5px solid ${color}`, backgroundColor: '#fff',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: '2px',
        }}>
          {imgSrc ? (
            <img src={imgSrc} alt={result.value}
              style={{ width: category.key === 'country' ? '28px' : '32px', height: category.key === 'country' ? '18px' : '32px', objectFit: 'contain' }}
              onError={(e) => { e.target.onerror = null; e.target.style.display = 'none'; e.target.parentElement.querySelector('.fb').style.display = 'flex'; }}
            />
          ) : null}
          <span className="fb" style={{
            display: imgSrc ? 'none' : 'flex', color: '#0f172a',
            fontSize: displayValue.length > 6 ? '0.5rem' : '0.65rem',
            fontWeight: '800', textAlign: 'center', lineHeight: '1.1',
          }}>{displayValue}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1px' }}>
          <span style={{ color, fontSize: '0.5rem', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.3px' }}>
            {category.label}
          </span>
          {isArrow && (
            result.status === COMPARE.HIGHER 
              ? <ArrowUp size={10} color={color} strokeWidth={3} />
              : <ArrowDown size={10} color={color} strokeWidth={3} />
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="whoami-container">
      {/* Background blobs */}
      <div className="bg-blob blob-1"></div>
      <div className="bg-blob blob-2"></div>
      
      <div className="game-content" style={{ maxWidth: '600px', margin: '0 auto', padding: '20px' }}>
        {/* Header */}
        <div className="game-header">
          <div className="game-title">
            <span className="title-icon">🕵️</span>
            <h1>Who Am I?</h1>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button 
              onClick={handleRevealLetter}
              style={{
                background: 'rgba(255, 255, 255, 0.1)',
                border: '1px solid rgba(255, 255, 255, 0.2)',
                borderRadius: '8px',
                width: '32px', height: '32px',
                display: 'flex', justifyContent: 'center', alignItems: 'center',
                color: '#fbbf24', cursor: 'pointer',
                transition: 'all 0.2s',
              }}
              title="Reveal 1 Letter"
              onMouseOver={(e) => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.2)'}
              onMouseOut={(e) => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)'}
            >
              <Type size={16} />
            </button>
            <button 
              onClick={startNewGame}
              style={{
                background: 'rgba(255, 255, 255, 0.1)',
                border: '1px solid rgba(255, 255, 255, 0.2)',
                borderRadius: '8px',
                width: '32px', height: '32px',
                display: 'flex', justifyContent: 'center', alignItems: 'center',
                color: '#fff', cursor: 'pointer',
                transition: 'all 0.2s',
              }}
              title="Next Match"
              onMouseOver={(e) => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.2)'}
              onMouseOut={(e) => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)'}
            >
              <RefreshCw size={16} />
            </button>
            <button 
              onClick={toggleFullscreen}
              style={{
                background: 'rgba(255, 255, 255, 0.1)',
                border: '1px solid rgba(255, 255, 255, 0.2)',
                borderRadius: '8px',
                width: '32px', height: '32px',
                display: 'flex', justifyContent: 'center', alignItems: 'center',
                color: '#fff', cursor: 'pointer',
                transition: 'all 0.2s',
              }}
              title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
              onMouseOver={(e) => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.2)'}
              onMouseOut={(e) => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)'}
            >
              {isFullscreen ? <Minimize size={16} /> : <Maximize size={16} />}
            </button>
            <div className="live-badge" data-connected={liveStatus.connected}>
              {liveStatus.connected ? '🟢 LIVE' : '🔴 OFFLINE'}
            </div>
          </div>
        </div>

        {/* Top Scorer Leaderboard Overlay */}
        {showLeaderboardOverlay && (
          <div className="completion-overlay" style={{ paddingTop: '15vh', alignItems: 'flex-start' }}>
            <div className="completion-card" style={{ maxWidth: '450px' }}>
              <div className="ft-badge" style={{ background: '#eab308' }}>LEADERBOARD</div>
              <h2>TOP SCORERS</h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
            {Object.entries(leaderboard)
              .sort((a, b) => b[1].score - a[1].score)
              .slice(0, 5)
              .map(([id, user], index) => (
                <div key={id} style={{
                  display: 'flex', alignItems: 'center', gap: '15px',
                  background: index === 0 ? 'linear-gradient(135deg, rgba(234, 179, 8, 0.2), rgba(234, 179, 8, 0.05))' : 'rgba(255, 255, 255, 0.05)',
                  border: index === 0 ? '1px solid rgba(234, 179, 8, 0.4)' : '1px solid rgba(255, 255, 255, 0.1)',
                  borderRadius: '16px', padding: '12px 20px',
                  transform: showLeaderboardOverlay ? 'translateY(0)' : 'translateY(20px)',
                  opacity: showLeaderboardOverlay ? 1 : 0,
                  transition: `all 0.5s cubic-bezier(0.4, 0, 0.2, 1) ${index * 0.1}s`,
                }}>
                  <div style={{ fontSize: '1.2rem', fontWeight: 'bold', color: index === 0 ? '#eab308' : 'rgba(255,255,255,0.5)', width: '24px', textAlign: 'center' }}>
                    {index + 1}
                  </div>
                  <div style={{ position: 'relative' }}>
                    <img src={user.avatar} style={{ width: '45px', height: '45px', borderRadius: '50%', objectFit: 'cover', border: index === 0 ? '2px solid #eab308' : '2px solid transparent' }} alt="" />
                    {index === 0 && <span style={{position: 'absolute', top: -12, right: -12, fontSize: '1.4rem'}}>👑</span>}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0 }}>
                    <span style={{ fontSize: '1.1rem', color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontWeight: '700' }}>
                      {user.nickname}
                    </span>
                  </div>
                  <div style={{ fontSize: '1.3rem', color: '#10b981', fontWeight: '900', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    {user.score} <span style={{ fontSize: '1.1rem' }}>⚽</span>
                  </div>
                </div>
              ))}
              </div>
              <div style={{ marginTop: '20px', color: 'rgba(255,255,255,0.6)', fontSize: '1rem', animation: 'pulse 2s infinite' }}>
                Preparing next kick-off...
              </div>
            </div>
          </div>
        )}
        
        {/* Mystery Player Card */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: '15px',
          background: 'rgba(15, 23, 42, 0.6)',
          borderRadius: '12px',
          padding: '14px 18px',
          border: '1px solid rgba(255,255,255,0.1)',
          marginBottom: '12px',
        }}>
          {/* Blurred player photo */}
          <div style={{
            width: '70px', height: '70px',
            borderRadius: '50%', overflow: 'hidden',
            border: `3px solid ${gameWon ? '#10b981' : 'rgba(255,255,255,0.2)'}`,
            backgroundColor: 'rgba(0,0,0,0.3)',
            display: 'flex', justifyContent: 'center', alignItems: 'center',
            transition: 'border-color 0.5s ease', flexShrink: 0,
          }}>
            {targetPlayer ? (
              <img 
                src={targetPlayer.imageUrl ? `/proxy-player/${targetPlayer.imageUrl.split('/').pop().split('?')[0]}` : ''}
                style={{
                  width: '100%', height: '100%', objectFit: 'cover',
                  filter: gameWon ? 'none' : 'blur(12px) brightness(0.4)',
                  transition: 'filter 1s ease-in-out',
                }}
                onError={(e) => { e.target.onerror = null; e.target.style.display = 'none'; }}
                alt="Mystery Player"
              />
            ) : (
              <span style={{ color: '#fff', fontSize: '0.7rem' }}>...</span>
            )}
          </div>
          
          {/* Text side */}
          <div style={{ flex: 1 }}>
            {gameWon ? (
              <>
                <div style={{ fontSize: '1.1rem', fontWeight: 'bold', color: '#10b981' }}>{targetPlayer?.name}</div>
                <div style={{ color: '#fff', fontSize: '0.8rem', marginTop: '4px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  {guesses[0]?.user && (
                    <img 
                      src={guesses[0].user.profilePictureUrl || `https://api.dicebear.com/7.x/avataaars/svg?seed=${guesses[0].user.uniqueId}`} 
                      style={{width: '20px', height: '20px', borderRadius: '50%'}} 
                      alt=""
                    />
                  )}
                  <span><strong style={{ color: '#eab308' }}>Winner:</strong> {guesses[0]?.user?.nickname || guesses[0]?.user?.uniqueId || 'Someone'}</span>
                </div>
              </>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <div style={{ fontSize: '1.2rem', fontWeight: 'bold', letterSpacing: '2px' }}>
                  {renderMaskedName()}
                </div>
                <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.75rem', marginTop: '2px' }}>
                  Guess this player in the comments!
                </div>
                {/* Hints Area */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '8px', flexWrap: 'wrap' }}>
                  <div style={{ background: 'rgba(239, 68, 68, 0.2)', color: '#ef4444', padding: '2px 6px', borderRadius: '4px', fontSize: '0.65rem', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '4px', animation: sessionLikes > 0 ? 'pulse 1s' : 'none' }}>
                    ❤️ {sessionLikes >= 1000 ? (sessionLikes/1000).toFixed(1) + 'k' : sessionLikes}
                  </div>
                  {/* Hint 1: Nation (1k likes) */}
                  <div style={{ background: 'rgba(255,255,255,0.1)', padding: '2px 6px', borderRadius: '4px', fontSize: '0.65rem', display: 'flex', alignItems: 'center' }}>
                    {sessionLikes >= 1000 ? <img src={`/flags/${COUNTRY_FLAG_CODES[targetPlayer?.country]}.png`} style={{ width: '16px', height: '11px', objectFit: 'contain' }} alt="NAT" /> : '🔒 1k'}
                  </div>
                  {/* Hint 2: League (3k likes) */}
                  <div style={{ background: 'rgba(255,255,255,0.1)', padding: '2px 6px', borderRadius: '4px', fontSize: '0.65rem', display: 'flex', alignItems: 'center' }}>
                    {sessionLikes >= 3000 && targetPlayer?.currentClub ? <img src={`/logos/competitions/${LEAGUE_LOGO_MAP[targetPlayer.currentClub.league]}.png`} style={{ height: '12px', objectFit: 'contain' }} alt="LEAGUE" /> : '🔒 3k'}
                  </div>
                  {/* Hint 3: Club (5k likes) */}
                  <div style={{ background: 'rgba(255,255,255,0.1)', padding: '2px 6px', borderRadius: '4px', fontSize: '0.65rem', display: 'flex', alignItems: 'center' }}>
                    {sessionLikes >= 5000 && targetPlayer?.currentClub ? <img src={`/proxy-club/${targetPlayer.currentClub.id}.png`} style={{ height: '14px', objectFit: 'contain' }} alt="CLUB" /> : '🔒 5k'}
                  </div>
                </div>
              </div>
            )}
            <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.7rem', marginTop: '6px' }}>
              Guesses: {guesses.length}
            </div>
          </div>
        </div>

        {/* Guesses — compact list */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {guesses.map((guess, idx) => (
            <div 
              key={guess.id}
              style={{
                background: guess.isCorrect 
                  ? 'linear-gradient(135deg, rgba(16,185,129,0.15), rgba(16,185,129,0.05))'
                  : 'rgba(15, 23, 42, 0.5)',
                borderRadius: '10px',
                padding: '8px 10px',
                border: guess.isCorrect 
                  ? '1px solid rgba(16,185,129,0.4)' 
                  : '1px solid rgba(255,255,255,0.06)',
                animation: 'fadeInUp 0.3s ease-out',
              }}
            >
              {/* Header: avatar + nickname + player name */}
              <div style={{
                display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px',
              }}>
                <img
                  src={guess.user.profilePictureUrl || `https://api.dicebear.com/7.x/avataaars/svg?seed=${guess.user.uniqueId}`}
                  alt=""
                  style={{ width: '24px', height: '24px', borderRadius: '50%', border: '1.5px solid rgba(255,255,255,0.15)', objectFit: 'cover', flexShrink: 0 }}
                  onError={(e) => { e.target.onerror = null; e.target.src = `https://api.dicebear.com/7.x/avataaars/svg?seed=${guess.user.uniqueId}`; }}
                />
                <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.6rem', fontWeight: '600', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '80px' }}>
                  @{guess.user.nickname || guess.user.uniqueId}
                </span>
                <span style={{ color: '#fff', fontSize: '0.8rem', fontWeight: '800', textTransform: 'uppercase', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
                  {guess.player.name}
                </span>
                {guess.isCorrect && <Trophy size={14} color="#10b981" />}
              </div>
              {/* Comparison row */}
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '3px' }}>
                {CATEGORIES.map(cat => renderCompareBox(guess.comparison[cat.key], cat))}
              </div>
            </div>
          ))}
        </div>

      </div>
    </div>
  );
}
