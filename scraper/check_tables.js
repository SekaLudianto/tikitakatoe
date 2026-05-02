const duckdb = require('duckdb');
const db = new duckdb.Database('transfermarkt-datasets.duckdb');

// List all tables
db.all("SELECT table_name FROM information_schema.tables WHERE table_schema = 'main'", (err, res) => {
  console.log('=== ALL TABLES ===');
  console.log(res.map(r => r.table_name));
  
  // Check if there's a transfers or player_valuations table
  const tables = res.map(r => r.table_name);
  
  // For each table, show column names
  let pending = tables.length;
  tables.forEach(t => {
    db.all(`SELECT column_name FROM information_schema.columns WHERE table_name = '${t}' ORDER BY ordinal_position`, (err2, cols) => {
      console.log(`\n=== ${t} ===`);
      console.log(cols.map(c => c.column_name).join(', '));
      
      pending--;
      if (pending === 0) {
        // Now check Sneijder specifically
        db.all("SELECT * FROM players WHERE name LIKE '%Sneijder%'", (err3, sneijder) => {
          console.log('\n=== SNEIJDER IN players TABLE ===');
          console.log(sneijder);
          
          // Check appearances for Sneijder
          if (sneijder && sneijder.length > 0) {
            const pid = sneijder[0].player_id;
            db.all(`SELECT DISTINCT player_club_id FROM appearances WHERE player_id = ${pid}`, (err4, apps) => {
              console.log('\n=== SNEIJDER APPEARANCES (clubs) ===');
              console.log(apps);
              
              // Check if there's a transfers table with Sneijder
              if (tables.includes('transfers')) {
                db.all(`SELECT * FROM transfers WHERE player_id = ${pid}`, (err5, tr) => {
                  console.log('\n=== SNEIJDER TRANSFERS ===');
                  console.log(tr);
                });
              }
              
              // Check Cristiano Ronaldo
              db.all("SELECT player_id, name, current_club_id FROM players WHERE name LIKE '%Cristiano Ronaldo%'", (err6, cr7) => {
                console.log('\n=== CRISTIANO RONALDO IN players TABLE ===');
                console.log(cr7);
                if (cr7 && cr7.length > 0) {
                  db.all(`SELECT DISTINCT player_club_id FROM appearances WHERE player_id = ${cr7[0].player_id}`, (err7, cr7apps) => {
                    console.log('\n=== CR7 APPEARANCES (clubs) ===');
                    console.log(cr7apps);
                  });
                }
              });
            });
          }
        });
      }
    });
  });
});
