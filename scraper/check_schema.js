const duckdb = require('duckdb');
const db = new duckdb.Database('transfermarkt-datasets.duckdb');
db.all("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'players'", (err, res) => {
  console.log('Players columns:');
  console.log(res);
});
db.all("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'appearances'", (err, res) => {
  console.log('Appearances columns:');
  console.log(res);
});
