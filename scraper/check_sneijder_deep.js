const duckdb = require('duckdb');
const db = new duckdb.Database('transfermarkt-datasets.duckdb');

// Check Sneijder's appearances in detail
db.all(`
  SELECT a.player_club_id, c.name as club_name, COUNT(*) as appearances, 
         MIN(a.date) as first_date, MAX(a.date) as last_date
  FROM appearances a
  LEFT JOIN clubs c ON a.player_club_id = c.club_id
  WHERE a.player_id = 4673
  GROUP BY a.player_club_id, c.name
  ORDER BY first_date
`, (err, res) => {
  console.log('=== SNEIJDER APPEARANCES DETAIL ===');
  console.log(res);
});

// Check transfers table for Sneijder
db.all(`SELECT * FROM transfers WHERE player_id = 4673 ORDER BY transfer_date`, (err, res) => {
  console.log('\n=== SNEIJDER TRANSFERS ===');
  console.log(res);
});

// Check if transfers table has data at all
db.all(`SELECT COUNT(*) as total FROM transfers`, (err, res) => {
  console.log('\n=== TRANSFERS TABLE COUNT ===');
  console.log(res);
});

// Check what competitions/seasons appearances covers
db.all(`SELECT MIN(date) as earliest, MAX(date) as latest FROM appearances`, (err, res) => {
  console.log('\n=== APPEARANCES DATE RANGE ===');
  console.log(res);
});

// Check if Ajax (610) and Real Madrid (418) are in the appearances for Sneijder
// Maybe they aren't in TOP 100 clubs? Let's check
db.all(`SELECT club_id, name FROM clubs WHERE club_id IN (610, 418)`, (err, res) => {
  console.log('\n=== AJAX AND REAL MADRID IN CLUBS TABLE ===');
  console.log(res);
});

// Check game_lineups for Sneijder - maybe this has more data
db.all(`
  SELECT gl.club_id, c.name as club_name, COUNT(*) as lineup_count,
         MIN(gl.date) as first_date, MAX(gl.date) as last_date
  FROM game_lineups gl
  LEFT JOIN clubs c ON gl.club_id = c.club_id
  WHERE gl.player_id = 4673
  GROUP BY gl.club_id, c.name
  ORDER BY first_date
`, (err, res) => {
  console.log('\n=== SNEIJDER GAME_LINEUPS (more complete?) ===');
  console.log(res);
});

// Check player_valuations for Sneijder
db.all(`
  SELECT current_club_id, current_club_name, date, market_value_in_eur
  FROM player_valuations
  WHERE player_id = 4673
  ORDER BY date
`, (err, res) => {
  console.log('\n=== SNEIJDER VALUATIONS (shows club history) ===');
  console.log(res);
});
