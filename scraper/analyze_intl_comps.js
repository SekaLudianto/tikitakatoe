const duckdb = require('duckdb');
const db = new duckdb.Database('./transfermarkt-datasets.duckdb');
const conn = db.connect();

function q(sql) {
  return new Promise((r, j) => conn.all(sql, (e, d) => e ? j(e) : r(d)));
}

async function main() {
  const leagueCol = 'player_club_domestic_competition_id';
  const targets = ['MLS1', 'SA1', 'JAP1', 'BRA1', 'ARG1', 'MEX1', 'AUS1'];

  // Famous players who transferred to non-Euro leagues
  console.log('⭐ Pemain terkenal yang pindah ke liga non-Eropa:\n');
  const famous = await q(`
    SELECT p.name, p.country_of_citizenship, c.name as to_club, 
           comp.country_name as league_country
    FROM transfers t
    JOIN players p ON t.player_id = p.player_id
    JOIN clubs c ON t.to_club_id = c.club_id
    LEFT JOIN competitions comp ON c.domestic_competition_id = comp.competition_id
    LEFT JOIN (SELECT player_id, MAX(market_value_in_eur) as peak FROM player_valuations GROUP BY player_id) pv ON p.player_id = pv.player_id
    WHERE c.domestic_competition_id IN ('MLS1','SA1','JAP1','BRA1','ARG1','MEX1')
    AND pv.peak > 20000000
    ORDER BY pv.peak DESC
    LIMIT 40
  `);
  
  for (const p of famous) {
    console.log(`   ${(p.name || '?').padEnd(25)} | ${(p.country_of_citizenship || '').padEnd(12)} | → ${(p.to_club || '?').padEnd(30)} (${p.league_country || '?'})`);
  }

  // Check overlap
  console.log('\n📊 Overlap: pemain liga non-Eropa yang JUGA bermain di Top 150 klub Eropa:\n');
  
  const topClubs = await q(`
    SELECT c.club_id FROM clubs c
    JOIN appearances a ON c.club_id = a.player_club_id
    GROUP BY c.club_id ORDER BY COUNT(a.appearance_id) DESC LIMIT 150
  `);
  const topList = topClubs.map(c => c.club_id).join(',');
  
  for (const t of targets) {
    const overlap = await q(`
      SELECT COUNT(DISTINCT pv.player_id) as overlap
      FROM player_valuations pv
      WHERE pv.${leagueCol} = '${t}'
      AND pv.player_id IN (
        SELECT DISTINCT player_id FROM appearances WHERE player_club_id IN (${topList})
      )
    `);
    const total = await q(`SELECT COUNT(DISTINCT player_id) as total FROM player_valuations WHERE ${leagueCol} = '${t}'`);
    const pct = total[0].total > 0 ? ((Number(overlap[0].overlap) / Number(total[0].total)) * 100).toFixed(1) : 0;
    const info = await q(`SELECT name, country_name FROM competitions WHERE competition_id = '${t}' LIMIT 1`);
    const name = info.length > 0 ? info[0].country_name : t;
    console.log(`   ${t.padEnd(8)} | ${(name || '?').padEnd(20)} | Total: ${String(total[0].total).padStart(5)} | Overlap: ${String(overlap[0].overlap).padStart(4)} (${pct}%)`);
  }

  console.log('\n✅ Selesai');
}

main().catch(e => console.error(e));
