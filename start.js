const { spawn } = require('child_process');

const username = process.argv[2];

if (!username) {
  console.error('\n❌ ERROR: Please provide a TikTok username.');
  console.error('👉 Usage: npm start <username>\n');
  process.exit(1);
}

console.log(`\n🚀 Starting Tiki Taka Toe for TikTok Live: @${username}...`);
console.log('=======================================================\n');

// 1. Start Backend Server
console.log('⚙️ Starting Backend Server...');
const backend = spawn('node', ['server.js', username], { stdio: 'inherit', shell: true });

// 2. Start Frontend Vite Server
console.log('🎨 Starting Frontend Server...');
const frontend = spawn('npm', ['run', 'dev'], { cwd: './frontend', stdio: 'inherit', shell: true });

// Handle graceful shutdown
const shutdown = () => {
  console.log('\n🛑 Shutting down servers...');
  backend.kill('SIGINT');
  frontend.kill('SIGINT');
  process.exit(0);
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
