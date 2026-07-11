/*
 * data.js -- Mock data layer for the BloomKnights solar coverage demo.
 *
 * METRIC: "coverage" = share of households using solar/renewables
 * (0 = none -> red, 1 = full -> blue). Same color rule at every level.
 *
 * DEMO PATH (hackathon): USA -> Florida -> Orlando -> Pine Hills.
 * Only the demo path is clickable; everything else is hover-metrics only.
 *
 * PINE HILLS LEAD MAP = REAL BUILDINGS
 * ------------------------------------
 * The house level fetches real building positions + street names around
 * Pine Hills from OpenStreetMap (Overpass API) IN THE BROWSER, caches them
 * in localStorage (so the demo works offline after one successful load),
 * and colors each real building with demo coverage values. If the fetch
 * fails entirely, a synthetic plat (own drawn street grid) renders instead
 * so the demo never breaks.
 */

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

// ---- Level 1: coverage by state --------------------------------------------
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

// ---- Level 2: coverage by city (FL hand-tuned = demo path) ------------------
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

const CITY_STATS = {};

function precomputeAllData() {
  Object.keys(US_CITIES).forEach(function (abbr) {
    CITY_STATS[abbr] = US_CITIES[abbr].map(function (c) {
      const coverage = cityCoverage(abbr, c);
      const households = Math.round(c.pop * 0.38);
      return Object.assign({}, c, {
        id: abbr.toLowerCase() + '-' + c.name.toLowerCase().replace(/[^a-z]+/g, '-'),
        coverage: coverage,
        households: households,
        uncovered: Math.round(households * (1 - coverage)),
      });
    });
  });
}

// ---- Level 3: Orlando neighborhoods (bubble level) ---------------------------
const ORLANDO_HOODS = [
  { name: 'Winter Park',   lat: 28.596, lng: -81.351, coverage: 0.72, households: 12400 },
  { name: 'Baldwin Park',  lat: 28.567, lng: -81.327, coverage: 0.62, households: 5200 },
  { name: 'College Park',  lat: 28.570, lng: -81.390, coverage: 0.48, households: 7800 },
  { name: 'Downtown',      lat: 28.543, lng: -81.373, coverage: 0.38, households: 9600 },
  { name: 'Milk District', lat: 28.539, lng: -81.350, coverage: 0.44, households: 4300 },
  { name: 'Conway',        lat: 28.499, lng: -81.351, coverage: 0.30, households: 6100 },
  { name: 'MetroWest',     lat: 28.516, lng: -81.468, coverage: 0.34, households: 11800 },
  { name: 'Pine Hills',    lat: 28.578, lng: -81.454, coverage: 0.14, households: 21500 },
  { name: 'Lake Nona',     lat: 28.402, lng: -81.253, coverage: 0.58, households: 8900 },
].map(function (h) {
  return Object.assign({}, h, { uncovered: Math.round(h.households * (1 - h.coverage)) });
});

const HERO_HOOD_NAME = 'Pine Hills';

