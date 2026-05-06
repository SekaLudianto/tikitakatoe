/**
 * BOX2BOX - Backend Server
 * 
 * Connects to a TikTok LIVE stream via tiktok-live-connector OR
 * listens to events from IndoFinity WebSocket relay on PC.
 * 
 * Reads chat comments, and broadcasts them to the frontend
 * via WebSocket so the game can process guesses in real-time.
 * 
 * Also provides an HTTP API for player validation against
 * the full tiki-taka-toe-db.json database.
 * 
 * Usage:
 *   node server.js <tiktok_username>                 (Direct TikTok)
 *   node server.js --indofinity <ws://IP:PORT>       (IndoFinity Relay)
 * 
 * Example:
 *   node server.js @cristiano
 *   node server.js --indofinity ws://192.168.1.5:62024
 */

const { WebcastPushConnection } = require('tiktok-live-connector');
const { WebSocketServer, WebSocket: WsClient } = require('ws');
const express = require('express');
const http = require('http');
const path = require('path');
const fs = require('fs');

// ==================== CONFIG ====================
const args = process.argv.slice(2);
const indofinityIdx = args.indexOf('--indofinity');
const INDOFINITY_MODE = indofinityIdx !== -1;
const INDOFINITY_URL = INDOFINITY_MODE ? (args[indofinityIdx + 1] || 'ws://localhost:62024') : null;
const TIKTOK_USERNAME = INDOFINITY_MODE ? '' : (args[0] || '');
const WS_PORT = 3001;

if (!INDOFINITY_MODE && !TIKTOK_USERNAME) {
  console.log('');
  console.log('⚽ BOX2BOX - TikTok Live Server');
  console.log('─'.repeat(40));
  console.log('');
  console.log('Usage:');
  console.log('  node server.js <tiktok_username>                (Direct TikTok)');
  console.log('  node server.js --indofinity <ws://IP:PORT>      (IndoFinity Relay)');
  console.log('');
  console.log('Example:');
  console.log('  node server.js @cristiano');
  console.log('  node server.js --indofinity ws://192.168.1.5:62024');
  console.log('');
  process.exit(1);
}

// Clean username (remove @ if present)
const username = INDOFINITY_MODE ? 'IndoFinity' : TIKTOK_USERNAME.replace('@', '');

// ==================== LOAD DATABASE ====================
console.log('📦 Loading player database...');
const dbPath = path.join(__dirname, 'data', 'tiki-taka-toe-db.json');
let db = null;
let playerIndex = {}; // normalized name -> player data array

function normalize(str) {
  return str.normalize('NFD')
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
}

try {
  const raw = fs.readFileSync(dbPath, 'utf-8');
  db = JSON.parse(raw);

  // Build a search index: normalized name parts -> player objects
  // This allows fast lookup by last name, full name, partial match
  for (const player of db.players) {
    const normalizedName = normalize(player.name);
    if (!playerIndex[normalizedName]) {
      playerIndex[normalizedName] = [];
    }
    playerIndex[normalizedName].push(player);

    // Also index by last name for quick lookup
    const parts = normalizedName.split(' ');
    if (parts.length > 1) {
      const lastName = parts[parts.length - 1];
      if (!playerIndex[lastName]) {
        playerIndex[lastName] = [];
      }
      playerIndex[lastName].push(player);
    }
  }

  console.log(`✅ Database loaded: ${db.players.length} players, ${Object.keys(db.intersections).length} club intersections`);
  console.log(`   Competitions: ${Object.keys(db.competitionIntersections || {}).length}, Jerseys: ${Object.keys(db.jerseyIntersections || {}).length}, Height: ${Object.keys(db.heightIntersections || {}).length}`);
} catch (err) {
  console.error('❌ Failed to load database:', err.message);
  process.exit(1);
}

/**
 * Validate a player guess against the full database.
 * 
 * @param {string} guess - The player name guessed
 * @param {object} header1 - First header { type: 'club'|'country'|'position', id: number|string, name: string }
 * @param {object} header2 - Second header { type: 'club'|'country'|'position', id: number|string, name: string }
 * @returns {object|null} - Matched player { id, name, imageUrl } or null
 */
