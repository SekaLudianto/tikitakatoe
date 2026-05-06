const { spawn } = require('child_process');

const args = process.argv.slice(2);

// Check for --indofinity mode
const indofinityIdx = args.indexOf('--indofinity');
const isIndofinity = indofinityIdx !== -1;
const indofinityUrl = isIndofinity ? (args[indofinityIdx + 1] || 'ws://localhost:62024') : null;
const username = isIndofinity ? null : args[0];

if (!isIndofinity && !username) {
  console.error('\n❌ ERROR: Please provide a TikTok username or use IndoFinity mode.');
  console.error('');
  console.error('👉 Usage:');
  console.error('   npm start <username>                           (Direct TikTok)');
  console.error('   npm start -- --indofinity <ws://IP:PORT>       (IndoFinity Relay)');
  console.error('');
  console.error('Example:');
  console.error('   npm start cristiano');
  console.error('   npm start -- --indofinity ws://192.168.1.5:62024');
  console.error('');
  process.exit(1);
}

if (isIndofinity) {
  console.log(`\n🖥️ Starting BOX2BOX via IndoFinity Relay: ${indofinityUrl}...`);
} else {
  console.log(`\n🚀 Starting Tiki Taka Toe for TikTok Live: @${username}...`);
}
console.log('=======================================================\n');

// 1. Start Backend Server
console.log('⚙️ Starting Backend Server...');
const backendArgs = isIndofinity 
  ? ['server.js', '--indofinity', indofinityUrl] 
  : ['server.js', username];
const backend = spawn('node', backendArgs, { stdio: 'inherit', shell: true });

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
