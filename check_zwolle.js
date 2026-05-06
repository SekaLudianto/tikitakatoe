const duckdb = require('./scraper/node_modules/duckdb');
const db = new duckdb.Database('./scraper/transfermarkt-datasets.duckdb');

// Cari PEC Zwolle
db.all("SELECT club_id, name FROM clubs WHERE name LIKE '%Zwolle%' OR name LIKE '%PEC%'", (err, res) => {
  if (err) {
    console.error('Error:', err);
    return;
  }
  console.log('PEC Zwolle search:');
  console.log(res);
});