function validateGuess(guess, header1, header2) {
  const searchName = normalize(guess);
  if (searchName.length < 3) return null;

  // Determine the intersection key and which lookup table to use
  let intersectionKey = null;
  let lookupTable = null;

  if (header1.type === 'club' && header2.type === 'club') {
    // Club x Club intersection - key is always sorted (min-max)
    const id1 = Number(header1.id);
    const id2 = Number(header2.id);
    intersectionKey = `${Math.min(id1, id2)}-${Math.max(id1, id2)}`;
    lookupTable = db.intersections;
  } else if (header1.type === 'club' && header2.type === 'country') {
    intersectionKey = `${header1.id}-country:${header2.name}`;
    lookupTable = db.countryIntersections;
  } else if (header1.type === 'country' && header2.type === 'club') {
    intersectionKey = `${header2.id}-country:${header1.name}`;
    lookupTable = db.countryIntersections;
  } else if (header1.type === 'club' && header2.type === 'position') {
    intersectionKey = `${header1.id}-position:${header2.name}`;
    lookupTable = db.positionIntersections;
  } else if (header1.type === 'position' && header2.type === 'club') {
    intersectionKey = `${header2.id}-position:${header1.name}`;
    lookupTable = db.positionIntersections;
  } else if (header1.type === 'club' && header2.type === 'competition') {
    intersectionKey = `${header1.id}-comp:${header2.id}`;
    lookupTable = db.competitionIntersections;
  } else if (header1.type === 'competition' && header2.type === 'club') {
    intersectionKey = `${header2.id}-comp:${header1.id}`;
    lookupTable = db.competitionIntersections;
  } else if (header1.type === 'club' && header2.type === 'jersey') {
    intersectionKey = `${header1.id}-jersey:${header2.id}`;
    lookupTable = db.jerseyIntersections;
  } else if (header1.type === 'jersey' && header2.type === 'club') {
    intersectionKey = `${header2.id}-jersey:${header1.id}`;
    lookupTable = db.jerseyIntersections;
  } else if (header1.type === 'club' && header2.type === 'height') {
    intersectionKey = `${header1.id}-height:${header2.id}`;
    lookupTable = db.heightIntersections;
  } else if (header1.type === 'height' && header2.type === 'club') {
    intersectionKey = `${header2.id}-height:${header1.id}`;
    lookupTable = db.heightIntersections;
  } else {
    // Any other combo: fallback to direct search
    return searchPlayersDirectly(searchName, header1, header2);
  }

  if (!lookupTable || !intersectionKey) return null;

  const candidates = lookupTable[intersectionKey];
  if (!candidates || candidates.length === 0) return null;

  // Search through candidates
  for (const candidate of candidates) {
    const normalizedName = normalize(candidate.name);
    const nameParts = normalizedName.split(' ');
    const lastName = nameParts[nameParts.length - 1];

    const isExactMatch = normalizedName === searchName || lastName === searchName;
    const isPartMatch = searchName.length >= 4 && nameParts.some(part => part === searchName);

    if (isExactMatch || isPartMatch) {
      return {
        id: candidate.id,
        name: candidate.name,
        imageUrl: candidate.imageUrl || null,
      };
    }
  }

  return null;
}

/**
 * Fallback: search all players directly for unusual header combinations.
 */
function searchPlayersDirectly(searchName, header1, header2) {
  for (const player of db.players) {
    const normalizedName = normalize(player.name);
    const nameParts = normalizedName.split(' ');
    const lastName = nameParts[nameParts.length - 1];

    const isExactMatch = normalizedName === searchName || lastName === searchName;
    const isPartMatch = searchName.length >= 4 && nameParts.some(part => part === searchName);

    const nameMatch = isExactMatch || isPartMatch;

    if (!nameMatch) continue;

    // Check if player matches both headers
    const matchesH1 = matchesHeader(player, header1);
    const matchesH2 = matchesHeader(player, header2);

    if (matchesH1 && matchesH2) {
      return {
        id: player.id,
        name: player.name,
        imageUrl: player.imageUrl || null,
      };
    }
  }
  return null;
}

