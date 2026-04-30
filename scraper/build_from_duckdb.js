const duckdb = require('duckdb');
const fs = require('fs');
const path = require('path');

const TOP_COUNTRIES = [
  // South America
  'Brazil', 'Argentina', 'Colombia', 'Uruguay', 'Ecuador', 'Chile', 'Peru',
  // Europe
  'France', 'Germany', 'Spain', 'England', 'Portugal', 'Italy', 'Netherlands', 
  'Belgium', 'Croatia', 'Switzerland', 'Denmark', 'Austria', 'Turkey', 'Wales', 'Scotland', 'Serbia', 'Poland', 'Sweden',
  // Africa
  'Nigeria', 'Senegal', 'Morocco', 'Ghana', 'Ivory Coast', 'Cameroon', 'Algeria', 'Egypt',
  // Asia & CONCACAF
  'Japan', 'South Korea', 'USA', 'Mexico', 'Canada', 'Australia'
];

const CLUB_ALIASES = {
  12: 'AS Roma',
  5: 'AC Milan',
  46: 'Inter Milan',
  506: 'Juventus',
  6195: 'Napoli',
  398: 'Lazio',
  430: 'Fiorentina',
  800: 'Atalanta',
  418: 'Real Madrid',
  131: 'FC Barcelona',
  13: 'Atlético Madrid',
  1050: 'Villarreal',
  150: 'Real Betis',
  368: 'Sevilla',
  1049: 'Valencia',
  621: 'Athletic Bilbao',
  681: 'Real Sociedad',
  148: 'Tottenham Hotspur',
  31: 'Liverpool',
  11: 'Arsenal',
  281: 'Manchester City',
  985: 'Manchester United',
  631: 'Chelsea',
  762: 'Newcastle United',
  405: 'Aston Villa',
  29: 'Everton',
  379: 'West Ham United',
  27: 'Bayern Munich',
  16: 'Borussia Dortmund',
  15: 'Bayer Leverkusen',
  23826: 'RB Leipzig',
  79: 'VfB Stuttgart',
  583: 'Paris Saint-Germain',
  244: 'Marseille',
  1041: 'Olympique Lyon',
  162: 'AS Monaco',
  610: 'Ajax',
  383: 'PSV Eindhoven',
  234: 'Feyenoord',
  294: 'Benfica',
  720: 'FC Porto',
  336: 'Sporting CP',
  141: 'Galatasaray',
  36: 'Fenerbahce',
  114: 'Besiktas',
  371: 'Celtic',
  124: 'Rangers',
  189: 'Boca Juniors',
  209: 'River Plate'
};

function shortenClubName(id, officialName) {
  if (CLUB_ALIASES[id]) return CLUB_ALIASES[id];
  
  let name = officialName;
  name = name.replace('Football Club', 'FC');
  name = name.replace('Club de Fútbol', 'CF');
  name = name.replace('Associazione Calcio', 'AC');
  name = name.replace('Associazione Sportiva', 'AS');
  name = name.replace('Società Sportiva', 'SS');
  name = name.replace('Fútbol Club', 'FC');
  name = name.replace('Olympique de ', '');
  name = name.replace('Olympique ', '');
  
  return name.trim();
}

// Kita akan mengambil TOP 100 klub secara dinamis dari DuckDB
let TOP_CLUB_IDS = {};

const TOP_POSITIONS = ['Attack', 'Midfield', 'Defender', 'Goalkeeper'];
const OUTPUT_DIR = path.join(__dirname, '..', 'data');

// Promisify duckdb query
function runQuery(conn, sql) {
  return new Promise((resolve, reject) => {
    conn.all(sql, (err, res) => {
      if (err) reject(err);
      else resolve(res);
    });
  });
}

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

const EASY_CLUB_IDS = [418, 131, 13, 985, 281, 11, 631, 31, 148, 27, 16, 583, 506, 5, 46, 6195];
const EASY_COUNTRIES = ['Brazil', 'Argentina', 'France', 'Germany', 'Spain', 'England', 'Portugal', 'Italy', 'Netherlands'];

