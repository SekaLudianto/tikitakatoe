/**
 * Enrich tiki-taka-toe-db.json with current club data from DuckDB players table.
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

  // Query current club for all players
  const playerIds = gameDb.players.map(p => p.id);
  
  console.log('⏳ Querying current club data...');
  
  // Process in batches
  const currentClubs = {};
  const batchSize = 1000;
  
  for (let i = 0; i < playerIds.length; i += batchSize) {
    const batch = playerIds.slice(i, i + batchSize);
    const sql = `
      SELECT player_id, name, current_club_name, current_club_id, current_club_domestic_competition_id
      FROM players 
      WHERE player_id IN (${batch.join(',')})
    `;
    
    const rows = await new Promise((resolve, reject) => {
      conn.all(sql, (err, res) => err ? reject(err) : resolve(res));
    });
    
    for (const row of rows) {
      if (row.current_club_name && row.current_club_id) {
        currentClubs[row.player_id] = {
          id: parseInt(row.current_club_id),
          name: row.current_club_name,
          league: row.current_club_domestic_competition_id || ''
        };
      }
    }
    
    process.stdout.write(`\r   Processed ${Math.min(i + batchSize, playerIds.length)}/${playerIds.length} players`);
  }
  
  console.log(`\n✅ Found current club data for ${Object.keys(currentClubs).length} players`);
  
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
  
  // Show some examples
  const cr7 = gameDb.players.find(p => p.name === 'Cristiano Ronaldo');
  const messi = gameDb.players.find(p => p.name === 'Lionel Messi');
  const mbappe = gameDb.players.find(p => p.name.includes('Mbappé'));
  
  console.log('\n📋 Examples:');
  if (cr7) console.log(`   Ronaldo: ${cr7.currentClub?.name} (${cr7.currentClub?.league})`);
  if (messi) console.log(`   Messi: ${messi.currentClub?.name} (${messi.currentClub?.league})`);
  if (mbappe) console.log(`   Mbappé: ${mbappe.currentClub?.name} (${mbappe.currentClub?.league})`);
  
  db.close();
  console.log('\n✅ Done!');
}

main().catch(err => {
  console.error('❌ Error:', err);
  process.exit(1);
});
