/*
 * data.js
 * Mock data layer for the BloomKnights solar coverage demo.
 *
 * METRIC
 * ------
 * "coverage" = share of households in an area using solar / renewable energy
 * (0 = none, 1 = fully covered). One color rule everywhere on the site:
 * red = no coverage ... blue = high coverage (see colorForCoverage in app.js).
 *
 * GEOGRAPHY IS REAL, NUMBERS ARE FAKE
 * -----------------------------------
 * State boundaries + city coordinates come from js/geo-data.js (US Census /
 * GeoNames data), so everything lands exactly where it should on the map.
 * Coverage percentages and house-level details are synthesized (deterministic,
 * seeded) for the hackathon demo. Florida / Orlando values are hand-tuned
 * since that's the demo path; other regions ride on seeded generation.
 */

// ---- Deterministic PRNG (same input -> same demo data every load) ---------
function seededRandom(seed) {
  let s = seed % 2147483647;
  if (s <= 0) s += 2147483646;
  return function () {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

function hashString(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = (h << 5) - h + str.charCodeAt(i);
    h |= 0;
  }
  return Math.abs(h) || 1;
}

function clamp(n, lo, hi) {
  return Math.max(lo, Math.min(hi, n));
}

// ---- Level 1: coverage by state (choropleth values) ------------------------
// Hand-authored so the national map reads like an electoral map with a clear
// story: sunbelt + west lead, coal country lags. FL sits mid-low = opportunity.
const STATE_COVERAGE = {
  AL: 0.15, AK: 0.09, AZ: 0.72, AR: 0.17, CA: 0.79, CO: 0.55, CT: 0.45,
  DE: 0.36, DC: 0.50, FL: 0.42, GA: 0.33, HI: 0.84, ID: 0.31, IL: 0.30,
  IN: 0.18, IA: 0.41, KS: 0.36, KY: 0.10, LA: 0.13, ME: 0.38, MD: 0.42,
  MA: 0.58, MI: 0.21, MN: 0.34, MS: 0.11, MO: 0.22, MT: 0.19, NE: 0.30,
  NV: 0.74, NH: 0.35, NJ: 0.56, NM: 0.61, NY: 0.44, NC: 0.47, ND: 0.12,
  OH: 0.22, OK: 0.28, OR: 0.41, PA: 0.24, RI: 0.49, SC: 0.38, SD: 0.27,
  TN: 0.20, TX: 0.38, UT: 0.58, VT: 0.52, VA: 0.30, WA: 0.33, WV: 0.08,
  WI: 0.23, WY: 0.14,
};

// ---- Level 2: coverage by city ---------------------------------------------
// Florida is the demo path -> hand-tuned per city. Everywhere else: state
// coverage +/- seeded jitter.
const FL_CITY_COVERAGE = {
  'Orlando': 0.40, 'Jacksonville': 0.27, 'Miami': 0.52, 'Tampa': 0.38,
  'St. Petersburg': 0.55, 'Hialeah': 0.22, 'Tallahassee': 0.44,
  'Fort Lauderdale': 0.48, 'Cape Coral': 0.61, 'Pembroke Pines': 0.33,
  'Port Saint Lucie': 0.58, 'Hollywood': 0.36, 'Miramar': 0.30,
  'Gainesville': 0.50,
};

function cityCoverage(stateAbbr, city) {
  if (stateAbbr === 'FL' && FL_CITY_COVERAGE[city.name] !== undefined) {
    return FL_CITY_COVERAGE[city.name];
  }
  const rand = seededRandom(hashString(stateAbbr + '-' + city.name));
  return clamp(STATE_COVERAGE[stateAbbr] + (rand() - 0.5) * 0.36, 0.04, 0.92);
}

// Rough household count from population (avg ~2.6 people / household).
function cityHouseholds(city) {
  return Math.round(city.pop * 0.38);
}

// Precomputed once at boot: US_CITIES + coverage + household stats.
// CITY_STATS[abbr] = [{name, lat, lng, pop, coverage, households, uncovered}]
const CITY_STATS = {};

function precomputeAllData() {
  Object.keys(US_CITIES).forEach((abbr) => {
    CITY_STATS[abbr] = US_CITIES[abbr].map((c) => {
      const coverage = cityCoverage(abbr, c);
      const households = cityHouseholds(c);
      return {
        ...c,
        id: abbr.toLowerCase() + '-' + c.name.toLowerCase().replace(/[^a-z]+/g, '-'),
        coverage,
        households,
        uncovered: Math.round(households * (1 - coverage)),
      };
    });
  });
}

// ---- Level 3: houses --------------------------------------------------------
// Houses are generated per city as clustered NEIGHBORHOODS (coverage is
// spatially correlated -- whole streets adopt solar together), laid out on a
// small suburban street grid around the real city center. Lazy + cached so
// nothing is generated until a city is opened.

// Curated Orlando neighborhoods (real districts, approx. real locations) so
// the hero demo drill-down looks intentional, not random.
const ORLANDO_NEIGHBORHOODS = [
  { name: 'Winter Park',   lat: 28.596, lng: -81.351, base: 0.72 },
  { name: 'Baldwin Park',  lat: 28.567, lng: -81.327, base: 0.62 },
  { name: 'College Park',  lat: 28.570, lng: -81.390, base: 0.48 },
  { name: 'Downtown',      lat: 28.543, lng: -81.373, base: 0.38 },
  { name: 'Milk District', lat: 28.539, lng: -81.350, base: 0.44 },
  { name: 'Conway',        lat: 28.499, lng: -81.351, base: 0.30 },
  { name: 'MetroWest',     lat: 28.516, lng: -81.468, base: 0.34 },
  { name: 'Pine Hills',    lat: 28.578, lng: -81.454, base: 0.14 },
  { name: 'Lake Nona',     lat: 28.402, lng: -81.253, base: 0.58 },
];

const GENERIC_HOOD_NAMES = [
  'Northside', 'Riverview', 'Oak Grove', 'Sunset Hills', 'Eastwood',
  'Lakeside', 'Old Town', 'Fairview', 'Meadowbrook', 'Highland Park',
];

const STREET_NAMES = [
  'Maple', 'Sunset', 'Palm', 'Cedar', 'Willow', 'Magnolia', 'Live Oak',
  'Lakeview', 'Ridgeline', 'Hillcrest', 'Bayview', 'Orchard',
];
const STREET_SUFFIXES = ['St', 'Ave', 'Dr', 'Ln', 'Ct', 'Way'];

function generateNeighborhoods(cityStat) {
  if (cityStat.id === 'fl-orlando') return ORLANDO_NEIGHBORHOODS;

  const rand = seededRandom(hashString(cityStat.id + '-hoods'));
  const count = 4 + Math.floor(rand() * 3); // 4-6
  const hoods = [];
  for (let i = 0; i < count; i++) {
    const angle = (i / count) * Math.PI * 2 + rand() * 0.8;
    const dist = 0.012 + rand() * 0.03; // stay near the real city center
    hoods.push({
      name: GENERIC_HOOD_NAMES[(i + Math.floor(rand() * 3)) % GENERIC_HOOD_NAMES.length],
      lat: cityStat.lat + Math.cos(angle) * dist,
      lng: cityStat.lng + Math.sin(angle) * dist * 1.15,
      base: clamp(cityStat.coverage + (rand() - 0.5) * 0.5, 0.05, 0.9),
    });
  }
  return hoods;
}

// Suburban mini-grid per neighborhood: rows of houses along east-west streets.
function generateHousesForHood(cityStat, hood, hoodIndex) {
  const rand = seededRandom(hashString(cityStat.id + '-' + hood.name + hoodIndex));
  const rows = 5 + Math.floor(rand() * 3);      // streets
  const cols = 6 + Math.floor(rand() * 4);      // houses per street
  const rowGap = 0.00165;                        // ~180m between streets
  const colGap = 0.00105;                        // ~100m between houses
  const houses = [];

  const streetOfRow = [];
  for (let r = 0; r < rows; r++) {
    streetOfRow.push(
      STREET_NAMES[Math.floor(rand() * STREET_NAMES.length)] + ' ' +
      STREET_SUFFIXES[Math.floor(rand() * STREET_SUFFIXES.length)]
    );
  }

  const lat0 = hood.lat - (rows / 2) * rowGap;
  const lng0 = hood.lng - (cols / 2) * colGap;

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (rand() < 0.16) continue; // gaps -> looks organic, not a perfect grid
      const coverage = clamp(hood.base + (rand() - 0.5) * 0.34, 0.02, 0.98);
      const roofSqft = 1300 + Math.floor(rand() * 1200);
      houses.push({
        lat: lat0 + r * rowGap + (rand() - 0.5) * 0.0003,
        lng: lng0 + c * colGap + (rand() - 0.5) * 0.0002,
        coverage,
        hood: hood.name,
        address: (100 + c * 8 + Math.floor(rand() * 7)) + ' ' + streetOfRow[r],
        roofSqft,
        hasSolar: coverage >= 0.5,
        // Sales pitch: the LESS covered a home is, the more it saves by going solar.
        estAnnualSavings: Math.round((520 + roofSqft * 0.9) * (1 - coverage) + 240),
      });
    }
  }
  return houses;
}

const _houseCache = {};

function getCityDetail(cityStat) {
  if (_houseCache[cityStat.id]) return _houseCache[cityStat.id];
  const hoods = generateNeighborhoods(cityStat);
  const houses = [];
  hoods.forEach((hood, i) => {
    houses.push.apply(houses, generateHousesForHood(cityStat, hood, i));
  });
  const detail = { hoods, houses };
  _houseCache[cityStat.id] = detail;
  return detail;
}