function matchesHeader(player, header) {
  if (header.type === 'club') {
    return player.clubs && player.clubs.some(c => String(c.id) === String(header.id));
  } else if (header.type === 'country') {
    return player.country === header.name;
  } else if (header.type === 'position') {
    return player.position === header.name;
  } else if (header.type === 'height') {
    return player.height === header.id;
  } else if (header.type === 'competition' || header.type === 'jersey') {
    // These require cross-referencing with intersection data — fall through
    // Direct search for these is less reliable, so check intersection tables
    if (header.type === 'competition' && db.competitionIntersections) {
      return player.clubs && player.clubs.some(c => {
        const key = `${c.id}-comp:${header.id}`;
        const entries = db.competitionIntersections[key];
        return entries && entries.some(e => e.id === player.id);
      });
    }
    if (header.type === 'jersey' && db.jerseyIntersections) {
      return player.clubs && player.clubs.some(c => {
        const key = `${c.id}-jersey:${header.id}`;
        const entries = db.jerseyIntersections[key];
        return entries && entries.some(e => e.id === player.id);
      });
    }
  }
  return false;
}

// ==================== EXPRESS + WEBSOCKET SERVER ====================
const app = express();
app.use(express.json());

// API: Validate a player guess
app.post('/api/validate', (req, res) => {
  const { guess, header1, header2 } = req.body;

  if (!guess || !header1 || !header2) {
    return res.status(400).json({ error: 'Missing required fields: guess, header1, header2' });
  }

  const result = validateGuess(guess, header1, header2);

  if (result) {
    res.json({ match: true, player: result });
  } else {
    res.json({ match: false, player: null });
  }
});

// API: Health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    players: db.players.length,
    intersections: Object.keys(db.intersections).length,
    tiktokConnected,
    gridsLoaded: !!gridsData,
  });
});

// ==================== LOAD GRIDS ====================
let gridsData = { easy: [], medium: [], hard: [] };
const gridsDir = path.join(__dirname, 'data');

// Try loading per-difficulty files first (much faster, ~50-170MB each vs 523MB combined)
let loadedSplit = false;
for (const diff of ['easy', 'medium', 'hard']) {
  const splitPath = path.join(gridsDir, `grids-${diff}.json`);
  if (fs.existsSync(splitPath)) {
    try {
      console.log(`📦 Loading grids-${diff}.json...`);
      const raw = fs.readFileSync(splitPath, 'utf-8');
      gridsData[diff] = JSON.parse(raw);
      console.log(`   ✅ ${diff}: ${gridsData[diff].length} grids`);
      loadedSplit = true;
    } catch (err) {
      console.error(`   ⚠️ Failed to load grids-${diff}.json:`, err.message);
    }
  }
}

// Fallback: load combined file if split files not found
if (!loadedSplit) {
  const combinedPath = path.join(gridsDir, 'sample-grids.json');
  if (fs.existsSync(combinedPath)) {
    try {
      console.log('📦 Loading sample-grids.json (this may take a moment)...');
      const raw = fs.readFileSync(combinedPath, 'utf-8');
      gridsData = JSON.parse(raw);
      console.log(`✅ Grids loaded: Easy=${(gridsData.easy || []).length}, Medium=${(gridsData.medium || []).length}, Hard=${(gridsData.hard || []).length}`);
    } catch (err) {
      console.error('⚠️ Failed to load grids:', err.message);
      console.error('   Run "node scraper/build_from_duckdb.js" to generate grids');
    }
  } else {
    console.error('⚠️ No grid files found. Run menu option [3] to generate grids.');
  }
}

// API: Get a random grid by difficulty
app.get('/api/grid', (req, res) => {
  if (!gridsData) {
    return res.status(503).json({ error: 'Grids not loaded' });
  }
  const diff = req.query.difficulty || 'medium';
  const exclude = req.query.exclude ? req.query.exclude.split(',').map(Number) : [];
  const pool = gridsData[diff] || gridsData.medium || [];
  if (pool.length === 0) {
    return res.status(404).json({ error: `No grids for difficulty: ${diff}` });
  }

  let availableIndices = [];
  for (let i = 0; i < pool.length; i++) {
    if (!exclude.includes(i)) availableIndices.push(i);
  }
  // Reset if all played
  if (availableIndices.length === 0) {
    availableIndices = Array.from({ length: pool.length }, (_, i) => i);
  }

  const idx = availableIndices[Math.floor(Math.random() * availableIndices.length)];
  res.json({ grid: pool[idx], index: idx, total: pool.length });
});

