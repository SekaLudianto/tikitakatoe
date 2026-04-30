const fs = require('fs');
const path = require('path');
const https = require('https');
const dbPath = path.join(__dirname, '..', 'data', 'tiki-taka-toe-db.json');

const COUNTRY_CODES = {
  'Brazil': 'br', 'Argentina': 'ar', 'France': 'fr', 'Germany': 'de', 'Spain': 'es',
  'England': 'gb-eng', 'Portugal': 'pt', 'Italy': 'it', 'Netherlands': 'nl', 'Belgium': 'be',
  'Colombia': 'co', 'Uruguay': 'uy', 'Croatia': 'hr', 'Nigeria': 'ng', 'Senegal': 'sn',
  'Morocco': 'ma', 'Ghana': 'gh', 'Ivory Coast': 'ci', 'Cameroon': 'cm', 'Japan': 'jp',
  'Ecuador': 'ec', 'Chile': 'cl', 'Peru': 'pe', 'Switzerland': 'ch', 'Denmark': 'dk',
  'Austria': 'at', 'Turkey': 'tr', 'Wales': 'gb-wls', 'Scotland': 'gb-sct', 'Serbia': 'rs',
  'Poland': 'pl', 'Sweden': 'se', 'Algeria': 'dz', 'Egypt': 'eg', 'South Korea': 'kr',
  'USA': 'us', 'Mexico': 'mx', 'Canada': 'ca', 'Australia': 'au'
};

const frontendPublic = path.join(__dirname, '..', 'frontend', 'public');
const logosDir = path.join(frontendPublic, 'logos');
const flagsDir = path.join(frontendPublic, 'flags');

if (!fs.existsSync(logosDir)) fs.mkdirSync(logosDir, { recursive: true });
if (!fs.existsSync(flagsDir)) fs.mkdirSync(flagsDir, { recursive: true });

function downloadImage(url, dest) {
  return new Promise((resolve) => {
    if (fs.existsSync(dest) && fs.statSync(dest).size > 100) {
      return resolve(true); // Already downloaded
    }
    https.get(url, (res) => {
      if (res.statusCode === 200) {
        const file = fs.createWriteStream(dest);
        res.pipe(file);
        file.on('finish', () => { file.close(); resolve(true); });
      } else {
        res.resume();
        resolve(false);
      }
    }).on('error', () => resolve(false));
  });
}

async function main() {
  const data = JSON.parse(fs.readFileSync(dbPath, 'utf8'));
  console.log(`Downloading logos for ${data.clubs.length} clubs...`);
  
  for (const club of data.clubs) {
    const url = `https://tmssl.akamaized.net/images/wappen/head/${club.id}.png`;
    const dest = path.join(logosDir, `${club.id}.png`);
    await downloadImage(url, dest);
  }
  
  console.log(`Downloading flags for ${data.countries.length} countries...`);
  for (const country of data.countries) {
    const code = COUNTRY_CODES[country];
    if (code) {
      const url = `https://flagcdn.com/w80/${code}.png`;
      const dest = path.join(flagsDir, `${code}.png`);
      await downloadImage(url, dest);
    }
  }
  
  console.log('✅ All assets downloaded successfully!');
}

main().catch(console.error);
