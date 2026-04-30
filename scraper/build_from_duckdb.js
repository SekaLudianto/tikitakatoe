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
  
  console.log('⏳ Mencari Top 100 Klub berdasarkan Market Value...');
  const clubsQuery = `
    SELECT club_id, name, total_market_value 
    FROM clubs 
    ORDER BY total_market_value DESC NULLS LAST 
    LIMIT 100
  `;
  const rawClubs = await runQuery(conn, clubsQuery);
  
  let rank = 1;
  const clubTiers = {};
  for (const c of rawClubs) {
    TOP_CLUB_IDS[c.club_id] = shortenClubName(c.club_id, c.name);
    if (EASY_CLUB_IDS.includes(c.club_id)) {
      clubTiers[c.club_id] = 'easy';
    } else if (rank <= 50) {
      clubTiers[c.club_id] = 'medium';
    } else {
      clubTiers[c.club_id] = 'hard';
    }
    rank++;
  }
  
  const topClubIdsList = Object.keys(TOP_CLUB_IDS).map(id => `'${id}'`).join(',');
  
  console.log('⏳ Mengambil data pemain dari DuckDB (SQL Query)...');
  
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
  
  console.log(`✅ Berhasil mengambil ${rawPlayers.length} pemain top!`);
  console.log('\n⚙️ Membangun database game...');

  const gamePlayers = [];
  for (const row of rawPlayers) {
    const clubsArr = Array.isArray(row.club_ids) ? row.club_ids : row.club_ids.split(',');
    
    // Kita filter lagi karena DuckDB mungkin mereturn semua club_ids, kita cuma butuh yg top
    const validClubs = clubsArr
      .map(Number)
      .filter(id => TOP_CLUB_IDS[id])
      .map(id => ({
        id,
        name: TOP_CLUB_IDS[id]
      }));

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
