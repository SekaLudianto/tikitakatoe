// Quick script to analyze Sneijder's data and the completeness of the database
const fs = require('fs');

// 1. Check Sneijder in main DB
const db = JSON.parse(fs.readFileSync('./data/tiki-taka-toe-db.json', 'utf-8'));
const sneijder = db.players.find(p => p.name.includes('Sneijder'));
console.log('\n=== SNEIJDER IN DATABASE ===');
console.log(JSON.stringify(sneijder, null, 2));

// 2. Check if Inter Milan (46) x Real Madrid (418) intersection exists
const key1 = '46-418';
const key2 = '418-46';
console.log('\n=== INTER MILAN x REAL MADRID INTERSECTION ===');
console.log('Key 46-418:', db.intersections[key1] || 'NOT FOUND');
console.log('Key 418-46:', db.intersections[key2] || 'NOT FOUND');

// 3. Check Sneijder's clubs in DB vs reality
console.log('\n=== SNEIJDER CLUB ANALYSIS ===');
console.log('Clubs in DB:', sneijder ? sneijder.clubs.map(c => c.name) : 'N/A');
console.log('MISSING: Real Madrid (418) - Sneijder played 2007-2009');
console.log('MISSING: Ajax (610) - Sneijder played 2002-2007');

// 4. Count sample-grids cells where Sneijder appears
const grids = JSON.parse(fs.readFileSync('./data/sample-grids.json', 'utf-8'));
let sneijderCells = 0;
let sneijderContexts = [];
for (const diff of ['easy', 'medium', 'hard']) {
  if (!grids[diff]) continue;
  for (const grid of grids[diff]) {
    for (const cell of grid.cells) {
      const found = cell.sampleAnswers.find(a => a.name.includes('Sneijder'));
      if (found) {
        sneijderCells++;
        sneijderContexts.push({ difficulty: diff, row: cell.row, col: cell.col });
      }
    }
  }
}
console.log(`\n=== SNEIJDER IN SAMPLE GRIDS: ${sneijderCells} cells ===`);
// Show unique combos
const uniqueCombos = [...new Set(sneijderContexts.map(c => `${c.row} x ${c.col}`))];
console.log('Unique cell combos:', uniqueCombos);

// 5. Overall DB completeness analysis
console.log('\n=== DATABASE COMPLETENESS ===');
console.log('Total players:', db.players.length);
console.log('Total clubs:', db.clubs.length);
console.log('Total club-club intersections:', Object.keys(db.intersections).length);
console.log('Total club-country intersections:', Object.keys(db.countryIntersections).length);
console.log('Total club-position intersections:', Object.keys(db.positionIntersections).length);

// 6. Check how many players have incomplete club history
// Look for famous players who should have more clubs
const famousCheck = [
  { name: 'Sneijder', expected: ['Inter Milan', 'Real Madrid', 'Ajax', 'Galatasaray'] },
  { name: 'Ronaldo', expected: ['Manchester United', 'Real Madrid', 'Juventus'] },
  { name: 'Zlatan', expected: ['Inter Milan', 'AC Milan', 'Barcelona', 'PSG', 'Manchester United', 'Ajax'] },
  { name: 'Beckham', expected: ['Manchester United', 'Real Madrid', 'PSG', 'AC Milan'] },
];

console.log('\n=== FAMOUS PLAYER CLUB CHECK ===');
for (const check of famousCheck) {
  const player = db.players.find(p => p.name.includes(check.name));
  if (player) {
    const hasClubs = player.clubs.map(c => c.name);
    const missing = check.expected.filter(e => !hasClubs.some(h => h.includes(e)));
    console.log(`${player.name}: Has [${hasClubs.join(', ')}]`);
    if (missing.length > 0) console.log(`  ❌ MISSING: [${missing.join(', ')}]`);
    else console.log(`  ✅ Complete`);
  } else {
    console.log(`${check.name}: NOT IN DATABASE`);
  }
}

// 7. Count players with only 1 club (can't be in any club-club intersection)
const singleClub = db.players.filter(p => p.clubs.length === 1).length;
const multiClub = db.players.filter(p => p.clubs.length >= 2).length;
console.log(`\nPlayers with 1 club: ${singleClub} (only useful for country/position cells)`);
console.log(`Players with 2+ clubs: ${multiClub} (useful for club-club cells)`);
