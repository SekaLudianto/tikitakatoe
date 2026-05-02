/**
 * BOX2BOX - Backend Server
 * 
 * Connects to a TikTok LIVE stream via tiktok-live-connector,
 * reads chat comments, and broadcasts them to the frontend
 * via WebSocket so the game can process guesses in real-time.
 * 
 * Also provides an HTTP API for player validation against
 * the full tiki-taka-toe-db.json database.
 * 
 * Usage:
 *   node server.js <tiktok_username>
 * 
 * Example:
 *   node server.js @cristiano
 */

const { WebcastPushConnection } = require('tiktok-live-connector');
const { WebSocketServer } = require('ws');
const express = require('express');
const http = require('http');
const path = require('path');
const fs = require('fs');

// ==================== CONFIG ====================
const TIKTOK_USERNAME = process.argv[2] || '';
const WS_PORT = 3001;

if (!TIKTOK_USERNAME) {
  console.log('');
  console.log('⚽ BOX2BOX - TikTok Live Server');
  console.log('─'.repeat(40));
  console.log('');
  console.log('Usage:');
  console.log('  node server.js <tiktok_username>');
  console.log('');
  console.log('Example:');
  console.log('  node server.js @cristiano');
  console.log('  node server.js cristiano');
  console.log('');
  process.exit(1);
}

// Clean username (remove @ if present)
const username = TIKTOK_USERNAME.replace('@', '');

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
  console.log(`   Competitions: ${Object.keys(db.competitionIntersections || {}).length}, Jerseys: ${Object.keys(db.jerseyIntersections || {}).length}, Foot: ${Object.keys(db.footIntersections || {}).length}`);
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
    // Club x Club intersection
    const id1 = Number(header1.id);
    const id2 = Number(header2.id);
    // Try both orderings since keys might be in either order
    intersectionKey = `${Math.min(id1, id2)}-${Math.max(id1, id2)}`;
    lookupTable = db.intersections;
    // Also try the original ordering
    if (!lookupTable[intersectionKey]) {
      intersectionKey = `${id1}-${id2}`;
    }
    if (!lookupTable[intersectionKey]) {
      intersectionKey = `${id2}-${id1}`;
    }
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
  } else if (header1.type === 'club' && header2.type === 'foot') {
    intersectionKey = `${header1.id}-foot:${header2.id}`;
    lookupTable = db.footIntersections;
  } else if (header1.type === 'foot' && header2.type === 'club') {
    intersectionKey = `${header2.id}-foot:${header1.id}`;
    lookupTable = db.footIntersections;
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
    const isPrefixMatch = searchName.length >= 4 && (
      nameParts.some(part => part === searchName) ||
      lastName.startsWith(searchName) ||
      normalizedName.startsWith(searchName)
    );

    if (isExactMatch || isPrefixMatch) {
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
    const isPrefixMatch = searchName.length >= 4 && (
      nameParts.some(part => part === searchName) ||
      lastName.startsWith(searchName) ||
      normalizedName.startsWith(searchName)
    );

    const nameMatch = isExactMatch || isPrefixMatch;

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
  } else if (header.type === 'foot') {
    return player.foot === header.id;
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
  });
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

// ==================== TIKTOK LIVE CONNECTOR ====================
let tiktokConnected = false;
let lastViewerCount = 0;
let tiktokLive = null;
let reconnectAttempts = 0;
const MAX_RECONNECT_DELAY = 60000; // Max 60 seconds between retries
const BASE_RECONNECT_DELAY = 5000; // Start at 5 seconds

console.log('');
console.log('⚽ BOX2BOX - TikTok Live Server');
console.log('─'.repeat(40));
console.log(`📺 Target: @${username}`);
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
    try { tiktokLive.disconnect(); } catch (e) {}
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
    connectToTikTok();
  }, delay);
}

// Initial connection
connectToTikTok();

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
  // Don't exit — keep the HTTP/WS server running
});

process.on('unhandledRejection', (reason) => {
  console.error('💥 Unhandled Rejection (server stays alive):', reason);
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

