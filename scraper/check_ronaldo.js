const duckdb = require('duckdb');
const db = new duckdb.Database('./transfermarkt-datasets.duckdb');
const conn = db.connect();

// Check CR7's latest club from player_valuations
conn.all(`
  SELECT current_club_name, current_club_id, player_club_domestic_competition_id, date 
  FROM player_valuations 
  WHERE player_id = 8198 
  ORDER BY date DESC 
  LIMIT 5
`, (err, res) => {
  if (err) console.error(err);
  else {
    console.log("Ronaldo's latest valuations:");
    console.log(JSON.stringify(res, null, 2));
  }

  // Also check what tables store current club
  conn.all(`
    SELECT player_id, name, current_club_name, current_club_id, current_club_domestic_competition_id 
    FROM players 
    WHERE player_id = 8198
  `, (err2, res2) => {
    if (err2) console.error(err2);
    else {
      console.log("\nRonaldo's players table entry:");
      console.log(JSON.stringify(res2, null, 2));
    }
    db.close();
  });
});
