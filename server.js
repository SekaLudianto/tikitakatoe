/**
 * Tiki Taka Toe - Backend Server
 * 
 * Connects to a TikTok LIVE stream via tiktok-live-connector,
 * reads chat comments, and broadcasts them to the frontend
 * via WebSocket so the game can process guesses in real-time.
 * 
 * Usage:
 *   node server.js <tiktok_username>
 * 
 * Example:
 *   node server.js @cristiano
 */

const { WebcastPushConnection } = require('tiktok-live-connector');
const { WebSocketServer } = require('ws');
const http = require('http');

// ==================== CONFIG ====================
const TIKTOK_USERNAME = process.argv[2] || '';
const WS_PORT = 3001;

if (!TIKTOK_USERNAME) {
  console.log('');
  console.log('⚽ Tiki Taka Toe - TikTok Live Server');
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

// ==================== WEBSOCKET SERVER ====================
const server = http.createServer();
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

console.log('');
console.log('⚽ Tiki Taka Toe - TikTok Live Server');
console.log('─'.repeat(40));
console.log(`📺 Target: @${username}`);
console.log(`🔗 WebSocket: ws://localhost:${WS_PORT}`);
console.log('');

const tiktokLive = new WebcastPushConnection(username, {
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

// Connect to the TikTok LIVE stream
tiktokLive.connect()
  .then((state) => {
    tiktokConnected = true;
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
    console.log('');
    console.log('Common reasons:');
    console.log('  - User is not currently LIVE');
    console.log('  - Username is incorrect');
    console.log('  - TikTok is blocking the connection');
    console.log('');
    
    broadcast({
      type: 'status',
      connected: false,
      error: err.message,
    });
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

// 📡 Connection events
tiktokLive.on('streamEnd', () => {
  console.log('📡 Stream ended');
  tiktokConnected = false;
  broadcast({ type: 'status', connected: false, reason: 'Stream ended' });
});

tiktokLive.on('error', (err) => {
  console.error('⚠️ Error:', err.message);
});

tiktokLive.on('disconnected', () => {
  console.log('📡 Disconnected from TikTok');
  tiktokConnected = false;
  broadcast({ type: 'status', connected: false, reason: 'Disconnected' });
});

// ==================== START SERVER ====================
server.listen(WS_PORT, () => {
  console.log(`🚀 WebSocket server running on ws://localhost:${WS_PORT}`);
  console.log('');
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n👋 Shutting down...');
  tiktokLive.disconnect();
  wss.close();
  server.close();
  process.exit(0);
});
