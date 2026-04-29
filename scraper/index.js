/**
 * Transfermarkt Data Fetcher for Tiki Taka Toe
 * 
 * Downloads pre-scraped CSV datasets from transfermarkt-datasets (GitHub)
 * and processes them into a game-ready JSON format.
 * 
 * Data source: https://github.com/dcaribou/transfermarkt-datasets
 * License: CC0-1.0 (Public Domain)
 */

const axios = require('axios');
const { parse } = require('csv-parse/sync');
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

// Base URL for the transfermarkt-datasets CSV files
const BASE_URL = 'https://pub-e682421888d945d684bcae8890b0ec20.r2.dev/data';

// CSV files we need
const DATASETS = {
  players: `${BASE_URL}/players.csv.gz`,
  appearances: `${BASE_URL}/appearances.csv.gz`,
  clubs: `${BASE_URL}/clubs.csv.gz`,
  competitions: `${BASE_URL}/competitions.csv.gz`,
};

// Top clubs to focus on (most recognizable for the game)
const TOP_CLUB_IDS = {
  // England - Premier League
  281: 'Manchester City',
  985: 'Manchester United', 
  631: 'Chelsea',
  11: 'Arsenal',
  148: 'Tottenham Hotspur',
  31: 'Liverpool',
  405: 'Aston Villa',
  762: 'Newcastle United',
  29: 'Everton',
  379: 'West Ham United',
  
  // Spain - La Liga
  131: 'FC Barcelona',
  418: 'Real Madrid',
  13: 'Atlético Madrid',
  1049: 'Valencia',
  1050: 'Villarreal',
  150: 'Real Betis',
  368: 'Sevilla',
  621: 'Athletic Bilbao',
  681: 'Real Sociedad',
  
  // Germany - Bundesliga
  27: 'Bayern Munich',
  16: 'Borussia Dortmund',
  15: 'Bayer Leverkusen',
  23826: 'RB Leipzig',
  
  // Italy - Serie A
  506: 'Juventus',
  5: 'AC Milan',
  46: 'Inter Milan',
  6195: 'Napoli',
  12: 'AS Roma',
  398: 'Lazio',
  430: 'Fiorentina',
  
  // France - Ligue 1
  583: 'Paris Saint-Germain',
  244: 'Olympique Marseille',
  1041: 'Olympique Lyon',
  
  // Portugal
  294: 'Benfica',
  720: 'FC Porto',
  336: 'Sporting CP',
  
  // Netherlands
  610: 'Ajax',
  383: 'PSV Eindhoven',
  234: 'Feyenoord',
  
  // Others
  141: 'Galatasaray',
  36: 'Fenerbahce',
  114: 'Besiktas',
  371: 'Celtic',
  124: 'Rangers',
  189: 'Boca Juniors',
  209: 'River Plate'
};

// Countries for national team criteria
const TOP_COUNTRIES = [
  'Brazil', 'Argentina', 'France', 'Germany', 'Spain',
  'England', 'Portugal', 'Italy', 'Netherlands', 'Belgium',
  'Colombia', 'Uruguay', 'Croatia', 'Nigeria', 'Senegal',
  'Morocco', 'Ghana', 'Ivory Coast', 'Cameroon', 'Japan',
];

// Positions
const TOP_POSITIONS = ['Attack', 'Midfield', 'Defender', 'Goalkeeper'];

const RAW_DIR = path.join(__dirname, 'raw');
const OUTPUT_DIR = path.join(__dirname, '..', 'data');

