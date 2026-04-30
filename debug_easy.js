const fs = require('fs');
const db = JSON.parse(fs.readFileSync('data/tiki-taka-toe-db.json', 'utf8'));
const easyClubs = db.clubs.filter(c => c.tier === 'easy');
console.log('Total clubs:', db.clubs.length);
console.log('Easy clubs:', easyClubs);