// API: Get grid counts
app.get('/api/grid-counts', (req, res) => {
  if (!gridsData) {
    return res.status(503).json({ error: 'Grids not loaded' });
  }
  res.json({
    easy: (gridsData.easy || []).length,
    medium: (gridsData.medium || []).length,
    hard: (gridsData.hard || []).length,
  });
});

// Hardcoded Big Five European league club IDs for Who Am I target selection (2025/2026 season)
// Using exact Transfermarkt club IDs instead of league codes to avoid stale data from relegated clubs.
// NOTE: Update this list once per season after promotion/relegation is finalized.
const WHOAMI_VALID_CLUB_IDS = new Set([
  // === Premier League (GB1) - 20 clubs ===
  11,    // Arsenal
  405,   // Aston Villa
  989,   // AFC Bournemouth
  1148,  // Brentford
  1237,  // Brighton & Hove Albion
  1132,  // Burnley
  631,   // Chelsea
  873,   // Crystal Palace
  29,    // Everton
  931,   // Fulham
  399,   // Leeds United
  31,    // Liverpool
  281,   // Manchester City
  985,   // Manchester United
  762,   // Newcastle United
  703,   // Nottingham Forest
  289,   // Sunderland
  148,   // Tottenham Hotspur
  379,   // West Ham United
  543,   // Wolverhampton Wanderers

  // === La Liga (ES1) - 20 clubs ===
  1108,  // Deportivo Alavés
  621,   // Athletic Club Bilbao
  13,    // Atlético de Madrid
  131,   // FC Barcelona
  940,   // Celta de Vigo
  1531,  // Elche CF
  714,   // RCD Espanyol
  3709,  // Getafe CF
  12321, // Girona FC
  3368,  // Levante UD
  237,   // RCD Mallorca
  331,   // CA Osasuna
  367,   // Rayo Vallecano
  150,   // Real Betis
  418,   // Real Madrid
  2497,  // Real Oviedo
  681,   // Real Sociedad
  368,   // Sevilla FC
  1049,  // Valencia CF
  1050,  // Villarreal CF

  // === Serie A (IT1) - 20 clubs ===
  800,   // Atalanta
  1025,  // Bologna
  1390,  // Cagliari
  1047,  // Como
  2239,  // Cremonese
  430,   // Fiorentina
  252,   // Genoa
  276,   // Hellas Verona
  46,    // Inter Milan
  506,   // Juventus
  398,   // Lazio
  1005,  // Lecce
  5,     // AC Milan
  6195,  // Napoli
  130,   // Parma
  4172,  // Pisa
  12,    // AS Roma
  6574,  // Sassuolo
  416,   // Torino
  410,   // Udinese

  // === Bundesliga (L1) - 18 clubs ===
  167,   // FC Augsburg
  15,    // Bayer Leverkusen
  27,    // Bayern München
  16,    // Borussia Dortmund
  18,    // Borussia Mönchengladbach
  24,    // Eintracht Frankfurt
  60,    // SC Freiburg
  41,    // Hamburger SV
  2036,  // 1. FC Heidenheim
  533,   // TSG Hoffenheim
  3,     // 1. FC Köln
  23826, // RB Leipzig
  39,    // 1. FSV Mainz 05
  35,    // FC St. Pauli
  79,    // VfB Stuttgart
  89,    // 1. FC Union Berlin
  86,    // Werder Bremen
  82,    // VfL Wolfsburg

  // === Ligue 1 (FR1) - 18 clubs ===
  1420,  // Angers SCO
  290,   // AJ Auxerre
  3911,  // Stade Brestois 29
  738,   // Le Havre AC
  826,   // RC Lens
  1082,  // LOSC Lille
  1158,  // FC Lorient
  1041,  // Olympique Lyonnais
  244,   // Olympique de Marseille
  347,   // FC Metz
  162,   // AS Monaco
  995,   // FC Nantes
  417,   // OGC Nice
  10004, // Paris FC
  583,   // Paris Saint-Germain
  273,   // Stade Rennais
  667,   // RC Strasbourg Alsace
  415,   // Toulouse FC
]);

