const duckdb = require('duckdb');
const db = new duckdb.Database('./transfermarkt-datasets.duckdb');
const conn = db.connect();

conn.all(`
  SELECT DISTINCT sub_position, position, COUNT(*) as cnt
  FROM players 
  WHERE sub_position IS NOT NULL AND sub_position != ''
  GROUP BY sub_position, position
  ORDER BY cnt DESC
  LIMIT 30
`, (err, res) => {
  if (err) console.error(err);
  else {
    console.log("Available sub_positions:");
    for (const r of res) {
      console.log(`  ${r.sub_position} (parent: ${r.position}) — ${r.cnt} players`);
    }
  }

  // Check specific players
  conn.all(`
    SELECT player_id, name, position, sub_position 
    FROM players 
    WHERE player_id IN (8198, 28003, 342229, 581678)
  `, (err2, res2) => {
    if (err2) console.error(err2);
    else {
      console.log("\nSpecific players:");
      for (const r of res2) {
        console.log(`  ${r.name}: position=${r.position}, sub_position=${r.sub_position}`);
      }
    }
    db.close();
  });
});