const NEIGHBORHOOD_LISTINGS = {
  'Pine Hills': [
    {
      address: '2148 Sun Meadow Ln', coverage: '14%', solarInstalled: 'No', roofSqft: '1,620',
      estSavings: '$1,240/yr', badge: 'Hot lead', note: 'Large roof and strong savings upside',
      score: 82, utilityBill: '$178/mo', shade: 'Low',
      // Demo photo (hotlinked; photoFallback used if primary fails to load)
      photo: 'https://images.pexels.com/photos/106399/pexels-photo-106399.jpeg?auto=compress&cs=tinysrgb&w=1000',
      photoFallback: 'https://images.pexels.com/photos/323780/pexels-photo-323780.jpeg?auto=compress&cs=tinysrgb&w=1000',
      beds: 3, baths: 2, homeSqft: '1,860', yearBuilt: 2004,
      roofType: 'Asphalt shingle', roofAge: '6 yrs', orientation: 'South-facing', sunHours: '5.8 hrs/day',
      systemSize: '7.2 kW', installEstimate: '$18,400', paybackYears: '7.1 yrs',
      incentives: '30% federal ITC eligible', utility: 'Duke Energy',
      highlights: ['South-facing roof', 'No shade', 'High utility bill', 'Roof under 10 yrs old'],
      aiSummary: null, // filled by the Gemini integration at demo time
    },
    { address: '1820 Willow Bend St', coverage: '22%', solarInstalled: 'No', roofSqft: '1,940', estSavings: '$1,540/yr', badge: 'High match', note: 'Great roof profile for solar conversion', score: 91, utilityBill: '$201/mo', shade: 'Low' },
    { address: '1655 Bloom Ave', coverage: '31%', solarInstalled: 'Yes', roofSqft: '1,480', estSavings: '$980/yr', badge: 'Warm lead', note: 'Ideal for a targeted outreach push', score: 74, utilityBill: '$164/mo', shade: 'Medium' },
    { address: '1912 Cedar Xing', coverage: '19%', solarInstalled: 'No', roofSqft: '1,760', estSavings: '$1,310/yr', badge: 'Queue next', note: 'Open roof area with good exposure', score: 79, utilityBill: '$186/mo', shade: 'Low' },
    { address: '2087 Solar Way', coverage: '27%', solarInstalled: 'No', roofSqft: '1,840', estSavings: '$1,410/yr', badge: 'Budget fit', note: 'Strong potential for a lower-cost install', score: 87, utilityBill: '$192/mo', shade: 'Low' },
    {
      address: '1736 Palm Ct', coverage: '86%', solarInstalled: 'Yes', roofSqft: '1,560',
      estSavings: '$310/yr', badge: 'Covered', note: 'Already on renewables — the reference home for this street',
      score: 38, utilityBill: '$104/mo', shade: 'Low',
      roofType: 'Asphalt shingle', roofAge: '4 yrs', orientation: 'South-west', sunHours: '5.6 hrs/day',
      systemSize: '6.0 kW (installed 2023)', utility: 'Duke Energy',
      highlights: ['Already covered', 'Referral candidate', 'Battery add-on prospect'],
      aiSummary: null,
    },
    { address: '2210 Knight Grove Rd', coverage: '16%', solarInstalled: 'No', roofSqft: '1,720', estSavings: '$1,260/yr', badge: 'Fresh lead', note: 'Wide roof with minimal tree obstruction', score: 84, utilityBill: '$184/mo', shade: 'Low' },
    { address: '2398 Silver Pine Dr', coverage: '24%', solarInstalled: 'No', roofSqft: '1,900', estSavings: '$1,450/yr', badge: 'Strong fit', note: 'Great roof geometry and high utility spend', score: 89, utilityBill: '$205/mo', shade: 'Low' },
  ],
  'Winter Park': [
    { address: '2001 Park Ave', coverage: '76%', solarInstalled: 'Yes', roofSqft: '2,360', estSavings: '$1,860/yr', badge: 'High value', note: 'Premium roofline with strong rooftop potential', score: 95, utilityBill: '$242/mo', shade: 'Low' },
    { address: '1112 Lakeview Dr', coverage: '68%', solarInstalled: 'No', roofSqft: '2,040', estSavings: '$1,620/yr', badge: 'Sunny roof', note: 'Excellent fit for a solar upgrade', score: 90, utilityBill: '$218/mo', shade: 'Low' },
    { address: '1504 Orange Grove Rd', coverage: '71%', solarInstalled: 'Yes', roofSqft: '2,180', estSavings: '$1,740/yr', badge: 'High match', note: 'Shaded roof sections but still a strong case', score: 88, utilityBill: '$228/mo', shade: 'Medium' },
    { address: '1222 Magnolia St', coverage: '64%', solarInstalled: 'No', roofSqft: '2,090', estSavings: '$1,580/yr', badge: 'Good fit', note: 'Large south-facing roof area', score: 86, utilityBill: '$214/mo', shade: 'Low' },
    { address: '1308 Willow Ave', coverage: '73%', solarInstalled: 'Yes', roofSqft: '2,300', estSavings: '$1,790/yr', badge: 'Hot lead', note: 'Very strong roof exposure and utility profile', score: 93, utilityBill: '$239/mo', shade: 'Low' },
  ],
  'Baldwin Park': [
    { address: '780 Newbury St', coverage: '61%', solarInstalled: 'Yes', roofSqft: '1,980', estSavings: '$1,420/yr', badge: 'Great fit', note: 'Modern roofline and attractive savings', score: 85, utilityBill: '$197/mo', shade: 'Low' },
    { address: '815 Harbor Dr', coverage: '58%', solarInstalled: 'No', roofSqft: '1,860', estSavings: '$1,310/yr', badge: 'Warm lead', note: 'Good roof geometry for a straightforward install', score: 83, utilityBill: '$191/mo', shade: 'Medium' },
    { address: '902 Market Ave', coverage: '66%', solarInstalled: 'Yes', roofSqft: '2,040', estSavings: '$1,470/yr', badge: 'Strong value', note: 'High-utility roof with existing solar readiness', score: 89, utilityBill: '$204/mo', shade: 'Low' },
    { address: '711 Lakefront Dr', coverage: '63%', solarInstalled: 'No', roofSqft: '2,100', estSavings: '$1,450/yr', badge: 'Open lane', note: 'Excellent roofline and very good sun exposure', score: 87, utilityBill: '$199/mo', shade: 'Low' },
  ],
};