// Maximum number of top players for Who Am I pool (adjust as needed: 250, 500, etc.)
const WHOAMI_POOL_SIZE = 250;
const WHOAMI_MAX_AGE = 40;       // Exclude clearly retired players still in DB
const WHOAMI_MIN_SEASON = 2025;  // Only players with data from this season or later

// Pre-filter eligible players for Who Am I, then rank by market value (highest ever)
let whoamiEligiblePlayers = [];
if (db && db.players) {
  const candidates = db.players.filter(p =>
    p.currentClub &&
    p.currentClub.id &&
    WHOAMI_VALID_CLUB_IDS.has(p.currentClub.id) &&
    p.marketValue && p.marketValue > 0 &&
    p.lastSeason && p.lastSeason >= WHOAMI_MIN_SEASON &&
    p.age && p.age > 0 && p.age <= WHOAMI_MAX_AGE &&
    p.shirtNumber && p.shirtNumber > 0 &&
    p.detailedPosition
  );

  // Sort by market value descending, take top N
  candidates.sort((a, b) => b.marketValue - a.marketValue);
  whoamiEligiblePlayers = candidates.slice(0, WHOAMI_POOL_SIZE);

  const minValue = whoamiEligiblePlayers.length > 0
    ? `€${(whoamiEligiblePlayers[whoamiEligiblePlayers.length - 1].marketValue / 1e6).toFixed(0)}M`
    : 'N/A';
  console.log(`🕵️ Who Am I pool: top ${whoamiEligiblePlayers.length}/${candidates.length} players (min value: ${minValue})`);
}

// Track used players to avoid repeats until all have been shown
const whoamiUsedIds = new Set();

// API: Get random player for Who Am I (no repeats until all 250 exhausted)
app.get('/api/whoami/target', (req, res) => {
  if (whoamiEligiblePlayers.length === 0) {
    return res.status(503).json({ error: 'No eligible players' });
  }

  // Allow manual reset via ?reset=true
  if (req.query.reset === 'true') {
    whoamiUsedIds.clear();
  }

  // Reset if all players have been used
  if (whoamiUsedIds.size >= whoamiEligiblePlayers.length) {
    console.log(`🔄 Who Am I: all ${whoamiEligiblePlayers.length} players used, resetting pool`);
    whoamiUsedIds.clear();
  }

  // Pick from unused players only
  const available = whoamiEligiblePlayers.filter(p => !whoamiUsedIds.has(p.id));
  const random = available[Math.floor(Math.random() * available.length)];
  whoamiUsedIds.add(random.id);

  console.log(`🕵️ Who Am I target: ${random.name} (${whoamiUsedIds.size}/${whoamiEligiblePlayers.length} used)`);
  res.json(random);
});

// API: Search player by name for Who Am I
// Only searches within the eligible pool (top 250 players)
app.get('/api/whoami/search', (req, res) => {
  if (whoamiEligiblePlayers.length === 0) {
    return res.status(503).json({ error: 'No eligible players' });
  }
  const searchName = normalize(req.query.q || '');
  if (searchName.length < 3) return res.json({ player: null });

  const targetId = req.query.targetId ? Number(req.query.targetId) : null;

  // Helper: check if a player name matches the search query
  const nameMatches = (p) => {
    const normalizedName = normalize(p.name);
    const nameParts = normalizedName.split(' ');
    const lastName = nameParts[nameParts.length - 1];
    return normalizedName === searchName ||
      lastName === searchName ||
      (searchName.length >= 4 && nameParts.some(part => part === searchName));
  };

  // Priority 1: If targetId is provided, check if the guess matches the target player
  if (targetId) {
    const targetPlayer = whoamiEligiblePlayers.find(p => p.id === targetId);
    if (targetPlayer && nameMatches(targetPlayer)) {
      return res.json({ player: targetPlayer });
    }
  }

  // Priority 2: Search within eligible pool only
  const matchedPlayer = whoamiEligiblePlayers.find(nameMatches);
  res.json({ player: matchedPlayer || null });
});

