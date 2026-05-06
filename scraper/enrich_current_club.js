/**
 * Enrich tiki-taka-toe-db.json with current club data from DuckDB.
 * 
 * Uses player_valuations table (most recent entry per player) as the PRIMARY
 * source — this is more accurate than the players table which can be stale.
 * Falls back to the players table only if no valuation entry exists.
 * 
 * This adds `currentClub` field to each player so Who Am I mode shows up-to-date info.
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

  // =========================================================
  // PRIMARY: Use latest player_valuations entry for each player
  // This has timestamped club data → most accurate and recent
  // =========================================================
  console.log('⏳ Querying latest club data from player_valuations...');
  
  const currentClubs = {};
  const valuationRows = await query(`
    SELECT pv.player_id, pv.current_club_name, pv.current_club_id, 
           pv.player_club_domestic_competition_id, pv.date
    FROM player_valuations pv
    INNER JOIN (
      SELECT player_id, MAX(date) as max_date
      FROM player_valuations
      GROUP BY player_id
    ) latest ON pv.player_id = latest.player_id AND pv.date = latest.max_date
  `);

  for (const row of valuationRows) {
    if (row.current_club_name && row.current_club_id) {
      currentClubs[row.player_id] = {
        id: parseInt(row.current_club_id),
        name: row.current_club_name,
        league: row.player_club_domestic_competition_id || '',
      };
    }
  }

  console.log(`✅ Found club data from valuations for ${Object.keys(currentClubs).length} players`);

  // =========================================================
  // FALLBACK: Use players table for any players not in valuations
  // =========================================================
  const playerIds = gameDb.players.map(p => p.id);
  const missingIds = playerIds.filter(id => !currentClubs[id]);
  console.log(`⏳ Querying fallback club data for ${missingIds.length} remaining players...`);

  const batchSize = 1000;
  let fallbackCount = 0;

  for (let i = 0; i < missingIds.length; i += batchSize) {
    const batch = missingIds.slice(i, i + batchSize);
    const sql = `
      SELECT player_id, current_club_name, current_club_id, current_club_domestic_competition_id
      FROM players 
      WHERE player_id IN (${batch.join(',')})
    `;

    const rows = await query(sql);

    for (const row of rows) {
      if (row.current_club_name && row.current_club_id && !currentClubs[row.player_id]) {
        currentClubs[row.player_id] = {
          id: parseInt(row.current_club_id),
          name: row.current_club_name,
          league: row.current_club_domestic_competition_id || ''
        };
        fallbackCount++;
      }
    }
  }

  console.log(`✅ Added ${fallbackCount} players from fallback (players table)`);
  console.log(`✅ Total: ${Object.keys(currentClubs).length} players with currentClub`);

  // Enrich game database
  let updated = 0;
  for (const player of gameDb.players) {
    const cc = currentClubs[player.id];
    if (cc) {
      player.currentClub = cc;
      updated++;
    }
  }

  console.log(`✅ Updated ${updated} players with currentClub`);

  // Save
  fs.writeFileSync(JSON_PATH, JSON.stringify(gameDb, null, 2));
  console.log(`💾 Saved: ${JSON_PATH}`);

  // Show examples — verify accuracy
  console.log('\n📋 Examples:');
  const examples = ['Cristiano Ronaldo', 'Lionel Messi', 'Diego Costa', 'Naby Keïta'];
  for (const name of examples) {
    const p = gameDb.players.find(pl => pl.name === name);
    if (p) console.log(`   ${p.name}: ${p.currentClub?.name} (${p.currentClub?.league})`);
  }

  db.close();
  console.log('\n✅ Done!');
}

main().catch(err => {
  console.error('❌ Error:', err);
  process.exit(1);
});