// The two functional demo homes (Zillow-style cards + clickable map dots):
// a hot lead with poor coverage, and a fully covered reference home.
const HERO_LEAD_ADDRESS = '2148 Sun Meadow Ln';
const HERO_COVERED_ADDRESS = '1736 Palm Ct';

// ---- Level 4a: REAL Pine Hills buildings from OpenStreetMap ------------------
// Bbox = the residential pocket just east of Pine Hills Rd / north of Silver
// Star Rd. Widened for the demo (~1.1 x 1.5 km) so the plotting extends a
// bit further across the focus neighborhood; still small enough to fetch fast.
// Tight camera frame — zoomed in onto ~one street cluster so only a small
// number of dots render (fast load; only two homes are clicked in the demo).
const REAL_HOOD_BBOX = { s: 28.5792, w: -81.4588, n: 28.5812, e: -81.4560 };
// Fetch a bit wider than the camera frames so every building visible in the
// viewport (which is wider than the framed box) still gets a dot. Culled by
// distance-to-center in buildRealHood so the marker count stays sane.
const REAL_FETCH_BBOX = { s: 28.5780, w: -81.4606, n: 28.5824, e: -81.4542 };
const OVERPASS_ENDPOINTS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
];
const HOOD_CACHE_KEY = 'bloomknights-pinehills-osm-v7';

function overpassQuery() {
  const b = REAL_FETCH_BBOX;
  const bbox = b.s + ',' + b.w + ',' + b.n + ',' + b.e;
  return '[out:json][timeout:30];' +
    'way["building"](' + bbox + ');out center;' +
    'way["highway"]["name"](' + bbox + ');out geom;';
}

// Overpass JSON -> { buildings: [{lat,lng}], streets: [{name,kind,path}] }
function parseOverpass(json) {
  const buildings = [];
  const streets = [];
  (json.elements || []).forEach(function (el) {
    if (el.center) {
      buildings.push({ lat: el.center.lat, lng: el.center.lon });
    } else if (el.geometry && el.tags && el.tags.name) {
      streets.push({
        name: el.tags.name,
        kind: el.tags.highway || '',
        path: el.geometry.map(function (g) { return [g.lat, g.lon]; }),
      });
    }
  });
  return { buildings: buildings, streets: streets };
}