const server = http.createServer(app);
const wss = new WebSocketServer({ server });

const clients = new Set();

wss.on('connection', (ws) => {
  clients.add(ws);
  console.log(`🔌 Frontend connected (${clients.size} total)`);

  // Send current connection status
  ws.send(JSON.stringify({
    type: 'status',
    connected: tiktokConnected,
    username: username,
    viewerCount: lastViewerCount,
  }));

  ws.on('close', () => {
    clients.delete(ws);
    console.log(`🔌 Frontend disconnected (${clients.size} remaining)`);
  });

  ws.on('message', (data) => {
    try {
      const msg = JSON.parse(data.toString());

      // Handle commands from frontend
      if (msg.type === 'newgrid') {
        console.log('🎮 Frontend requested new grid');
        broadcast({ type: 'newgrid_ack' });
      }

      // Allow injecting test chat messages (for testing without TikTok Live)
      if (msg.type === 'inject_chat') {
        console.log(`🧪 Injected chat: "${msg.comment}" from @${msg.user?.uniqueId || 'unknown'}`);
        broadcast({
          type: 'chat',
          comment: msg.comment,
          user: msg.user || { uniqueId: 'test', nickname: 'Test', profilePictureUrl: '' },
          timestamp: Date.now(),
        });
      }
    } catch (e) {
      // Ignore invalid messages
    }
  });
});

function broadcast(data) {
  const json = JSON.stringify(data);
  for (const client of clients) {
    if (client.readyState === 1) { // OPEN
      client.send(json);
    }
  }
}

// ==================== LIVE CONNECTOR ====================
let tiktokConnected = false;
let lastViewerCount = 0;
let tiktokLive = null;
let reconnectAttempts = 0;
const MAX_RECONNECT_DELAY = 60000; // Max 60 seconds between retries
const BASE_RECONNECT_DELAY = 5000; // Start at 5 seconds

console.log('');
console.log('⚽ BOX2BOX - TikTok Live Server');
console.log('─'.repeat(40));
if (INDOFINITY_MODE) {
  console.log(`🖥️ Mode: IndoFinity Relay`);
  console.log(`🔗 IndoFinity: ${INDOFINITY_URL}`);
} else {
  console.log(`📺 Target: @${username}`);
}
console.log(`🔗 WebSocket: ws://localhost:${WS_PORT}`);
console.log(`🌐 API: http://localhost:${WS_PORT}/api`);
console.log('');

function getReconnectDelay() {
  // Exponential backoff: 5s, 10s, 20s, 40s, 60s (max)
  const delay = Math.min(BASE_RECONNECT_DELAY * Math.pow(2, reconnectAttempts), MAX_RECONNECT_DELAY);
  return delay;
}

