/**
 * Enrich tiki-taka-toe-db.json with last_season from DuckDB.
 * This helps filter out retired/inactive players from Who Am I.
 */
const duckdb = require('duckdb');
const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, 'transfermarkt-datasets.duckdb');
const JSON_PATH = path.join(__dirname, '..', 'data', 'tiki-taka-toe-db.json');

async function main() {
  console.log('📦 Loading game database...');
  const gameDb = JSON.parse(fs.readFileSync(JSON_PATH, 'utf-8'));
  console.log(`   ${gameDb.players.length} players loaded`);

  console.log('📦 Opening DuckDB...');
  const db = new duckdb.Database(DB_PATH);
  const conn = db.connect();

  const query = (sql) => new Promise((resolve, reject) => {
    conn.all(sql, (err, res) => err ? reject(err) : resolve(res));
  });

  // Get last_season for all players
  console.log('⏳ Querying last_season data...');
  const lastSeasons = {};
  const playerIds = gameDb.players.map(p => p.id);
  const batchSize = 1000;

  for (let i = 0; i < playerIds.length; i += batchSize) {
    const batch = playerIds.slice(i, i + batchSize);
    const rows = await query(`
      SELECT player_id, last_season
      FROM players
      WHERE player_id IN (${batch.join(',')})
    `);
    for (const row of rows) {
      if (row.last_season) {
        lastSeasons[row.player_id] = parseInt(row.last_season);
      }
    }
    process.stdout.write(`\r   Processed ${Math.min(i + batchSize, playerIds.length)}/${playerIds.length}`);
  }

  console.log(`\n✅ Found last_season for ${Object.keys(lastSeasons).length} players`);

  // Enrich
  let updated = 0;
  for (const player of gameDb.players) {
    const ls = lastSeasons[player.id];
    if (ls) {
      player.lastSeason = ls;
      updated++;
    }
  }

  console.log(`✅ Updated ${updated} players with lastSeason`);

  // Save
  fs.writeFileSync(JSON_PATH, JSON.stringify(gameDb, null, 2));
  console.log(`💾 Saved: ${JSON_PATH}`);

  // Stats
  const seasons = {};
  gameDb.players.forEach(p => {
    const s = p.lastSeason || 'unknown';
    seasons[s] = (seasons[s] || 0) + 1;
  });
  console.log('\n📊 lastSeason distribution:');
  Object.entries(seasons).sort().forEach(([s, c]) => console.log(`   ${s}: ${c}`));

  db.close();
  console.log('\n✅ Done!');
}

main().catch(err => {
  console.error('❌ Error:', err);
  process.exit(1);
});
