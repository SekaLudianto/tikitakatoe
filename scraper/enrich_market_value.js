/**
 * Enrich tiki-taka-toe-db.json with market value data from DuckDB.
 * Uses HIGHEST market value ever achieved (more reliable for recognizability/fame)
 * and latest market value for current ranking.
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

  // Get highest market value ever for each player
  console.log('⏳ Querying highest market values...');
  const highestValues = {};
  const rows = await query(`
    SELECT player_id, highest_market_value_in_eur
    FROM players
    WHERE highest_market_value_in_eur IS NOT NULL AND highest_market_value_in_eur > 0
  `);
  for (const row of rows) {
    highestValues[row.player_id] = row.highest_market_value_in_eur;
  }
  console.log(`   Found highest values for ${Object.keys(highestValues).length} players`);

  // Enrich game database
  let updated = 0;
  for (const player of gameDb.players) {
    const val = highestValues[player.id];
    if (val) {
      player.marketValue = val;
      updated++;
    }
  }

  console.log(`✅ Updated ${updated} players with marketValue`);

  // Save
  fs.writeFileSync(JSON_PATH, JSON.stringify(gameDb, null, 2));
  console.log(`💾 Saved: ${JSON_PATH}`);

  // Show examples
  console.log('\n📋 Top 10 by highest market value:');
  const sorted = [...gameDb.players].filter(p => p.marketValue).sort((a, b) => b.marketValue - a.marketValue);
  sorted.slice(0, 10).forEach((p, i) => {
    console.log(`   ${i + 1}. ${p.name} — €${(p.marketValue / 1e6).toFixed(1)}M (${p.currentClub?.name || 'N/A'})`);
  });

  db.close();
  console.log('\n✅ Done!');
}

main().catch(err => {
  console.error('❌ Error:', err);
  process.exit(1);
});