// Ensure directories exist
[RAW_DIR, OUTPUT_DIR].forEach(dir => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

/**
 * Download a gzipped CSV file and parse it
 */
async function downloadAndParse(name, url) {
  const cacheFile = path.join(RAW_DIR, `${name}.csv`);
  
  // Check cache (re-download if older than 7 days)
  if (fs.existsSync(cacheFile)) {
    const stats = fs.statSync(cacheFile);
    const ageMs = Date.now() - stats.mtimeMs;
    const ageDays = ageMs / (1000 * 60 * 60 * 24);
    
    if (ageDays < 7) {
      console.log(`  ✅ Using cached ${name}.csv (${ageDays.toFixed(1)} days old)`);
      const content = fs.readFileSync(cacheFile, 'utf-8');
      return parse(content, { columns: true, skip_empty_lines: true, relax_column_count: true });
    }
  }
  
  console.log(`  ⬇️  Downloading ${name}.csv.gz ...`);
  
  try {
    const response = await axios.get(url, {
      responseType: 'arraybuffer',
      decompress: false, // we'll handle decompression ourselves
      headers: {
        'User-Agent': 'TikiTakaToe-DataBuilder/1.0',
      },
      timeout: 120000, // 2 min timeout
    });
    
    // Decompress gzip
    const buffer = Buffer.from(response.data);
    let content;
    try {
      const decompressed = zlib.gunzipSync(buffer);
      content = decompressed.toString('utf-8');
    } catch (e) {
      // Maybe it wasn't actually gzipped
      content = buffer.toString('utf-8');
    }
    
    fs.writeFileSync(cacheFile, content);
    console.log(`  ✅ Downloaded ${name}.csv (${(content.length / 1024 / 1024).toFixed(1)} MB)`);
    
    return parse(content, { columns: true, skip_empty_lines: true, relax_column_count: true });
  } catch (err) {
    console.error(`  ❌ Failed to download ${name}: ${err.message}`);
    
    // Fallback to cache if exists
    if (fs.existsSync(cacheFile)) {
      console.log(`  ⚠️  Using stale cache for ${name}`);
      const content = fs.readFileSync(cacheFile, 'utf-8');
      return parse(content, { columns: true, skip_empty_lines: true, relax_column_count: true });
    }
    
    throw err;
  }
}

/**
 * Build player -> clubs mapping from appearances data
 */
function buildPlayerClubMap(appearances, topClubIds) {
  const playerClubs = {}; // player_id -> Set of club_ids
  
  for (const app of appearances) {
    const playerId = app.player_id;
    const clubId = parseInt(app.player_club_id);
    
    if (!playerId || isNaN(clubId)) continue;
    if (!topClubIds.has(clubId)) continue;
    
    if (!playerClubs[playerId]) {
      playerClubs[playerId] = new Set();
    }
    playerClubs[playerId].add(clubId);
  }
  
  return playerClubs;
}

/**
 * Build the game database
 */
function buildGameDatabase(players, playerClubMap, clubsData) {
  const topClubIds = new Set(Object.keys(TOP_CLUB_IDS).map(Number));
  
  // Build club info lookup
  const clubInfo = {};
  for (const club of clubsData) {
    const id = parseInt(club.club_id);
    if (topClubIds.has(id)) {
      clubInfo[id] = {
        id,
        name: TOP_CLUB_IDS[id] || club.name || club.club_name,
        country: club.domestic_competition_id || '',
      };
    }
  }
  
  // Build player database - only players who played for 2+ top clubs
  const gamePlayers = [];
  
  for (const player of players) {
    const playerId = player.player_id;
    const clubs = playerClubMap[playerId];
    
    if (!clubs || clubs.size < 2) continue;
    
    const clubList = Array.from(clubs);
    
    gamePlayers.push({
      id: playerId,
      name: player.name || player.pretty_name || `${player.first_name} ${player.last_name}`,
      country: player.country_of_citizenship || player.nationality || '',
      position: player.position || player.sub_position || '',
      imageUrl: player.image_url || '',
      clubs: clubList.map(cid => ({
        id: cid,
        name: TOP_CLUB_IDS[cid] || clubInfo[cid]?.name || `Club ${cid}`,
      })),
    });
  }
  
  console.log(`\n📊 Stats:`);
  console.log(`  Total players with 2+ top clubs: ${gamePlayers.length}`);
  
  // Build intersection map: for each pair of clubs, list valid players
  const intersections = {};
  
  for (const player of gamePlayers) {
    const clubIds = player.clubs.map(c => c.id);
    
    // Generate all pairs
    for (let i = 0; i < clubIds.length; i++) {
      for (let j = i + 1; j < clubIds.length; j++) {
        const key = [clubIds[i], clubIds[j]].sort((a, b) => a - b).join('-');
        
        if (!intersections[key]) {
          intersections[key] = [];
        }
        intersections[key].push({
          id: player.id,
          name: player.name,
          country: player.country,
          imageUrl: player.imageUrl,
        });
      }
    }
  }
  
  // Also build country intersections: club + country
  const countryIntersections = {};
  
  for (const player of gamePlayers) {
    const country = player.country;
    if (!country || !TOP_COUNTRIES.includes(country)) continue;
    
    for (const club of player.clubs) {
      const key = `${club.id}-country:${country}`;
      
      if (!countryIntersections[key]) {
        countryIntersections[key] = [];
      }
      countryIntersections[key].push({
        id: player.id,
        name: player.name,
        imageUrl: player.imageUrl,
      });
    }
  }
  
  // Also build position intersections: club + position
  const positionIntersections = {};
  
  for (const player of gamePlayers) {
    const position = player.position;
    if (!position || !TOP_POSITIONS.includes(position)) continue;
    
    for (const club of player.clubs) {
      const key = `${club.id}-position:${position}`;
      
      if (!positionIntersections[key]) {
        positionIntersections[key] = [];
      }
      positionIntersections[key].push({
        id: player.id,
        name: player.name,
        imageUrl: player.imageUrl,
      });
    }
  }
  
  console.log(`  Club-Club intersections: ${Object.keys(intersections).length}`);
  console.log(`  Club-Country intersections: ${Object.keys(countryIntersections).length}`);
  console.log(`  Club-Position intersections: ${Object.keys(positionIntersections).length}`);
  
  // Get usable clubs (clubs that appear in enough intersections)
  const clubAppearCount = {};
  for (const key of Object.keys(intersections)) {
    const [a, b] = key.split('-').map(Number);
    clubAppearCount[a] = (clubAppearCount[a] || 0) + 1;
    clubAppearCount[b] = (clubAppearCount[b] || 0) + 1;
  }
  
  const usableClubs = Object.entries(clubAppearCount)
    .filter(([_, count]) => count >= 3) // club must pair with at least 3 other clubs
    .map(([id, count]) => ({
      id: parseInt(id),
      name: TOP_CLUB_IDS[parseInt(id)] || `Club ${id}`,
      pairCount: count,
    }))
    .sort((a, b) => b.pairCount - a.pairCount);
  
  console.log(`  Usable clubs (3+ pairings): ${usableClubs.length}`);
  
  return {
    meta: {
      source: 'transfermarkt-datasets',
      generatedAt: new Date().toISOString(),
      playerCount: gamePlayers.length,
      clubCount: usableClubs.length,
    },
    clubs: usableClubs,
    countries: TOP_COUNTRIES,
    positions: TOP_POSITIONS,
    players: gamePlayers,
    intersections,
    countryIntersections,
    positionIntersections,
  };
}

/**
 * Generate sample puzzle grids to verify data quality
 */
const COUNTRY_CODES = {
  'Brazil': 'br', 'Argentina': 'ar', 'France': 'fr', 'Germany': 'de', 'Spain': 'es',
  'England': 'gb-eng', 'Portugal': 'pt', 'Italy': 'it', 'Netherlands': 'nl', 'Belgium': 'be',
  'Colombia': 'co', 'Uruguay': 'uy', 'Croatia': 'hr', 'Nigeria': 'ng', 'Senegal': 'sn',
  'Morocco': 'ma', 'Ghana': 'gh', 'Ivory Coast': 'ci', 'Cameroon': 'cm', 'Japan': 'jp',
};

function generateSampleGrids(db, count = 5) {
  const grids = [];
  const clubs = db.clubs.filter(c => c.pairCount >= 5); // only well-connected clubs
  
  for (let g = 0; g < count; g++) {
    // Try to find a valid 3x3 grid
    for (let attempt = 0; attempt < 100; attempt++) {
      // Pick 3 random clubs for rows
      const shuffledClubs = [...clubs].sort(() => Math.random() - 0.5);
      const rows = shuffledClubs.slice(0, 3).map(c => ({ type: 'club', ...c }));
      
      // Determine column types (0: club, 1: country, 2: position)
      const colTypes = ['club', 'country', 'position'].sort(() => Math.random() - 0.5);
      
      const cols = [];
      for (const type of colTypes) {
        if (type === 'club') {
          cols.push({ type: 'club', ...shuffledClubs.slice(3)[Math.floor(Math.random() * 5)], logoUrl: undefined });
        } else if (type === 'country') {
          const country = db.countries[Math.floor(Math.random() * db.countries.length)];
          const code = COUNTRY_CODES[country] || 'un';
          cols.push({ type: 'country', id: country, name: country, logoUrl: `/flags/${code}.png` });
        } else if (type === 'position') {
          const pos = db.positions[Math.floor(Math.random() * db.positions.length)];
          const posText = pos === 'Goalkeeper' ? 'GK' : pos === 'Defender' ? 'DEF' : pos === 'Midfield' ? 'MID' : 'ATT';
          cols.push({ type: 'position', id: pos, name: pos, textLogo: posText });
        }
      }
      
      if (rows.length < 3 || cols.length < 3) continue;
      
      // Check all 9 cells have at least 1 valid answer
      let valid = true;
      const cells = [];
      
      for (const row of rows) {
        for (const col of cols) {
          let key;
          let answers;
          
          if (col.type === 'club') {
            key = [row.id, col.id].sort((a, b) => a - b).join('-');
            answers = db.intersections[key];
          } else if (col.type === 'country') {
            key = `${row.id}-country:${col.id}`;
            answers = db.countryIntersections[key];
          } else if (col.type === 'position') {
            key = `${row.id}-position:${col.id}`;
            answers = db.positionIntersections[key];
          }
          
          if (!answers || answers.length === 0) {
            valid = false;
            break;
          }
          
          cells.push({
            row: row.name,
            col: col.name,
            answerCount: answers.length,
            sampleAnswers: answers.slice(0, 5).map(a => ({
              name: a.name,
              imageUrl: a.imageUrl
            })),
          });
        }
        if (!valid) break;
      }
      
      if (valid) {
        grids.push({
          rows: rows.map(r => ({
            type: r.type,
            id: r.id,
            name: r.name,
            logoUrl: `/logos/${r.id}.png`
          })),
          cols: cols.map(c => ({
            type: c.type,
            id: c.id,
            name: c.name,
            logoUrl: c.type === 'club' ? `/logos/${c.id}.png` : c.logoUrl,
            textLogo: c.textLogo
          })),
          cells,
        });
        break;
      }
    }
  }
  
  return grids;
}

// ============== MAIN ==============
async function main() {
  console.log('🎮 Tiki Taka Toe - Transfermarkt Data Fetcher\n');
  console.log('📥 Step 1: Downloading datasets...\n');
  
  const [playersRaw, appearancesRaw, clubsRaw] = await Promise.all([
    downloadAndParse('players', DATASETS.players),
    downloadAndParse('appearances', DATASETS.appearances),
    downloadAndParse('clubs', DATASETS.clubs),
  ]);
  
  console.log(`\n📦 Raw data loaded:`);
  console.log(`  Players: ${playersRaw.length}`);
  console.log(`  Appearances: ${appearancesRaw.length}`);
  console.log(`  Clubs: ${clubsRaw.length}`);
  
  console.log('\n🔧 Step 2: Building player-club mappings...');
  
  const topClubIds = new Set(Object.keys(TOP_CLUB_IDS).map(Number));
  const playerClubMap = buildPlayerClubMap(appearancesRaw, topClubIds);
  
  console.log(`  Players with appearances at top clubs: ${Object.keys(playerClubMap).length}`);
  
  console.log('\n🎯 Step 3: Building game database...');
  
  const gameDb = buildGameDatabase(playersRaw, playerClubMap, clubsRaw);
  
  // Save full database
  const dbPath = path.join(OUTPUT_DIR, 'tiki-taka-toe-db.json');
  fs.writeFileSync(dbPath, JSON.stringify(gameDb, null, 2));
  console.log(`\n💾 Saved: ${dbPath} (${(fs.statSync(dbPath).size / 1024).toFixed(0)} KB)`);
  
  // Save lightweight version (for client-side use)
  const lightDb = {
    meta: gameDb.meta,
    clubs: gameDb.clubs,
    countries: gameDb.countries,
    intersections: {},
    countryIntersections: {},
  };
  
  // Only keep intersection keys and player names (not full objects)
  for (const [key, players] of Object.entries(gameDb.intersections)) {
    lightDb.intersections[key] = players.map(p => p.name);
  }
  for (const [key, players] of Object.entries(gameDb.countryIntersections)) {
    lightDb.countryIntersections[key] = players.map(p => p.name);
  }
  
  const lightPath = path.join(OUTPUT_DIR, 'tiki-taka-toe-light.json');
  fs.writeFileSync(lightPath, JSON.stringify(lightDb));
  console.log(`💾 Saved: ${lightPath} (${(fs.statSync(lightPath).size / 1024).toFixed(0)} KB)`);
  
  console.log('\n🖼️ Step 4: Downloading club logos & flags...');
  
  const logosDir = path.join(__dirname, '..', 'frontend', 'public', 'logos');
  const flagsDir = path.join(__dirname, '..', 'frontend', 'public', 'flags');
  [logosDir, flagsDir].forEach(d => { if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true }); });

  // Download club logos
  const allClubIds = Object.keys(TOP_CLUB_IDS).map(Number);
  let logoOk = 0, logoSkip = 0;
  for (const id of allClubIds) {
    const filePath = path.join(logosDir, `${id}.png`);
    if (fs.existsSync(filePath) && fs.statSync(filePath).size > 500) {
      logoSkip++;
      continue;
    }
    try {
      const url = `https://tmssl.akamaized.net/images/wappen/head/${id}.png`;
      const resp = await axios.get(url, { responseType: 'arraybuffer', timeout: 10000 });
      fs.writeFileSync(filePath, resp.data);
      logoOk++;
    } catch (e) {
      console.log(`  ⚠️ Failed to download logo for ${TOP_CLUB_IDS[id]} (${id})`);
    }
  }
  console.log(`  ✅ Logos: ${logoOk} downloaded, ${logoSkip} cached`);

  // Download country flags
  const COUNTRY_CODES = {
    'Brazil': 'br', 'Argentina': 'ar', 'France': 'fr', 'Germany': 'de', 'Spain': 'es',
    'England': 'gb-eng', 'Portugal': 'pt', 'Italy': 'it', 'Netherlands': 'nl', 'Belgium': 'be',
    'Colombia': 'co', 'Uruguay': 'uy', 'Croatia': 'hr', 'Nigeria': 'ng', 'Senegal': 'sn',
    'Morocco': 'ma', 'Ghana': 'gh', 'Ivory Coast': 'ci', 'Cameroon': 'cm', 'Japan': 'jp',
  };
  let flagOk = 0, flagSkip = 0;
  for (const [country, code] of Object.entries(COUNTRY_CODES)) {
    const filePath = path.join(flagsDir, `${code}.png`);
    if (fs.existsSync(filePath) && fs.statSync(filePath).size > 200) {
      flagSkip++;
      continue;
    }
    try {
      const url = `https://flagcdn.com/w80/${code}.png`;
      const resp = await axios.get(url, { responseType: 'arraybuffer', timeout: 10000 });
      fs.writeFileSync(filePath, resp.data);
      flagOk++;
    } catch (e) {
      console.log(`  ⚠️ Failed to download flag for ${country} (${code})`);
    }
  }
  console.log(`  ✅ Flags: ${flagOk} downloaded, ${flagSkip} cached`);

  // Generate sample grids
  console.log('\n🧪 Step 5: Generating sample puzzle grids...\n');
  const sampleGrids = generateSampleGrids(gameDb, 5);
  
  for (let i = 0; i < sampleGrids.length; i++) {
    const grid = sampleGrids[i];
    console.log(`  Grid ${i + 1}:`);
    console.log(`    Rows: ${grid.rows.join(' | ')}`);
    console.log(`    Cols: ${grid.cols.join(' | ')}`);
    console.log(`    Sample answers:`);
    for (const cell of grid.cells) {
      console.log(`      ${cell.row} ∩ ${cell.col}: ${cell.sampleAnswers.map(a => a.name).join(', ')} (${cell.answerCount} total)`);
    }
    console.log('');
  }
  
  const gridsPath = path.join(OUTPUT_DIR, 'sample-grids.json');
  fs.writeFileSync(gridsPath, JSON.stringify(sampleGrids, null, 2));
  console.log(`💾 Saved: ${gridsPath}`);
  
  // Copy to frontend
  const frontendDataDir = path.join(__dirname, '..', 'frontend', 'src', 'data');
  if (!fs.existsSync(frontendDataDir)) fs.mkdirSync(frontendDataDir, { recursive: true });
  fs.copyFileSync(gridsPath, path.join(frontendDataDir, 'sample-grids.json'));
  console.log(`📋 Copied to frontend/src/data/`);
  
  console.log('\n✅ Done! Data is ready for Tiki Taka Toe game.');
  console.log(`\n📁 Output files:`);
  console.log(`  ${dbPath}`);
  console.log(`  ${lightPath}`);
  console.log(`  ${gridsPath}`);
  console.log(`  ${logosDir}/ (${allClubIds.length} logos)`);
  console.log(`  ${flagsDir}/ (${Object.keys(COUNTRY_CODES).length} flags)`);
}

main().catch(err => {
  console.error('\n❌ Fatal error:', err.message);
  process.exit(1);
});
