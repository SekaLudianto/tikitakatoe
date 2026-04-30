const duckdb = require('duckdb');
const db = new duckdb.Database('transfermarkt-datasets.duckdb');
db.all("SELECT name, current_club_name, last_season FROM players WHERE name = 'Adrien Rabiot'", (err, res) => {
  console.log(res);
});
