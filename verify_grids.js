/**
 * verify_grids.js — Validate all grids in sample-grids.json
 * 
 * Checks:
 * 1. Every grid has valid rows (3) and cols (3)
 * 2. Every grid has exactly 9 cells
 * 3. Every cell has at least 1 sampleAnswer
 * 4. All header types (club, country, position, competition, jersey, foot) are well-formed
 * 5. No duplicate player names within the same grid
 * 6. Cross-validates intersections against tiki-taka-toe-db.json
 * 7. Summary stats per difficulty
 */

const fs = require('fs');
const path = require('path');

const gridsPath = path.join(__dirname, 'data', 'sample-grids.json');
const dbPath = path.join(__dirname, 'data', 'tiki-taka-toe-db.json');

console.log('📦 Loading data...');
const gridsData = JSON.parse(fs.readFileSync(gridsPath, 'utf-8'));
const db = JSON.parse(fs.readFileSync(dbPath, 'utf-8'));

const VALID_HEADER_TYPES = ['club', 'country', 'position', 'competition', 'jersey', 'height'];

function normalize(str) {
  return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
}

function lookupIntersection(rowHeader, colHeader) {
  const h1 = rowHeader;
  const h2 = colHeader;

  if (h1.type === 'club' && h2.type === 'club') {
    const key = [h1.id, h2.id].sort((a, b) => a - b).join('-');
    return db.intersections[key] || [];
  }
  if (h1.type === 'club' && h2.type === 'country') {
    return db.countryIntersections[`${h1.id}-country:${h2.name}`] || [];
  }
  if (h1.type === 'country' && h2.type === 'club') {
    return db.countryIntersections[`${h2.id}-country:${h1.name}`] || [];
  }
  if (h1.type === 'club' && h2.type === 'position') {
    return db.positionIntersections[`${h1.id}-position:${h2.name}`] || [];
  }
  if (h1.type === 'position' && h2.type === 'club') {
    return db.positionIntersections[`${h2.id}-position:${h1.name}`] || [];
  }
  if (h1.type === 'club' && h2.type === 'competition') {
    return (db.competitionIntersections || {})[`${h1.id}-comp:${h2.id}`] || [];
  }
  if (h1.type === 'competition' && h2.type === 'club') {
    return (db.competitionIntersections || {})[`${h2.id}-comp:${h1.id}`] || [];
  }
  if (h1.type === 'club' && h2.type === 'jersey') {
    return (db.jerseyIntersections || {})[`${h1.id}-jersey:${h2.id}`] || [];
  }
  if (h1.type === 'jersey' && h2.type === 'club') {
    return (db.jerseyIntersections || {})[`${h2.id}-jersey:${h1.id}`] || [];
  }
  if (h1.type === 'club' && h2.type === 'height') {
    return (db.heightIntersections || {})[`${h1.id}-height:${h2.id}`] || [];
  }
  if (h1.type === 'height' && h2.type === 'club') {
    return (db.heightIntersections || {})[`${h2.id}-height:${h1.id}`] || [];
  }
  return null; // unknown combo
}

function validateGrid(grid, difficultyName, gridIndex) {
  const errors = [];
  const warnings = [];

  // Check rows & cols
  if (!grid.rows || grid.rows.length !== 3) {
    errors.push(`Missing or invalid rows (got ${grid.rows?.length})`);
  }
  if (!grid.cols || grid.cols.length !== 3) {
    errors.push(`Missing or invalid cols (got ${grid.cols?.length})`);
  }
  if (!grid.cells || grid.cells.length !== 9) {
    errors.push(`Missing or invalid cells (got ${grid.cells?.length})`);
  }

  if (errors.length > 0) return { errors, warnings };

  // Check header types
  for (const [label, headers] of [['row', grid.rows], ['col', grid.cols]]) {
    for (let i = 0; i < headers.length; i++) {
      const h = headers[i];
      if (!VALID_HEADER_TYPES.includes(h.type)) {
        errors.push(`${label}[${i}] has invalid type: "${h.type}"`);
      }
      if (!h.name && h.type !== 'jersey' && h.type !== 'foot') {
        errors.push(`${label}[${i}] missing name`);
      }
      if (h.type === 'club' && !h.id) {
        errors.push(`${label}[${i}] club missing id`);
      }
    }
  }

  // Check cells
  const allPlayers = new Set();
  let emptyCells = 0;
  let totalAnswers = 0;

  for (let i = 0; i < 9; i++) {
    const cell = grid.cells[i];
    const rowIdx = Math.floor(i / 3);
    const colIdx = i % 3;

    if (!cell || !cell.sampleAnswers || cell.sampleAnswers.length === 0) {
      emptyCells++;
      errors.push(`Cell [${rowIdx},${colIdx}] has no sampleAnswers`);
      continue;
    }

    totalAnswers += cell.sampleAnswers.length;

    // Check for duplicate players within grid
    for (const answer of cell.sampleAnswers) {
      const answerStr = typeof answer === 'object' ? (answer.name || JSON.stringify(answer)) : String(answer);
      const normalized = normalize(answerStr);
      if (allPlayers.has(normalized)) {
        warnings.push(`Duplicate player "${answer}" in grid`);
      }
      allPlayers.add(normalized);
    }

    // Cross-validate against database
    const rowHeader = grid.rows[rowIdx];
    const colHeader = grid.cols[colIdx];
    const dbAnswers = lookupIntersection(rowHeader, colHeader);

    if (dbAnswers === null) {
      warnings.push(`Cell [${rowIdx},${colIdx}]: unknown header combo ${rowHeader.type}×${colHeader.type}`);
    } else if (dbAnswers.length === 0) {
      errors.push(`Cell [${rowIdx},${colIdx}]: no DB intersection for ${rowHeader.name}×${colHeader.name}`);
    }
  }

  if (emptyCells > 0) {
    errors.push(`${emptyCells} cell(s) have no answers`);
  }

  return { errors, warnings, totalAnswers, playerCount: allPlayers.size };
}

