const fs = require('fs');
const db = JSON.parse(fs.readFileSync('data/tiki-taka-toe-db.json', 'utf-8'));

const COUNTRY_FLAG_CODES = {
  'Brazil': 'br', 'Argentina': 'ar', 'France': 'fr', 'Germany': 'de', 'Spain': 'es',
  'England': 'gb-eng', 'Portugal': 'pt', 'Italy': 'it', 'Netherlands': 'nl', 'Belgium': 'be',
  'Colombia': 'co', 'Uruguay': 'uy', 'Croatia': 'hr', 'Nigeria': 'ng', 'Senegal': 'sn',
  'Morocco': 'ma', 'Ghana': 'gh', 'Ivory Coast': 'ci', 'Cameroon': 'cm', 'Japan': 'jp',
  'Ecuador': 'ec', 'Chile': 'cl', 'Peru': 'pe', 'Switzerland': 'ch', 'Denmark': 'dk',
  'Austria': 'at', 'Turkey': 'tr', 'Wales': 'gb-wls', 'Scotland': 'gb-sct', 'Serbia': 'rs',
  'Poland': 'pl', 'Sweden': 'se', 'Algeria': 'dz', 'Egypt': 'eg', 'South Korea': 'kr',
  'USA': 'us', 'Mexico': 'mx', 'Canada': 'ca', 'Australia': 'au',
  'Paraguay': 'py', 'Venezuela': 've', 'Norway': 'no', 'Czech Republic': 'cz', 'Romania': 'ro',
  'Greece': 'gr', 'Hungary': 'hu', 'Ukraine': 'ua', 'Bosnia-Herzegovina': 'ba',
  'Republic of Ireland': 'ie', 'Northern Ireland': 'gb-nir', 'North Macedonia': 'mk',
  'Montenegro': 'me', 'Iceland': 'is', 'Finland': 'fi', 'Tunisia': 'tn',
  'DR Congo': 'cd', 'Mali': 'ml', 'Guinea': 'gn', 'Iran': 'ir', 'Saudi Arabia': 'sa',
  'Indonesia': 'id', 'Jamaica': 'jm', 'Costa Rica': 'cr', 'Honduras': 'hn',
  'Gabon': 'ga', 'Burkina Faso': 'bf', 'Congo': 'cg', 'Togo': 'tg', 'Benin': 'bj',
  'Cape Verde': 'cv', 'Equatorial Guinea': 'gq', 'Mozambique': 'mz', 'Zambia': 'zm',
  'Zimbabwe': 'zw', 'Angola': 'ao', 'South Africa': 'za', 'Slovakia': 'sk', 'Slovenia': 'si',
  'Albania': 'al', 'Georgia': 'ge', 'Armenia': 'am', 'Kosovo': 'xk', 'Luxembourg': 'lu',
  'Lithuania': 'lt', 'Latvia': 'lv', 'Estonia': 'ee', 'Cyprus': 'cy', 'Malta': 'mt',
  'Israel': 'il', 'Uzbekistan': 'uz', 'China': 'cn', 'Thailand': 'th',
  'Afghanistan': 'af', 'Andorra': 'ad', 'Antigua and Barbuda': 'ag', 'Aruba': 'aw',
  'Azerbaijan': 'az', 'Bangladesh': 'bd', 'Barbados': 'bb', 'Belarus': 'by', 'Bermuda': 'bm',
  'Bolivia': 'bo', 'Brunei Darussalam': 'bn', 'Bulgaria': 'bg', 'Burundi': 'bi',
  'Central African Republic': 'cf', 'Chad': 'td', 'Chinese Taipei': 'tw', 'Comoros': 'km',
  "Cote d'Ivoire": 'ci', 'Cuba': 'cu', 'Curacao': 'cw', 'Dominican Republic': 'do',
  'El Salvador': 'sv', 'Eritrea': 'er', 'Faroe Islands': 'fo', 'French Guiana': 'gf',
  'Grenada': 'gd', 'Guadeloupe': 'gp', 'Guatemala': 'gt', 'Guinea-Bissau': 'gw',
  'Guyana': 'gy', 'Haiti': 'ht', 'Iraq': 'iq', 'Ireland': 'ie', 'Jordan': 'jo',
  'Kazakhstan': 'kz', 'Kenya': 'ke', 'Korea, North': 'kp', 'Korea, South': 'kr',
  'Kyrgyzstan': 'kg', 'Lebanon': 'lb', 'Liberia': 'lr', 'Libya': 'ly',
  'Liechtenstein': 'li', 'Macao': 'mo', 'Madagascar': 'mg', 'Malawi': 'mw',
  'Malaysia': 'my', 'Martinique': 'mq', 'Mauritania': 'mr', 'Mauritius': 'mu',
  'Moldova': 'md', 'Monaco': 'mc', 'Montserrat': 'ms', 'New Caledonia': 'nc',
  'New Zealand': 'nz', 'Niger': 'ne', 'Pakistan': 'pk', 'Palestine': 'ps', 'Panama': 'pa',
  'Papua New Guinea': 'pg', 'Philippines': 'ph', 'Puerto Rico': 'pr', 'Qatar': 'qa',
  'Russia': 'ru', 'Rwanda': 'rw', 'Réunion': 're', 'Saint-Martin': 'mf',
  'San Marino': 'sm', 'Sao Tome and Principe': 'st', 'Seychelles': 'sc',
  'Sierra Leone': 'sl', 'Somalia': 'so', 'Southern Sudan': 'ss', 'St. Lucia': 'lc',
  'Suriname': 'sr', 'Syria': 'sy', 'Tahiti': 'pf', 'Tajikistan': 'tj', 'Tanzania': 'tz',
  'The Gambia': 'gm', 'Trinidad and Tobago': 'tt', 'Turkmenistan': 'tm',
  'Türkiye': 'tr', 'Uganda': 'ug', 'United Arab Emirates': 'ae',
  'United States': 'us', 'Vanuatu': 'vu', 'Vietnam': 'vn',
};

