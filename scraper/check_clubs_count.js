const duckdb = require('duckdb');
const db = new duckdb.Database('transfermarkt-datasets.duckdb');
const sql = `
  WITH top_clubs AS (
    SELECT club_id, name FROM clubs 
    ORDER BY total_market_value DESC NULLS LAST 
    LIMIT 100
  )
  SELECT count(DISTINCT p.player_id) as count
  FROM players p
  JOIN appearances a ON p.player_id = a.player_id
  JOIN top_clubs tc ON a.player_club_id = tc.club_id;
`;
db.all(sql, (err, res) => console.log(res));
