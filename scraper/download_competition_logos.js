/**
 * Download competition logos from public sources
 */
const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');

const OUTPUT_DIR = path.join(__dirname, '..', 'frontend', 'public', 'logos', 'competitions');

// Transfermarkt-style logo URLs (via tmssl CDN)
// Pattern: https://tmssl.akamaized.net/images/logo/header/{comp_id}.png
const COMPETITIONS = {
  'GB1': {
    name: 'Premier League',
    urls: [
      'https://tmssl.akamaized.net/images/logo/header/gb1.png',
      'https://crests.football-data.org/PL.png',
    ]
  },
  'ES1': {
    name: 'La Liga',
    urls: [
      'https://tmssl.akamaized.net/images/logo/header/es1.png',
      'https://crests.football-data.org/PD.png',
    ]
  },
  'IT1': {
    name: 'Serie A',
    urls: [
      'https://tmssl.akamaized.net/images/logo/header/it1.png',
      'https://crests.football-data.org/SA.png',
    ]
  },
  'L1': {
    name: 'Bundesliga',
    urls: [
      'https://tmssl.akamaized.net/images/logo/header/l1.png',
      'https://crests.football-data.org/BL1.png',
    ]
  },
  'FR1': {
    name: 'Ligue 1',
    urls: [
      'https://tmssl.akamaized.net/images/logo/header/fr1.png',
      'https://crests.football-data.org/FL1.png',
    ]
  },
  'CL': {
    name: 'Champions League',
    urls: [
      'https://tmssl.akamaized.net/images/logo/header/cl.png',
      'https://crests.football-data.org/CL.png',
    ]
  },
  'EL': {
    name: 'Europa League',
    urls: [
      'https://tmssl.akamaized.net/images/logo/header/el.png',
      'https://crests.football-data.org/EL.png',
    ]
  },
  'NL1': {
    name: 'Eredivisie',
    urls: [
      'https://tmssl.akamaized.net/images/logo/header/nl1.png',
      'https://crests.football-data.org/DED.png',
    ]
  },
  'PO1': {
    name: 'Liga Portugal',
    urls: [
      'https://tmssl.akamaized.net/images/logo/header/po1.png',
      'https://crests.football-data.org/PPL.png',
    ]
  },
  'TR1': {
    name: 'Süper Lig',
    urls: [
      'https://tmssl.akamaized.net/images/logo/header/tr1.png',
    ]
  },
};

function downloadFile(url, destPath) {
  return new Promise((resolve, reject) => {
    const protocol = url.startsWith('https') ? https : http;
    
    const request = protocol.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'image/*,*/*',
      }
    }, (response) => {
      // Follow redirects
      if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
        return downloadFile(response.headers.location, destPath).then(resolve).catch(reject);
      }
      
      if (response.statusCode !== 200) {
        reject(new Error(`HTTP ${response.statusCode} for ${url}`));
        response.resume();
        return;
      }

      const fileStream = fs.createWriteStream(destPath);
      response.pipe(fileStream);
      fileStream.on('finish', () => {
        fileStream.close();
        const size = fs.statSync(destPath).size;
        if (size < 500) { // Too small, probably an error page
          fs.unlinkSync(destPath);
          reject(new Error(`File too small (${size} bytes) for ${url}`));
        } else {
          resolve(size);
        }
      });
      fileStream.on('error', (err) => {
        fs.unlink(destPath, () => {});
        reject(err);
      });
    });
    
    request.on('error', reject);
    request.setTimeout(10000, () => {
      request.destroy();
      reject(new Error(`Timeout for ${url}`));
    });
  });
}

async function main() {
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  console.log('🏆 Downloading competition logos...\n');

  for (const [compId, info] of Object.entries(COMPETITIONS)) {
    const destPath = path.join(OUTPUT_DIR, `${compId.toLowerCase()}.png`);
    
    // Skip if already exists
    if (fs.existsSync(destPath)) {
      const size = fs.statSync(destPath).size;
      if (size > 500) {
        console.log(`✅ ${info.name} (${compId}) — already exists (${(size/1024).toFixed(1)} KB)`);
        continue;
      }
    }

    let downloaded = false;
    for (const url of info.urls) {
      try {
        const size = await downloadFile(url, destPath);
        console.log(`✅ ${info.name} (${compId}) — ${(size/1024).toFixed(1)} KB from ${new URL(url).hostname}`);
        downloaded = true;
        break;
      } catch (err) {
        console.log(`   ⚠️ Failed from ${url}: ${err.message}`);
      }
    }

    if (!downloaded) {
      console.log(`❌ ${info.name} (${compId}) — all sources failed`);
    }
  }

  console.log('\n✅ Done!');
}

main().catch(err => {
  console.error('❌ Fatal error:', err.message);
  process.exit(1);
});