// ==================== RUN VALIDATION ====================
console.log('\n🔍 Validating grids...\n');

const difficulties = ['easy', 'medium', 'hard'];
let grandTotalGrids = 0;
let grandTotalErrors = 0;
let grandTotalWarnings = 0;

const headerTypeStats = {};

for (const diff of difficulties) {
  const grids = gridsData[diff] || [];
  let errorCount = 0;
  let warningCount = 0;
  let totalAnswers = 0;
  const errorDetails = [];

  for (let i = 0; i < grids.length; i++) {
    const result = validateGrid(grids[i], diff, i);
    
    if (result.errors.length > 0) {
      errorCount++;
      if (errorDetails.length < 5) { // Show first 5 errors per difficulty
        errorDetails.push({ index: i, errors: result.errors });
      }
    }
    warningCount += result.warnings.length;
    totalAnswers += result.totalAnswers || 0;

    // Collect header type stats
    for (const h of [...grids[i].rows, ...grids[i].cols]) {
      const key = `${diff}:${h.type}`;
      headerTypeStats[key] = (headerTypeStats[key] || 0) + 1;
    }
  }

  const avgAnswers = grids.length > 0 ? (totalAnswers / grids.length).toFixed(1) : 0;

  console.log(`${'─'.repeat(50)}`);
  console.log(`📊 ${diff.toUpperCase()} — ${grids.length} grids`);
  console.log(`   ✅ Valid: ${grids.length - errorCount}`);
  console.log(`   ❌ Errors: ${errorCount}`);
  console.log(`   ⚠️  Warnings: ${warningCount}`);
  console.log(`   📈 Avg answers/grid: ${avgAnswers}`);

  if (errorDetails.length > 0) {
    console.log(`   First errors:`);
    for (const d of errorDetails) {
      console.log(`     Grid #${d.index}: ${d.errors.join('; ')}`);
    }
  }

  grandTotalGrids += grids.length;
  grandTotalErrors += errorCount;
  grandTotalWarnings += warningCount;
}

// Header type breakdown
console.log(`\n${'─'.repeat(50)}`);
console.log('📋 Header types breakdown:');
for (const diff of difficulties) {
  const types = {};
  for (const [key, count] of Object.entries(headerTypeStats)) {
    const [d, t] = key.split(':');
    if (d === diff) types[t] = count;
  }
  console.log(`   ${diff}: ${JSON.stringify(types)}`);
}

// Database stats
console.log(`\n${'─'.repeat(50)}`);
console.log('📦 Database stats:');
console.log(`   Players: ${db.players.length}`);
console.log(`   Club-Club intersections: ${Object.keys(db.intersections).length}`);
console.log(`   Club-Country intersections: ${Object.keys(db.countryIntersections || {}).length}`);
console.log(`   Club-Position intersections: ${Object.keys(db.positionIntersections || {}).length}`);
console.log(`   Club-Competition intersections: ${Object.keys(db.competitionIntersections || {}).length}`);
console.log(`   Club-Jersey intersections: ${Object.keys(db.jerseyIntersections || {}).length}`);
console.log(`   Club-Height intersections: ${Object.keys(db.heightIntersections || {}).length}`);

// Final summary
console.log(`\n${'═'.repeat(50)}`);
if (grandTotalErrors === 0) {
  console.log(`✅ ALL ${grandTotalGrids} GRIDS PASSED VALIDATION!`);
} else {
  console.log(`❌ ${grandTotalErrors}/${grandTotalGrids} grids have errors`);
}
console.log(`⚠️  ${grandTotalWarnings} total warnings`);
console.log(`${'═'.repeat(50)}`);