function generateSampleGrids(db, countPerDifficulty = 50) {
  const result = { easy: [], medium: [], hard: [] };

  for (const difficulty of ['easy', 'medium', 'hard']) {
    let allowedClubs;
    if (difficulty === 'easy') {
      allowedClubs = db.clubs.filter(c => c.tier === 'easy' && c.pairCount >= 5);
    } else if (difficulty === 'medium') {
      allowedClubs = db.clubs.filter(c => (c.tier === 'easy' || c.tier === 'medium') && c.pairCount >= 5);
    } else {
      allowedClubs = db.clubs.filter(c => c.pairCount >= 5);
    }

    if (allowedClubs.length < 5) continue;

    for (let g = 0; g < countPerDifficulty; g++) {
      for (let attempt = 0; attempt < 100; attempt++) {
        const shuffledClubs = [...allowedClubs].sort(() => Math.random() - 0.5);
        const rows = shuffledClubs.slice(0, 3).map(c => ({ type: 'club', ...c }));
        
        const colTypes = ['club', 'country', 'position'].sort(() => Math.random() - 0.5);
        const cols = [];
        for (const type of colTypes) {
          if (type === 'club') {
            cols.push({ type: 'club', ...shuffledClubs.slice(3)[Math.floor(Math.random() * 5)], logoUrl: undefined });
          } else if (type === 'country') {
            let allowedCountries = db.countries;
            if (difficulty === 'easy') {
              allowedCountries = db.countries.filter(c => EASY_COUNTRIES.includes(c));
            }
            const country = allowedCountries[Math.floor(Math.random() * allowedCountries.length)];
            const code = COUNTRY_CODES[country] || 'un';
            cols.push({ type: 'country', id: country, name: country, logoUrl: `/flags/${code}.png` });
          } else if (type === 'position') {
            const pos = db.positions[Math.floor(Math.random() * db.positions.length)];
            const posText = pos === 'Goalkeeper' ? 'GK' : pos === 'Defender' ? 'DEF' : pos === 'Midfield' ? 'MID' : 'ATT';
            cols.push({ type: 'position', id: pos, name: pos, textLogo: posText });
          }
        }
        
        if (rows.length < 3 || cols.length < 3) continue;
        
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
              sampleAnswers: answers.map(a => ({
                name: a.name,
                imageUrl: a.imageUrl
              })),
            });
          }
          if (!valid) break;
        }
        
        if (valid) {
          result[difficulty].push({
            difficulty,
            rows: rows.map(r => ({
              type: r.type, id: r.id, name: r.name, logoUrl: `/logos/${r.id}.png`
            })),
            cols: cols.map(c => ({
              type: c.type, id: c.id, name: c.name, logoUrl: c.type === 'club' ? `/logos/${c.id}.png` : c.logoUrl, textLogo: c.textLogo
            })),
            cells,
          });
          break;
        }
      }
    }
  }
  return result;
}