// Browser-only. Resolves with parsed data (from cache when available).
function fetchRealHood() {
  try {
    const cached = localStorage.getItem(HOOD_CACHE_KEY);
    if (cached) {
      const data = JSON.parse(cached);
      if (data && data.buildings && data.buildings.length) return Promise.resolve(data);
    }
  } catch (e) { /* private mode / corrupt cache -> refetch */ }

  const tryEndpoint = function (i) {
    if (i >= OVERPASS_ENDPOINTS.length) return Promise.reject(new Error('overpass unavailable'));
    const ctrl = new AbortController();
    const timer = setTimeout(function () { ctrl.abort(); }, 25000);
    return fetch(OVERPASS_ENDPOINTS[i] + '?data=' + encodeURIComponent(overpassQuery()), { signal: ctrl.signal })
      .then(function (r) {
        if (!r.ok) throw new Error('http ' + r.status);
        return r.json();
      })
      .then(function (json) {
        clearTimeout(timer);
        const data = parseOverpass(json);
        if (!data.buildings.length) throw new Error('no buildings in response');
        try { localStorage.setItem(HOOD_CACHE_KEY, JSON.stringify(data)); } catch (e) { /* quota */ }
        return data;
      })
      .catch(function () {
        clearTimeout(timer);
        return tryEndpoint(i + 1);
      });
  };
  return tryEndpoint(0);
}

// Point -> polyline squared distance (degree space; fine at this scale)
function distToPath(lat, lng, path) {
  let best = Infinity;
  for (let i = 0; i < path.length - 1; i++) {
    const ay = path[i][0], ax = path[i][1], by = path[i + 1][0], bx = path[i + 1][1];
    const dx = bx - ax, dy = by - ay;
    const len2 = dx * dx + dy * dy;
    let t = len2 ? ((lng - ax) * dx + (lat - ay) * dy) / len2 : 0;
    t = Math.max(0, Math.min(1, t));
    const px = ax + t * dx, py = ay + t * dy;
    const d2 = (lng - px) * (lng - px) + (lat - py) * (lat - py);
    if (d2 < best) best = d2;
  }
  return best;
}

// Raw OSM -> demo houses. Deterministic coverage (seeded by coords) with a
// "recently converted" blue pocket in the NE so the map tells a story.
// Hero street = the residential street with the most houses; its homes are
// the functional "canvass route" highlighted in the UI.
function buildRealHood(raw) {
  const pocket = { lat: REAL_HOOD_BBOX.n - 0.0009, lng: REAL_HOOD_BBOX.e - 0.0014 };
  const sigma = 0.0018;
  const counts = {};

  const houses = raw.buildings.map(function (bld) {
    const rand = seededRandom(hashString('ph' + Math.round(bld.lat * 1e5) + ':' + Math.round(bld.lng * 1e5)));

    let bestD = Infinity, bestStreet = null;
    raw.streets.forEach(function (st) {
      const d = distToPath(bld.lat, bld.lng, st.path);
      if (d < bestD) { bestD = d; bestStreet = st; }
    });
    const streetName = bestStreet ? bestStreet.name : 'Pine Hills Rd';
    counts[streetName] = (counts[streetName] || 0) + 1;

    const dLat = bld.lat - pocket.lat, dLng = bld.lng - pocket.lng;
    const boost = 0.62 * Math.exp(-(dLat * dLat + dLng * dLng) / (2 * sigma * sigma));
    const coverage = clamp(0.10 + boost + (rand() - 0.5) * 0.14, 0.02, 0.95);
    const roofSqft = 1250 + Math.floor(rand() * 1150);

    return {
      lat: bld.lat,
      lng: bld.lng,
      coverage: coverage,
      hasSolar: coverage >= 0.5,
      street: streetName,
      address: (4300 + Math.round((bld.lng - REAL_HOOD_BBOX.w) * 90000)) + ' ' + streetName,
      roofSqft: roofSqft,
      estAnnualSavings: Math.round((520 + roofSqft * 0.9) * (1 - coverage) + 240),
    };
  });

  let heroName = null, heroCount = 0;
  raw.streets.forEach(function (st) {
    const n = counts[st.name] || 0;
    const residential = st.kind === 'residential' || st.kind === 'tertiary' || st.kind === 'unclassified' || st.kind === 'living_street';
    if (residential && n > heroCount) { heroName = st.name; heroCount = n; }
  });

  // Zoomed in tight, so keep a dot on every building in (and just around) the
  // viewport — no house should be missing a point. The hard cap stays only as a
  // safety valve in case the fetch area is ever widened again.
  const v = REAL_HOOD_BBOX;
  const clat = (v.s + v.n) / 2, clng = (v.w + v.e) / 2;
  const hLat = (v.n - v.s) / 2, hLng = (v.e - v.w) / 2;
  const normDist = function (h) {
    const dy = (h.lat - clat) / hLat, dx = (h.lng - clng) / hLng;
    return Math.sqrt(dy * dy + dx * dx);
  };
  let kept = houses;
  const CAP = 2400;
  if (kept.length > CAP) {
    kept = kept.slice().sort(function (a, b) { return normDist(a) - normDist(b); }).slice(0, CAP);
  }

  return {
    houses: kept,
    heroName: heroName,
    heroPaths: heroName ? raw.streets.filter(function (s) { return s.name === heroName; }).map(function (s) { return s.path; }) : [],
    real: true,
  };
}

