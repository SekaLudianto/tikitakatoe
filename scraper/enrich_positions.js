/**
 * Enrich tiki-taka-toe-db.json with detailed sub_position data from DuckDB.
 * This adds `detailedPosition` field (e.g. "CB", "LB", "RW") to each player.
 */
const duckdb = require('duckdb');
const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, 'transfermarkt-datasets.duckdb');
const JSON_PATH = path.join(__dirname, '..', 'data', 'tiki-taka-toe-db.json');

// Map sub_position to short abbreviation
const POS_ABBREVIATION = {
  'Centre-Back': 'CB',
  'Centre-Forward': 'CF',
  'Goalkeeper': 'GK',
  'Central Midfield': 'CM',
  'Defensive Midfield': 'CDM',
  'Right-Back': 'RB',
  'Attacking Midfield': 'CAM',
  'Left-Back': 'LB',
  'Left Winger': 'LW',
  'Right Winger': 'RW',
  'Right Midfield': 'RM',
  'Left Midfield': 'LM',
  'Second Striker': 'SS',
};

async function main() {
  console.log('📦 Loading game database...');
  const gameDb = JSON.parse(fs.readFileSync(JSON_PATH, 'utf-8'));
  console.log(`   ${gameDb.players.length} players loaded`);

  console.log('📦 Opening DuckDB...');
  const db = new duckdb.Database(DB_PATH);
  const conn = db.connect();

  const playerIds = gameDb.players.map(p => p.id);
  
  console.log('⏳ Querying sub_position data...');
  
  const subPositions = {};
  const batchSize = 1000;
  
  for (let i = 0; i < playerIds.length; i += batchSize) {
    const batch = playerIds.slice(i, i + batchSize);
    const sql = `
      SELECT player_id, sub_position
      FROM players 
      WHERE player_id IN (${batch.join(',')})
      AND sub_position IS NOT NULL AND sub_position != ''
    `;
    
    const rows = await new Promise((resolve, reject) => {
      conn.all(sql, (err, res) => err ? reject(err) : resolve(res));
    });
    
    for (const row of rows) {
      subPositions[row.player_id] = row.sub_position;
    }
    
    process.stdout.write(`\r   Processed ${Math.min(i + batchSize, playerIds.length)}/${playerIds.length}`);
  }
  
  console.log(`\n✅ Found sub_position for ${Object.keys(subPositions).length} players`);
  
  // Enrich game database
  let updated = 0;
  for (const player of gameDb.players) {
    const subPos = subPositions[player.id];
    if (subPos) {
      player.detailedPosition = POS_ABBREVIATION[subPos] || subPos;
      updated++;
    }
  }
  
  console.log(`✅ Updated ${updated} players with detailedPosition`);
  
  // Save
  fs.writeFileSync(JSON_PATH, JSON.stringify(gameDb, null, 2));
  console.log(`💾 Saved: ${JSON_PATH}`);
  
  // Show examples
  const examples = ['Cristiano Ronaldo', 'Lionel Messi', 'Virgil van Dijk', 'Trent Alexander-Arnold', 'Manuel Neuer'];
  console.log('\n📋 Examples:');
  for (const name of examples) {
    const p = gameDb.players.find(pl => pl.name === name);
    if (p) console.log(`   ${p.name}: ${p.position} → ${p.detailedPosition}`);
  }
  
  db.close();
  console.log('\n✅ Done!');
}

main().catch(err => {
  console.error('❌ Error:', err);
  process.exit(1);
});
