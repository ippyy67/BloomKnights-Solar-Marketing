const fs = require('fs');
const topojson = require('topojson-client');
const topo = require('us-atlas/states-10m.json');
const allCities = require('all-the-cities');

const DROP = new Set(['American Samoa', 'Guam', 'Commonwealth of the Northern Mariana Islands', 'United States Virgin Islands', 'Puerto Rico']);

const NAME_TO_ABBR = {Alabama:'AL',Alaska:'AK',Arizona:'AZ',Arkansas:'AR',California:'CA',Colorado:'CO',Connecticut:'CT',Delaware:'DE','District of Columbia':'DC',Florida:'FL',Georgia:'GA',Hawaii:'HI',Idaho:'ID',Illinois:'IL',Indiana:'IN',Iowa:'IA',Kansas:'KS',Kentucky:'KY',Louisiana:'LA',Maine:'ME',Maryland:'MD',Massachusetts:'MA',Michigan:'MI',Minnesota:'MN',Mississippi:'MS',Missouri:'MO',Montana:'MT',Nebraska:'NE',Nevada:'NV','New Hampshire':'NH','New Jersey':'NJ','New Mexico':'NM','New York':'NY','North Carolina':'NC','North Dakota':'ND',Ohio:'OH',Oklahoma:'OK',Oregon:'OR',Pennsylvania:'PA','Rhode Island':'RI','South Carolina':'SC','South Dakota':'SD',Tennessee:'TN',Texas:'TX',Utah:'UT',Vermont:'VT',Virginia:'VA',Washington:'WA','West Virginia':'WV',Wisconsin:'WI',Wyoming:'WY'};

// ---- States ----
const geo = topojson.feature(topo, topo.objects.states);
function round(c) {
  if (typeof c[0] === 'number') return [Math.round(c[0] * 1000) / 1000, Math.round(c[1] * 1000) / 1000];
  return c.map(round);
}
// Drop Aleutian rings crossing the antimeridian (lng > 0) so Alaska doesn't smear across the map
function cleanAK(geom) {
  const polys = geom.type === 'MultiPolygon' ? geom.coordinates : [geom.coordinates];
  const kept = polys.filter(poly => !poly[0].some(pt => pt[0] > 0));
  return { type: 'MultiPolygon', coordinates: kept };
}
const feats = geo.features
  .filter(f => !DROP.has(f.properties.name))
  .map(f => {
    let g = f.geometry;
    if (f.properties.name === 'Alaska') g = cleanAK(g);
    const abbr = NAME_TO_ABBR[f.properties.name];
    return { type: 'Feature', id: f.id, properties: { name: f.properties.name, abbr }, geometry: { type: g.type, coordinates: round(g.coordinates) } };
  });
console.log('states kept:', feats.length);

// ---- Cities: top N per state by population (FL gets extra for the demo) ----
const PER_STATE = 8, FL_COUNT = 14;
const byState = {};
allCities
  .filter(c => c.country === 'US' && NAME_TO_ABBR[Object.keys(NAME_TO_ABBR).find(n => NAME_TO_ABBR[n] === c.adminCode)] && c.population > 0)
  .forEach(c => { (byState[c.adminCode] = byState[c.adminCode] || []).push(c); });

const cities = {};
for (const [abbr, list] of Object.entries(byState)) {
  list.sort((a, b) => b.population - a.population);
  const seen = new Set(), out = [];
  const want = abbr === 'FL' ? FL_COUNT : PER_STATE;
  for (const c of list) {
    if (seen.has(c.name)) continue;
    seen.add(c.name);
    out.push({ name: c.name, lat: +c.loc.coordinates[1].toFixed(5), lng: +c.loc.coordinates[0].toFixed(5), pop: c.population });
    if (out.length >= want) break;
  }
  cities[abbr] = out;
}
console.log('city states:', Object.keys(cities).length, 'FL:', cities.FL.map(c => c.name).join(', '));

const js = '/* AUTO-GENERATED geo data: US state boundaries (us-atlas 1:10M, simplified) + top US cities\n' +
  ' * per state by population with REAL coordinates (GeoNames via all-the-cities).\n' +
  ' * Real coords = no more markers in the ocean. Regenerate with tools/gen-geodata.js */\n' +
  'const US_STATES_GEOJSON = ' + JSON.stringify({ type: 'FeatureCollection', features: feats }) + ';\n\n' +
  'const US_CITIES = ' + JSON.stringify(cities) + ';\n';
fs.writeFileSync('/sessions/tender-peaceful-albattani/mnt/BloomKnights-Solar-Marketing/js/geo-data.js', js);
console.log('geo-data.js bytes:', js.length);