function connectToTikTok() {
  // Clean up previous connection if any
  if (tiktokLive) {
    try { tiktokLive.disconnect(); } catch (e) { }
  }

  tiktokLive = new WebcastPushConnection(username, {
    processInitialData: true,
    enableExtendedGiftInfo: false,
    enableWebsocketUpgrade: true,
    requestPollingIntervalMs: 2000,
    sessionId: undefined,
    clientParams: {
      app_language: 'en-US',
      device_platform: 'web',
    },
    requestHeaders: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    },
  });

  // ==================== EVENT HANDLERS ====================

  // 💬 Chat comments - THE MAIN EVENT for our game
  tiktokLive.on('chat', (data) => {
    const comment = data.comment;
    const user = {
      uniqueId: data.uniqueId,
      nickname: data.nickname,
      profilePictureUrl: data.profilePictureUrl,
      followRole: data.followRole,
      isModerator: data.isModerator,
      isSubscriber: data.isSubscriber,
    };

    console.log(`💬 @${user.uniqueId}: ${comment}`);

    broadcast({
      type: 'chat',
      comment: comment,
      user: user,
      timestamp: Date.now(),
    });
  });

  // 👋 Member join
  tiktokLive.on('member', (data) => {
    broadcast({
      type: 'member',
      uniqueId: data.uniqueId,
      nickname: data.nickname,
      timestamp: Date.now(),
    });
  });

  // 👀 Viewer count update
  tiktokLive.on('roomUser', (data) => {
    lastViewerCount = data.viewerCount;
    broadcast({
      type: 'viewerCount',
      count: data.viewerCount,
    });
  });

  // ❤️ Like
  tiktokLive.on('like', (data) => {
    broadcast({
      type: 'like',
      uniqueId: data.uniqueId,
      nickname: data.nickname,
      likeCount: data.likeCount,
      totalLikeCount: data.totalLikeCount,
    });
  });

  // 🎁 Gift
  tiktokLive.on('gift', (data) => {
    // Only process when the gift sequence ends (repeatEnd = true)
    if (data.giftType === 1 && !data.repeatEnd) return;

    console.log(`🎁 @${data.uniqueId} sent ${data.repeatCount}x ${data.giftName}`);

    broadcast({
      type: 'gift',
      uniqueId: data.uniqueId,
      nickname: data.nickname,
      giftName: data.giftName,
      giftId: data.giftId,
      repeatCount: data.repeatCount,
      diamondCount: data.diamondCount,
      timestamp: Date.now(),
    });
  });

  // 👤 Follow
  tiktokLive.on('follow', (data) => {
    console.log(`👤 @${data.uniqueId} followed!`);
    broadcast({
      type: 'follow',
      uniqueId: data.uniqueId,
      nickname: data.nickname,
    });
  });

  // 📡 Connection events — AUTO-RECONNECT
  tiktokLive.on('streamEnd', () => {
    console.log('📡 Stream ended');
    tiktokConnected = false;
    broadcast({ type: 'status', connected: false, reason: 'Stream ended' });
    scheduleReconnect();
  });

  tiktokLive.on('error', (err) => {
    console.error('⚠️ TikTok error:', err.message);
  });

  tiktokLive.on('disconnected', () => {
    console.log('📡 Disconnected from TikTok');
    tiktokConnected = false;
    broadcast({ type: 'status', connected: false, reason: 'Disconnected' });
    scheduleReconnect();
  });

  // Attempt connection
  console.log(`🔄 Connecting to @${username}'s LIVE...`);

  tiktokLive.connect()
    .then((state) => {
      tiktokConnected = true;
      reconnectAttempts = 0; // Reset on success
      console.log(`✅ Connected to @${username}'s LIVE!`);
      console.log(`   Room ID: ${state.roomId}`);
      console.log(`   Viewers: ${state.roomInfo?.stats?.total_user || 'N/A'}`);
      console.log('');
      console.log('💬 Listening for comments...');
      console.log('');

      broadcast({
        type: 'status',
        connected: true,
        username: username,
        roomId: state.roomId,
      });
    })
    .catch((err) => {
      console.error(`❌ Failed to connect: ${err.message}`);
      tiktokConnected = false;

      broadcast({
        type: 'status',
        connected: false,
        error: err.message,
      });

      scheduleReconnect();
    });
}

function scheduleReconnect() {
  const delay = getReconnectDelay();
  reconnectAttempts++;
  console.log(`🔄 Auto-reconnecting in ${delay / 1000}s... (attempt #${reconnectAttempts})`);

  broadcast({
    type: 'reconnecting',
    delay: delay,
    attempt: reconnectAttempts,
  });

  setTimeout(() => {
    if (INDOFINITY_MODE) {
      connectToIndoFinity();
    } else {
      connectToTikTok();
    }
  }, delay);
}

// ==================== INDOFINITY RELAY MODE ====================
let indofinityWs = null;
let indofinityReconnectTimer = null;

