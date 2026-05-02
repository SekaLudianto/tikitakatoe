const https = require('https');
const fs = require('fs');
const path = require('path');

const OUTPUT_DIR = path.join(__dirname, '..', 'frontend', 'public', 'logos', 'competitions');

const LEAGUES = {
  'mls1':  'https://tmssl.akamaized.net/images/logo/header/mls1.png',
  'sa1':   'https://tmssl.akamaized.net/images/logo/header/sa1.png',
  'jap1':  'https://tmssl.akamaized.net/images/logo/header/jap1.png',
  'bra1':  'https://tmssl.akamaized.net/images/logo/header/bra1.png',
  'arg1':  'https://tmssl.akamaized.net/images/logo/header/arg1.png',
  'mex1':  'https://tmssl.akamaized.net/images/logo/header/mex1.png',
  'aus1':  'https://tmssl.akamaized.net/images/logo/header/aus1.png',
  'rsk1':  'https://tmssl.akamaized.net/images/logo/header/rsk1.png',
};

function download(url, dest) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }, res => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return download(res.headers.location, dest).then(resolve).catch(reject);
      }
      if (res.statusCode !== 200) { res.resume(); return reject(new Error(`HTTP ${res.statusCode}`)); }
      const ws = fs.createWriteStream(dest);
      res.pipe(ws);
      ws.on('finish', () => { ws.close(); resolve(fs.statSync(dest).size); });
    }).on('error', reject);
  });
}

async function main() {
  if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  console.log('🏟️ Downloading non-European league logos...\n');
  for (const [id, url] of Object.entries(LEAGUES)) {
    const dest = path.join(OUTPUT_DIR, `${id}.png`);
    if (fs.existsSync(dest) && fs.statSync(dest).size > 500) {
      console.log(`✅ ${id} — already exists`);
      continue;
    }
    try {
      const size = await download(url, dest);
      console.log(`✅ ${id} — ${(size/1024).toFixed(1)} KB`);
    } catch (e) {
      console.log(`❌ ${id} — ${e.message}`);
    }
  }
  console.log('\n✅ Done!');
}
main();
