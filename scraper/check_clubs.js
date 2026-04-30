const duckdb = require('duckdb');
const db = new duckdb.Database('transfermarkt-datasets.duckdb');
db.all("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'clubs'", (err, res) => {
  console.log(res);
});