function connectToIndoFinity() {
  if (indofinityWs) {
    try { indofinityWs.close(); } catch (e) { }
  }

  console.log(`🔄 Connecting to IndoFinity at ${INDOFINITY_URL}...`);
  indofinityWs = new WsClient(INDOFINITY_URL);

  indofinityWs.on('open', () => {
    tiktokConnected = true;
    reconnectAttempts = 0;
    console.log(`✅ Connected to IndoFinity!`);
    console.log('');
    console.log('💬 Listening for events via IndoFinity...');
    console.log('');

    broadcast({
      type: 'status',
      connected: true,
      username: 'IndoFinity',
    });
  });

  indofinityWs.on('message', (raw) => {
    try {
      const message = JSON.parse(raw.toString());
      const { event, data: eventData } = message;

      if (event === 'chat') {
        const user = {
          uniqueId: eventData.uniqueId,
          nickname: eventData.nickname,
          profilePictureUrl: eventData.profilePictureUrl,
          followRole: eventData.followRole,
          isModerator: eventData.isModerator,
          isSubscriber: eventData.isSubscriber,
        };
        console.log(`💬 @${user.uniqueId}: ${eventData.comment}`);
        broadcast({
          type: 'chat',
          comment: eventData.comment,
          user: user,
          timestamp: Date.now(),
        });
      } else if (event === 'member') {
        broadcast({
          type: 'member',
          uniqueId: eventData.uniqueId,
          nickname: eventData.nickname,
          timestamp: Date.now(),
        });
      } else if (event === 'roomUser') {
        lastViewerCount = eventData.viewerCount || 0;
        broadcast({
          type: 'viewerCount',
          count: lastViewerCount,
        });
      } else if (event === 'like') {
        broadcast({
          type: 'like',
          uniqueId: eventData.uniqueId,
          nickname: eventData.nickname,
          likeCount: eventData.likeCount,
          totalLikeCount: eventData.totalLikeCount,
        });
      } else if (event === 'gift') {
        // Only process when the gift sequence ends (repeatEnd = true)
        if (eventData.giftType === 1 && !eventData.repeatEnd) return;

        console.log(`🎁 @${eventData.uniqueId} sent ${eventData.repeatCount}x ${eventData.giftName}`);
        broadcast({
          type: 'gift',
          uniqueId: eventData.uniqueId,
          nickname: eventData.nickname,
          giftName: eventData.giftName,
          giftId: eventData.giftId,
          repeatCount: eventData.repeatCount,
          diamondCount: eventData.diamondCount,
          timestamp: Date.now(),
        });
      } else if (event === 'follow') {
        console.log(`👤 @${eventData.uniqueId} followed!`);
        broadcast({
          type: 'follow',
          uniqueId: eventData.uniqueId,
          nickname: eventData.nickname,
        });
      } else if (event === 'streamEnd') {
        console.log('📡 Stream ended (via IndoFinity)');
        tiktokConnected = false;
        broadcast({ type: 'status', connected: false, reason: 'Stream ended' });
      }
      // Donation events from IndoFinity (saweria, sociabuzz, trakteer, etc.)
      else if (['saweria', 'sociabuzz', 'trakteer', 'tako', 'bagibagi', 'sibagi', 'tiptap'].includes(event)) {
        console.log(`💰 Donation via ${event}:`, eventData);
        broadcast({
          type: 'donation',
          platform: event,
          data: eventData,
          timestamp: Date.now(),
        });
      }
    } catch (e) {
      console.error('IndoFinity message parse error:', e.message);
    }
  });

  indofinityWs.on('close', () => {
    console.log('🔌 IndoFinity connection closed');
    tiktokConnected = false;
    broadcast({ type: 'status', connected: false, reason: 'IndoFinity disconnected' });
    scheduleReconnect();
  });

  indofinityWs.on('error', (err) => {
    console.error('⚠️ IndoFinity error:', err.message);
  });
}

// Initial connection — choose mode
if (INDOFINITY_MODE) {
  connectToIndoFinity();
} else {
  connectToTikTok();
}

// ==================== START SERVER ====================
server.listen(WS_PORT, () => {
  console.log(`🚀 Server running on http://localhost:${WS_PORT}`);
  console.log(`   WebSocket: ws://localhost:${WS_PORT}`);
  console.log(`   API:       http://localhost:${WS_PORT}/api/validate`);
  console.log('');
});

// ==================== CRASH PROTECTION ====================
process.on('uncaughtException', (err) => {
  console.error('💥 Uncaught Exception (server stays alive):', err.message);
  console.error('   Stack:', err.stack);
  // Don't exit — keep the HTTP/WS server running
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('💥 Unhandled Rejection (server stays alive):', reason);
  console.error('   Promise:', promise);
  // Don't exit — keep the HTTP/WS server running
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n👋 Shutting down...');
  if (tiktokLive) tiktokLive.disconnect();
  wss.close();
  server.close();
  process.exit(0);
});