async function main() {
  console.log('🎮 Tiki Taka Toe - DuckDB Data Builder\n');
  const dbPath = path.join(__dirname, 'transfermarkt-datasets.duckdb');
  
  if (!fs.existsSync(dbPath)) {
    console.error(`❌ File ${dbPath} tidak ditemukan! Harap download terlebih dahulu.`);
    process.exit(1);
  }

  const db = new duckdb.Database(dbPath);
  const conn = db.connect();
  
  console.log('⏳ Mencari Top 100 Klub berdasarkan data penampilan...');
  const clubsQuery = `
    SELECT c.club_id, c.name, COUNT(a.appearance_id) as app_count
    FROM clubs c
    JOIN appearances a ON c.club_id = a.player_club_id
    GROUP BY c.club_id, c.name
    ORDER BY app_count DESC
    LIMIT 100
  `;
  const rawClubs = await runQuery(conn, clubsQuery);
  
  let rank = 1;
  const clubTiers = {};
  for (const c of rawClubs) {
    TOP_CLUB_IDS[c.club_id] = shortenClubName(c.club_id, c.name);
    if (EASY_CLUB_IDS.includes(parseInt(c.club_id))) {
      clubTiers[c.club_id] = 'easy';
    } else if (rank <= 50) {
      clubTiers[c.club_id] = 'medium';
    } else {
      clubTiers[c.club_id] = 'hard';
    }
    rank++;
  }
  
  const topClubIdsList = Object.keys(TOP_CLUB_IDS).map(id => `'${id}'`).join(',');
  
  // ==================== STEP 1: Build club name mapping ====================
  // player_valuations stores club names (not reliable IDs), so we need name→ID mapping
  console.log('⏳ Building club name mapping...');
  const clubNameRows = await runQuery(conn, `SELECT club_id, name FROM clubs WHERE club_id IN (${topClubIdsList})`);
  const clubNameToId = {};
  for (const row of clubNameRows) {
    const id = parseInt(row.club_id);
    clubNameToId[row.name.toLowerCase().trim()] = id;
    // Also add the short alias
    if (TOP_CLUB_IDS[id]) clubNameToId[TOP_CLUB_IDS[id].toLowerCase().trim()] = id;
  }
  // Common name variations found in player_valuations
  const NAME_VARIATIONS = {
    'fc internazionale': 46, 'inter': 46, 'inter mailand': 46, 'internazionale': 46,
    'ajax amsterdam': 610, 'ajax': 610,
    'ogc nice': 417, 'nice': 417,
    'fc barcelona': 131, 'barcelona': 131, 'barça': 131,
    'real madrid cf': 418, 'real madrid': 418,
    'atletico madrid': 13, 'atlético de madrid': 13, 'atletico de madrid': 13,
    'manchester united': 985, 'man united': 985, 'man utd': 985,
    'manchester city': 281, 'man city': 281,
    'tottenham hotspur': 148, 'tottenham': 148, 'spurs': 148,
    'paris saint-germain': 583, 'paris sg': 583, 'psg': 583,
    'bayern munich': 27, 'fc bayern münchen': 27, 'bayern münchen': 27, 'bayern': 27,
    'borussia dortmund': 16, 'bvb': 16, 'dortmund': 16,
    'bayer leverkusen': 15, 'bayer 04 leverkusen': 15, 'leverkusen': 15,
    'rb leipzig': 23826, 'rasenballsport leipzig': 23826,
    'ac milan': 5, 'milan': 5, 'ac mailand': 5,
    'as roma': 12, 'roma': 12, 'as rom': 12,
    'juventus': 506, 'juventus fc': 506, 'juventus turin': 506,
    'napoli': 6195, 'ssc napoli': 6195, 'ssc neapel': 6195,
    'lazio': 398, 'ss lazio': 398, 'lazio rom': 398,
    'fiorentina': 430, 'ac fiorentina': 430, 'acf fiorentina': 430,
    'atalanta': 800, 'atalanta bergamo': 800, 'atalanta bc': 800,
    'liverpool': 31, 'liverpool fc': 31,
    'arsenal': 11, 'arsenal fc': 11,
    'chelsea': 631, 'chelsea fc': 631,
    'everton': 29, 'everton fc': 29,
    'newcastle united': 762, 'newcastle': 762,
    'west ham united': 379, 'west ham': 379,
    'aston villa': 405,
    'galatasaray': 141, 'galatasaray sk': 141, 'galatasaray istanbul': 141,
    'fenerbahce': 36, 'fenerbahçe': 36, 'fenerbahçe sk': 36, 'fenerbahce sk': 36,
    'besiktas': 114, 'beşiktaş': 114, 'besiktas jk': 114, 'beşiktaş jk': 114,
    'benfica': 294, 'sl benfica': 294, 'benfica lissabon': 294,
    'fc porto': 720, 'porto': 720,
    'sporting cp': 336, 'sporting lissabon': 336, 'sporting clube de portugal': 336, 'sporting lisbon': 336,
    'ajax amsterdam': 610, 'afc ajax': 610,
    'psv eindhoven': 383, 'psv': 383,
    'feyenoord': 234, 'feyenoord rotterdam': 234,
    'celtic': 371, 'celtic fc': 371, 'celtic glasgow': 371,
    'rangers': 124, 'rangers fc': 124, 'glasgow rangers': 124,
    'sevilla': 368, 'sevilla fc': 368, 'fc sevilla': 368,
    'villarreal': 1050, 'villarreal cf': 1050,
    'real betis': 150, 'real betis balompié': 150, 'betis sevilla': 150,
    'valencia': 1049, 'valencia cf': 1049,
    'real sociedad': 681, 'real sociedad san sebastián': 681,
    'athletic bilbao': 621, 'athletic club': 621,
    'marseille': 244, 'olympique marseille': 244, 'olympique de marseille': 244, 'om': 244,
    'olympique lyon': 1041, 'olympique lyonnais': 1041, 'lyon': 1041,
    'as monaco': 162, 'monaco': 162,
    'torino': 416, 'torino fc': 416,
    'udinese': 410, 'udinese calcio': 410,
    'bologna': 1025, 'bologna fc': 1025,
    'sassuolo': 6574, 'us sassuolo': 6574,
  };
  Object.assign(clubNameToId, NAME_VARIATIONS);

  function matchClubName(name) {
    if (!name) return null;
    const lower = name.toLowerCase().trim();
    if (clubNameToId[lower]) return clubNameToId[lower];
    // Partial match: check if known name is contained
    for (const [knownName, id] of Object.entries(clubNameToId)) {
      if (knownName.length >= 4 && (lower.includes(knownName) || knownName.includes(lower))) {
        return id;
      }
    }
    return null;
  }

  // ==================== STEP 2: Query appearances (primary) ====================
  console.log('⏳ Mengambil data pemain dari appearances...');
  const query = `
    SELECT 
      p.player_id, 
      p.name, 
      p.country_of_citizenship as country, 
      p.position, 
      p.image_url as imageUrl, 
      LIST(DISTINCT a.player_club_id) as club_ids
    FROM players p
    JOIN appearances a ON p.player_id = a.player_id
    WHERE a.player_club_id IN (${topClubIdsList})
    GROUP BY p.player_id, p.name, p.country_of_citizenship, p.position, p.image_url
  `;
  const rawPlayers = await runQuery(conn, query);
  console.log(`   ✅ ${rawPlayers.length} pemain dari appearances`);

  // ==================== STEP 3: Query player_valuations (fills pre-2012 gaps) ====================
  console.log('⏳ Mengambil riwayat klub dari player_valuations (data dari 2004+)...');
  const pvQuery = `
    SELECT DISTINCT player_id, current_club_name 
    FROM player_valuations 
    WHERE current_club_name IS NOT NULL
  `;
  const pvRows = await runQuery(conn, pvQuery);
  const pvPlayerClubs = {}; // player_id -> Set<club_id>
  let pvMatched = 0;
  for (const row of pvRows) {
    const clubId = matchClubName(row.current_club_name);
    if (clubId && TOP_CLUB_IDS[clubId]) {
      if (!pvPlayerClubs[row.player_id]) pvPlayerClubs[row.player_id] = new Set();
      pvPlayerClubs[row.player_id].add(clubId);
      pvMatched++;
    }
  }
  console.log(`   ✅ ${pvMatched} klub-pemain pairs dari valuations (${Object.keys(pvPlayerClubs).length} pemain)`);

  // ==================== STEP 4: Query transfers ====================
  console.log('⏳ Mengambil data transfer...');
  const trQuery = `
    SELECT player_id, from_club_id, to_club_id 
    FROM transfers 
    WHERE from_club_id IN (${topClubIdsList}) OR to_club_id IN (${topClubIdsList})
  `;
  const trRows = await runQuery(conn, trQuery);
  const trPlayerClubs = {}; // player_id -> Set<club_id>
  for (const row of trRows) {
    if (!trPlayerClubs[row.player_id]) trPlayerClubs[row.player_id] = new Set();
    const fromId = parseInt(row.from_club_id);
    const toId = parseInt(row.to_club_id);
    if (TOP_CLUB_IDS[fromId]) trPlayerClubs[row.player_id].add(fromId);
    if (TOP_CLUB_IDS[toId]) trPlayerClubs[row.player_id].add(toId);
  }
  console.log(`   ✅ ${trRows.length} transfer records (${Object.keys(trPlayerClubs).length} pemain)`);

  // ==================== STEP 5: Fetch additional players not in appearances ====================
  const existingIds = new Set(rawPlayers.map(r => r.player_id));
  const extraIds = new Set();
  for (const pid of Object.keys(pvPlayerClubs)) { if (!existingIds.has(parseInt(pid))) extraIds.add(parseInt(pid)); }
  for (const pid of Object.keys(trPlayerClubs)) { if (!existingIds.has(parseInt(pid))) extraIds.add(parseInt(pid)); }
  
  if (extraIds.size > 0) {
    console.log(`⏳ Mengambil ${extraIds.size} pemain tambahan dari valuations/transfers...`);
    // Query in batches to avoid too-long SQL
    const extraIdArr = [...extraIds];
    for (let i = 0; i < extraIdArr.length; i += 500) {
      const batch = extraIdArr.slice(i, i + 500);
      const extraQuery = `
        SELECT player_id, name, country_of_citizenship as country, position, image_url as imageUrl
        FROM players WHERE player_id IN (${batch.join(',')})
      `;
      const extraPlayers = await runQuery(conn, extraQuery);
      for (const ep of extraPlayers) {
        rawPlayers.push({ ...ep, club_ids: [] });
      }
    }
    console.log(`   ✅ Total pemain sekarang: ${rawPlayers.length}`);
  }

  // ==================== STEP 6: Merge all sources & build gamePlayers ====================
  console.log('\n⚙️ Membangun database game (merged from 3 sources)...');

  const gamePlayers = [];
  for (const row of rawPlayers) {
    const allClubIds = new Set();

    // From appearances
    const clubsArr = Array.isArray(row.club_ids) ? row.club_ids : 
      (typeof row.club_ids === 'string' && row.club_ids ? row.club_ids.split(',') : []);
    for (const id of clubsArr.map(Number)) {
      if (TOP_CLUB_IDS[id]) allClubIds.add(id);
    }

    // From player_valuations
    if (pvPlayerClubs[row.player_id]) {
      for (const id of pvPlayerClubs[row.player_id]) allClubIds.add(id);
    }

    // From transfers
    if (trPlayerClubs[row.player_id]) {
      for (const id of trPlayerClubs[row.player_id]) allClubIds.add(id);
    }

    const validClubs = [...allClubIds].map(id => ({ id, name: TOP_CLUB_IDS[id] }));
    if (validClubs.length < 1) continue;

    gamePlayers.push({
      id: row.player_id,
      name: row.name || 'Unknown',
      country: row.country || '',
      position: row.position || '',
      imageUrl: row.imageUrl || '',
      clubs: validClubs
    });
  }

  const intersections = {};
  const countryIntersections = {};
  const positionIntersections = {};
  
  for (const player of gamePlayers) {
    const clubIds = player.clubs.map(c => c.id);
    
    // Club-Club
    for (let i = 0; i < clubIds.length; i++) {
      for (let j = i + 1; j < clubIds.length; j++) {
        const key = [clubIds[i], clubIds[j]].sort((a, b) => a - b).join('-');
        if (!intersections[key]) intersections[key] = [];
        intersections[key].push({ id: player.id, name: player.name, imageUrl: player.imageUrl });
      }
    }
    
    // Club-Country
    if (player.country && TOP_COUNTRIES.includes(player.country)) {
      for (const club of player.clubs) {
        const key = `${club.id}-country:${player.country}`;
        if (!countryIntersections[key]) countryIntersections[key] = [];
        countryIntersections[key].push({ id: player.id, name: player.name, imageUrl: player.imageUrl });
      }
    }
    
    // Club-Position
    if (player.position && TOP_POSITIONS.includes(player.position)) {
      for (const club of player.clubs) {
        const key = `${club.id}-position:${player.position}`;
        if (!positionIntersections[key]) positionIntersections[key] = [];
        positionIntersections[key].push({ id: player.id, name: player.name, imageUrl: player.imageUrl });
      }
    }
  }

  const clubAppearCount = {};
  for (const key of Object.keys(intersections)) {
    const [a, b] = key.split('-').map(Number);
    clubAppearCount[a] = (clubAppearCount[a] || 0) + 1;
    clubAppearCount[b] = (clubAppearCount[b] || 0) + 1;
  }
  
  const usableClubs = Object.keys(TOP_CLUB_IDS)
    .map(id => parseInt(id))
    .filter(id => clubAppearCount[id] && clubAppearCount[id] >= 3)
    .map(id => ({
      id,
      name: TOP_CLUB_IDS[id],
      pairCount: clubAppearCount[id],
      tier: clubTiers[id],
    }))
    .sort((a, b) => b.pairCount - a.pairCount);

  const gameDb = {
    meta: {
      source: 'transfermarkt-datasets (DuckDB)',
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

  if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  const dbPathOut = path.join(OUTPUT_DIR, 'tiki-taka-toe-db.json');
  fs.writeFileSync(dbPathOut, JSON.stringify(gameDb, null, 2));
  console.log(`\n💾 Tersimpan: ${dbPathOut} (${(fs.statSync(dbPathOut).size / 1024).toFixed(0)} KB)`);

  console.log('\n🧪 Generating 200 puzzle grids per difficulty...\n');
  const sampleGrids = generateSampleGrids(gameDb, 200);
  
  const gridsPath = path.join(OUTPUT_DIR, 'sample-grids.json');
  fs.writeFileSync(gridsPath, JSON.stringify(sampleGrids, null, 2));
  console.log(`💾 Tersimpan: ${gridsPath}`);
  
  const frontendDataDir = path.join(__dirname, '..', 'frontend', 'src', 'data');
  if (!fs.existsSync(frontendDataDir)) fs.mkdirSync(frontendDataDir, { recursive: true });
  fs.copyFileSync(gridsPath, path.join(frontendDataDir, 'sample-grids.json'));
  console.log(`📋 Disalin ke frontend/src/data/sample-grids.json`);
  
  console.log('\n✅ Selesai! Data game terbaru berhasil dibuat dari DuckDB.');
}

main().catch(err => {
  console.error('\n❌ Fatal error:', err.message);
  process.exit(1);
});
