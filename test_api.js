/**
 * Quick test for the /api/validate endpoint.
 * Run this AFTER starting the server: node server.js <username>
 * Then in another terminal: node test_api.js
 */

const testCases = [
  {
    name: 'Sneijder at Inter Milan x Real Madrid',
    guess: 'Sneijder',
    header1: { type: 'club', id: 46, name: 'Inter Milan' },
    header2: { type: 'club', id: 418, name: 'Real Madrid' },
    expectMatch: true,
  },
  {
    name: 'Messi at Barcelona x Argentina',
    guess: 'Messi',
    header1: { type: 'club', id: 131, name: 'FC Barcelona' },
    header2: { type: 'country', id: 'Argentina', name: 'Argentina' },
    expectMatch: true,
  },
  {
    name: 'Ronaldo at Real Madrid x Midfield (should not match - he is Forward)',
    guess: 'Ronaldo',
    header1: { type: 'club', id: 418, name: 'Real Madrid' },
    header2: { type: 'position', id: 'Midfield', name: 'Midfield' },
    expectMatch: false,
  },
  {
    name: 'Haaland at Manchester City x Tall (should match - he is >185cm)',
    guess: 'Haaland',
    header1: { type: 'club', id: 281, name: 'Manchester City' },
    header2: { type: 'height', id: 'tall', name: '> 185cm' },
    expectMatch: true,
  },
  {
    name: 'Invalid player "xyzabc123"',
    guess: 'xyzabc123',
    header1: { type: 'club', id: 46, name: 'Inter Milan' },
    header2: { type: 'club', id: 418, name: 'Real Madrid' },
    expectMatch: false,
  },
];

async function runTests() {
  console.log('🧪 Testing /api/validate endpoint...\n');
  
  for (const tc of testCases) {
    try {
      const res = await fetch('http://localhost:3001/api/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          guess: tc.guess,
          header1: tc.header1,
          header2: tc.header2,
        }),
      });
      
      const data = await res.json();
      const passed = data.match === tc.expectMatch;
      
      console.log(`${passed ? '✅' : '❌'} ${tc.name}`);
      console.log(`   Guess: "${tc.guess}" → ${data.match ? `MATCH: ${data.player.name}` : 'NO MATCH'}`);
      if (!passed) {
        console.log(`   ⚠️ Expected ${tc.expectMatch ? 'MATCH' : 'NO MATCH'}`);
      }
      console.log('');
    } catch (err) {
      console.log(`❌ ${tc.name}`);
      console.log(`   Error: ${err.message}`);
      console.log(`   Is the server running? (node server.js <username>)`);
      console.log('');
    }
  }
}

runTests();
