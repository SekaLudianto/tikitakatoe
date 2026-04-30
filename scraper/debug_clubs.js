const duckdb = require('duckdb');
const db = new duckdb.Database('scraper/transfermarkt-datasets.duckdb');
db.all("SELECT club_id, name, total_market_value FROM clubs ORDER BY total_market_value DESC NULLS LAST LIMIT 10", (err, res) => {
  console.log(res);
});