// ---- Level 4b: synthetic plat FALLBACK (only if OSM fetch fails) -------------
const PLAT_STREETS = ['Bloom Ave', 'Silver Pine Dr', 'Willow Bend St', 'Sun Meadow Ln', 'Knight Grove Rd', 'Harvest Ln'];
const PLAT_CROSS = ['Palm Ct', 'Cedar Xing', 'Solar Way', 'Maple Ct'];

function buildHeroPlat() {
  const rand = seededRandom(hashString('pine-hills-plat'));
  const lat0 = 28.5734;
  const lng0 = -81.4607, lng1 = -81.4473;
  const streetGap = 0.0016;
  const houseStep = 0.00082;
  const setback = 0.00034;
  const HALF_LAT = 0.00013, HALF_LNG = 0.00015;

  const streets = [];
  const houses = [];

  const crossXs = [lng0 + 0.0031, lng0 + 0.0064, lng0 + 0.0097, lng0 + 0.0121];
  const latTop = lat0 + (PLAT_STREETS.length - 1) * streetGap;
  const cross = crossXs.map(function (x, j) {
    return { name: PLAT_CROSS[j], path: [[lat0 - 0.0006, x], [latTop + 0.0006, x]], cross: true };
  });

  const pocket = { lat: latTop - 0.0009, lng: lng1 - 0.0014 };
  const sigma = 0.0018;

  PLAT_STREETS.forEach(function (name, i) {
    const y = lat0 + i * streetGap;
    streets.push({ name: name, path: [[y, lng0 - 0.0004], [y, lng1 + 0.0004]], cross: false });

    [-1, 1].forEach(function (side) {
      const rowLat = y + side * setback;
      for (let x = lng0 + 0.0007; x <= lng1 - 0.0005; x += houseStep) {
        if (crossXs.some(function (cx) { return Math.abs(x - cx) < 0.00045; })) continue;
        if (rand() < 0.07) continue;

        const dLat = rowLat - pocket.lat, dLng = x - pocket.lng;
        const boost = 0.62 * Math.exp(-(dLat * dLat + dLng * dLng) / (2 * sigma * sigma));
        const coverage = clamp(0.10 + boost + (rand() - 0.5) * 0.14, 0.02, 0.95);
        const roofSqft = 1250 + Math.floor(rand() * 1150);

        houses.push({
          lat: rowLat + (rand() - 0.5) * 0.00006,
          lng: x + (rand() - 0.5) * 0.00006,
          halfLat: HALF_LAT, halfLng: HALF_LNG,
          coverage: coverage,
          hasSolar: coverage >= 0.5,
          address: (4300 + Math.round((x - lng0) * 90000)) + ' ' + name,
          street: name,
          roofSqft: roofSqft,
          estAnnualSavings: Math.round((520 + roofSqft * 0.9) * (1 - coverage) + 240),
        });
      }
    });
  });

  return {
    streets: streets.concat(cross),
    houses: houses,
    bounds: [[lat0 - 0.0012, lng0 - 0.0008], [latTop + 0.0012, lng1 + 0.0008]],
  };
}

let HERO_PLAT = null;
function getHeroPlat() {
  if (!HERO_PLAT) HERO_PLAT = buildHeroPlat();
  return HERO_PLAT;
}
