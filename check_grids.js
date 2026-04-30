const fs = require('fs');
const data = JSON.parse(fs.readFileSync('data/sample-grids.json', 'utf8'));
console.log('Easy:', data.easy ? data.easy.length : 0);
console.log('Medium:', data.medium ? data.medium.length : 0);
console.log('Hard:', data.hard ? data.hard.length : 0);