const LEAGUE_LOGO_MAP = {
  'GB1': 'gb1', 'ES1': 'es1', 'IT1': 'it1', 'L1': 'l1', 'FR1': 'fr1',
  'NL1': 'nl1', 'PO1': 'po1', 'TR1': 'tr1', 'MLS1': 'mls1', 'SA1': 'sa1',
  'JAP1': 'jap1', 'BRA1': 'bra1', 'ARG1': 'arg1', 'MEX1': 'mex1',
  'AUS1': 'aus1', 'RSK1': 'rsk1', 'CL': 'cl', 'EL': 'el',
  'SC1': 'sc1', 'BE1': 'be1', 'GR1': 'gr1', 'RU1': 'ru1', 'UKR1': 'ukr1',
  'GB2': 'gb2', 'ES2': 'es2', 'IT2': 'it2', 'L2': 'l2', 'FR2': 'fr2',
  'A1': 'a1', 'C1': 'c1', 'COL1': 'col1', 'DK1': 'dk1', 'KR1': 'kr1',
  'NO1': 'no1', 'PL1': 'pl1', 'RO1': 'ro1', 'SE1': 'se1', 'SER1': 'ser1', 'TS1': 'ts1',
};

// Check countries
const countries = new Set();
db.players.forEach(p => { if (p.country) countries.add(p.country); });
const missingC = [...countries].sort().filter(c => !COUNTRY_FLAG_CODES[c]);

// Check leagues
const leagues = new Set();
db.players.forEach(p => {
  if (p.clubs) p.clubs.forEach(c => { if (c.league) leagues.add(c.league); });
  if (p.currentClub && p.currentClub.league) leagues.add(p.currentClub.league);
});
const missingL = [...leagues].sort().filter(l => !LEAGUE_LOGO_MAP[l]);

// Check league logo files exist
const logoDir = 'frontend/public/logos/competitions';
const missingFiles = [];
for (const [code, file] of Object.entries(LEAGUE_LOGO_MAP)) {
  const path = `${logoDir}/${file}.png`;
  if (!fs.existsSync(path)) missingFiles.push(`${code} -> ${path}`);
}

console.log('=== COUNTRIES ===');
console.log(`DB: ${countries.size} | Mapped: ${Object.keys(COUNTRY_FLAG_CODES).length}`);
console.log(`Missing: ${missingC.length === 0 ? 'NONE ✅' : missingC.join(', ')}`);
console.log('');
console.log('=== LEAGUES ===');
console.log(`DB: ${leagues.size} | Mapped: ${Object.keys(LEAGUE_LOGO_MAP).length}`);
console.log(`Missing mapping: ${missingL.length === 0 ? 'NONE ✅' : missingL.join(', ')}`);
console.log(`Missing files: ${missingFiles.length === 0 ? 'NONE ✅' : missingFiles.join(', ')}`);
