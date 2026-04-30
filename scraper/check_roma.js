const duckdb = require('duckdb');
const db = new duckdb.Database('transfermarkt-datasets.duckdb');
db.all("SELECT club_id, name, club_code, filename FROM clubs WHERE name LIKE '%Roma%' OR club_code LIKE '%Roma%'", (err, res) => {
  console.log(res);
});
