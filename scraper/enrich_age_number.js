/**
 * Enrich tiki-taka-toe-db.json with age (date_of_birth) and shirt number data.
 */
const duckdb = require('duckdb');
const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, 'transfermarkt-datasets.duckdb');
const JSON_PATH = path.join(__dirname, '..', 'data', 'tiki-taka-toe-db.json');

async function runQuery(conn, sql) {
  return new Promise((resolve, reject) => {
    conn.all(sql, (err, res) => err ? reject(err) : resolve(res));
  });
}

async function main() {
  console.log('📦 Loading game database...');
  const gameDb = JSON.parse(fs.readFileSync(JSON_PATH, 'utf-8'));
  console.log(`   ${gameDb.players.length} players loaded`);

  console.log('📦 Opening DuckDB...');
  const db = new duckdb.Database(DB_PATH);
  const conn = db.connect();

  const playerIds = gameDb.players.map(p => p.id);
  
  // Step 1: Get age from date_of_birth
  console.log('⏳ Querying age data...');
  const ageData = {};
  const batchSize = 1000;
  
  for (let i = 0; i < playerIds.length; i += batchSize) {
    const batch = playerIds.slice(i, i + batchSize);
    const rows = await runQuery(conn, `
      SELECT player_id, date_of_birth
      FROM players WHERE player_id IN (${batch.join(',')})
    `);
    
    for (const row of rows) {
      const dob = row.date_of_birth ? new Date(row.date_of_birth) : null;
      if (dob && !isNaN(dob.getTime())) {
        const now = new Date();
        let age = now.getFullYear() - dob.getFullYear();
        const m = now.getMonth() - dob.getMonth();
        if (m < 0 || (m === 0 && now.getDate() < dob.getDate())) age--;
        ageData[row.player_id] = age;
      }
    }
    process.stdout.write(`\r   Age: ${Math.min(i + batchSize, playerIds.length)}/${playerIds.length}`);
  }
  console.log(`\n✅ Age data for ${Object.keys(ageData).length} players`);

  // Step 2: Get latest shirt number from game_lineups
  console.log('⏳ Querying shirt number data (latest match per player)...');
  const numberData = {};
  
  for (let i = 0; i < playerIds.length; i += batchSize) {
    const batch = playerIds.slice(i, i + batchSize);
    const rows = await runQuery(conn, `
      SELECT gl.player_id, gl.number
      FROM game_lineups gl
      INNER JOIN (
        SELECT player_id, MAX(game_id) as latest_game
        FROM game_lineups
        WHERE player_id IN (${batch.join(',')})
        AND number IS NOT NULL AND number != '' AND number != '-'
        GROUP BY player_id
      ) latest ON gl.player_id = latest.player_id AND gl.game_id = latest.latest_game
      WHERE gl.number IS NOT NULL AND gl.number != '' AND gl.number != '-'
    `);
    
    for (const row of rows) {
      const num = parseInt(row.number);
      if (!isNaN(num) && num > 0) {
        numberData[row.player_id] = num;
      }
    }
    process.stdout.write(`\r   Number: ${Math.min(i + batchSize, playerIds.length)}/${playerIds.length}`);
  }
  console.log(`\n✅ Shirt number data for ${Object.keys(numberData).length} players`);

  // Enrich
  let updatedAge = 0, updatedNumber = 0;
  for (const player of gameDb.players) {
    if (ageData[player.id] !== undefined) { player.age = ageData[player.id]; updatedAge++; }
    if (numberData[player.id] !== undefined) { player.shirtNumber = numberData[player.id]; updatedNumber++; }
  }
  
  console.log(`✅ Enriched: ${updatedAge} with age, ${updatedNumber} with shirtNumber`);
  
  // Save
  fs.writeFileSync(JSON_PATH, JSON.stringify(gameDb, null, 2));
  console.log(`💾 Saved: ${JSON_PATH}`);
  
  // Examples
  const examples = ['Cristiano Ronaldo', 'Lionel Messi', 'Virgil van Dijk', 'Jude Bellingham', 'Kylian Mbappé'];
  console.log('\n📋 Examples:');
  for (const name of examples) {
    const p = gameDb.players.find(pl => pl.name === name);
    if (p) console.log(`   ${p.name}: age=${p.age}, #${p.shirtNumber}`);
  }
  
  db.close();
  console.log('\n✅ Done!');
}

main().catch(err => {
  console.error('❌ Error:', err);
  process.exit(1);
});
