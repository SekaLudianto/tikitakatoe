const duckdb = require('duckdb');
const path = require('path');

// 1. Tentukan path file DuckDB yang sudah Anda download
const dbPath = path.join(__dirname, 'transfermarkt-datasets.duckdb');

console.log('Membuka database DuckDB...');
const db = new duckdb.Database(dbPath);
const conn = db.connect();

console.log('Menjalankan filter data...\n');

// 2. Contoh Kueri SQL: Mencari pemain yang pernah bermain di Arsenal (11) dan Real Madrid (418)
// Sesuaikan club_id dengan klub yang Anda inginkan
const sqlQuery = `
  SELECT 
    p.player_id, 
    p.name, 
    p.position, 
    p.country_of_citizenship
  FROM players p
  JOIN appearances a1 ON p.player_id = a1.player_id
  JOIN appearances a2 ON p.player_id = a2.player_id
  WHERE a1.player_club_id = 11   -- 11 adalah ID Arsenal
    AND a2.player_club_id = 418  -- 418 adalah ID Real Madrid
  GROUP BY p.player_id, p.name, p.position, p.country_of_citizenship
  ORDER BY p.name;
`;

conn.all(sqlQuery, (err, res) => {
  if (err) {
    console.error('Terjadi kesalahan:', err.message);
    return;
  }
  
  console.log(`Ditemukan ${res.length} pemain yang pernah main di Arsenal & Real Madrid:`);
  console.table(res);
  
  console.log('\n✅ Filter selesai!');
});
