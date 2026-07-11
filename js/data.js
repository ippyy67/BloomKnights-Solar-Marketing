/*
 * data.js
 * Mock data layer for the BloomKnights solar coverage demo.
 *
 * In a real product, GLOBAL_METROS / regional / city numbers would come from
 * a solar-permit or utility-interconnection dataset (e.g. county assessor +
 * utility net-metering records) joined against rooftop/parcel data. For this
 * hackathon build we synthesize plausible-looking data so the drill-down UX
 * (global -> regional -> city) can be demoed end to end.
 *
 * "opportunity" = estimated share of homes in an area WITHOUT solar
 * (0 = fully covered, 1 = almost no solar penetration). Higher is exactly
 * what a solar sales team wants to find.
 *
 * RENDERING MODEL
 * ----------------
 * Instead of feeding Leaflet.heat a scatter of random jittered points (which
 * reads as a cluster of blobs), we build a dense, evenly-spaced GRID over
 * the relevant bounding box and assign every grid cell an intensity value
 * via Gaussian falloff from the nearby "source" points (metros / hotspots /
 * leads). That grid is what gets fed to the heat layer, so the result is a
 * continuous, area-based gradient -- much closer to a real temperature map
 * -- rather than a handful of visually separate dots. The clickable dot
 * markers stay on top as the interactive layer.
 *
 * PRECOMPUTATION
 * ----------------
 * All regional and city fields are deterministic (seeded by id), so they're
 * computed once up front (see precomputeAllData() at the bottom) instead of
 * on every click. Drilling down is then just a cache lookup -- no per-click
 * generation cost, which is what was making the regional transition feel
 * slow.
 */

// ---- Level 1: Global (major US metros) ----------------------------------
const GLOBAL_METROS = [
  { id: 'nyc', name: 'New York, NY',    lat: 40.7128, lng: -74.0060, opportunity: 0.62 },
  { id: 'la',  name: 'Los Angeles, CA', lat: 34.0522, lng: -118.2437, opportunity: 0.35 },
  { id: 'chi', name: 'Chicago, IL',     lat: 41.8781, lng: -87.6298, opportunity: 0.71 },
  { id: 'hou', name: 'Houston, TX',     lat: 29.7604, lng: -95.3698, opportunity: 0.58 },
  { id: 'phx', name: 'Phoenix, AZ',     lat: 33.4484, lng: -112.0740, opportunity: 0.28 },
  { id: 'orl', name: 'Orlando, FL',     lat: 28.5383, lng: -81.3792, opportunity: 0.74 },
  { id: 'mia', name: 'Miami, FL',       lat: 25.7617, lng: -80.1918, opportunity: 0.66 },
  { id: 'den', name: 'Denver, CO',      lat: 39.7392, lng: -104.9903, opportunity: 0.44 },
  { id: 'sea', name: 'Seattle, WA',     lat: 47.6062, lng: -122.3321, opportunity: 0.81 },
  { id: 'atl', name: 'Atlanta, GA',     lat: 33.7490, lng: -84.3880, opportunity: 0.69 },
  { id: 'dal', name: 'Dallas, TX',      lat: 32.7767, lng: -96.7970, opportunity: 0.52 },
  { id: 'bos', name: 'Boston, MA',      lat: 42.3601, lng: -71.0589, opportunity: 0.57 },
];

// Simple deterministic PRNG so a given metro/hotspot always regenerates the
// same-looking data (nicer for demoing than pure Math.random jitter).
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

function clamp01(n) {
  return Math.max(0.03, Math.min(1, n));
}

// ---- Core field builder ---------------------------------------------------
// sources: [{lat, lng, opportunity}]
// bounds: {latMin, latMax, lngMin, lngMax}
// Returns an array of [lat, lng, intensity] covering the whole bounding box.
function buildField(sources, bounds, gridSize, sigmaDeg, baseline) {
  const points = [];
  const latStep = (bounds.latMax - bounds.latMin) / (gridSize - 1);
  const lngStep = (bounds.lngMax - bounds.lngMin) / (gridSize - 1);
  const twoSigmaSq = 2 * sigmaDeg * sigmaDeg;

  for (let i = 0; i < gridSize; i++) {
    const lat = bounds.latMin + i * latStep;
    for (let j = 0; j < gridSize; j++) {
      const lng = bounds.lngMin + j * lngStep;
      let intensity = baseline;
      for (let k = 0; k < sources.length; k++) {
        const s = sources[k];
        const dLat = lat - s.lat;
        const dLng = lng - s.lng;
        const distSq = dLat * dLat + dLng * dLng;
        const falloff = Math.exp(-distSq / twoSigmaSq);
        intensity += s.opportunity * falloff * 0.88;
      }
      points.push([lat, lng, clamp01(intensity)]);
    }
  }
  return points;
}

// ---- Level 1 field: continental US ----------------------------------------
const GLOBAL_BOUNDS = { latMin: 23, latMax: 49.5, lngMin: -125, lngMax: -66 };
const GLOBAL_GRID_SIZE = 44;
const GLOBAL_SIGMA_DEG = 2.6;

function buildGlobalField() {
  return buildField(GLOBAL_METROS, GLOBAL_BOUNDS, GLOBAL_GRID_SIZE, GLOBAL_SIGMA_DEG, 0.03);
}

// ---- Level 2: Regional (generated around a metro) --------------------------
// Produces cluster "hotspot" centers (clickable dots) + a smooth field built
// from those same clusters.
function generateRegionalClusters(metro) {
  const rand = seededRandom(hashString(metro.id + '-region'));
  const clusterCount = 4 + Math.floor(rand() * 2); // 4-5 clusters
  const clusters = [];

  for (let i = 0; i < clusterCount; i++) {
    const angle = rand() * Math.PI * 2;
    const dist = 0.4 + rand() * 1.2; // degrees, roughly county-scale
    const intensity = clamp01(metro.opportunity + (rand() - 0.35) * 0.4);
    clusters.push({
      id: `${metro.id}-c${i}`,
      name: `${metro.name.split(',')[0]} Sector ${i + 1}`,
      lat: metro.lat + Math.cos(angle) * dist,
      lng: metro.lng + Math.sin(angle) * dist,
      opportunity: intensity,
    });
  }
  return clusters;
}

const REGIONAL_HALF_SPAN_DEG = 2.2;
const REGIONAL_GRID_SIZE = 30;
const REGIONAL_SIGMA_DEG = 0.6;

function buildRegionalField(metro, clusters) {
  const bounds = {
    latMin: metro.lat - REGIONAL_HALF_SPAN_DEG,
    latMax: metro.lat + REGIONAL_HALF_SPAN_DEG,
    lngMin: metro.lng - REGIONAL_HALF_SPAN_DEG,
    lngMax: metro.lng + REGIONAL_HALF_SPAN_DEG,
  };
  return buildField(clusters, bounds, REGIONAL_GRID_SIZE, REGIONAL_SIGMA_DEG, 0.04);
}

// ---- Level 3: City (generated around a regional hotspot) -------------------
// Produces mock "leads" (clickable dots with sales-relevant stats) + a
// smooth field built from those leads.
const STREET_NAMES = [
  'Maple', 'Sunset', 'Palm', 'Cedar', 'Willow', 'Magnolia', 'Live Oak',
  'Lakeview', 'Ridgeline', 'Hillcrest', 'Bayview', 'Orchard',
];

function generateCityLeads(hotspot) {
  const rand = seededRandom(hashString(hotspot.id + '-city'));
  const leadClusters = 3 + Math.floor(rand() * 2); // 3-4 lead pins
  const leads = [];

  for (let i = 0; i < leadClusters; i++) {
    const angle = rand() * Math.PI * 2;
    const dist = 0.01 + rand() * 0.04; // degrees, roughly neighborhood-scale
    const lat = hotspot.lat + Math.cos(angle) * dist;
    const lng = hotspot.lng + Math.sin(angle) * dist;
    const opportunity = clamp01(hotspot.opportunity + (rand() - 0.4) * 0.3);

    const homesWithoutSolar = 80 + Math.floor(rand() * 260);
    const avgRoofSqft = 1400 + Math.floor(rand() * 900);
    const estAnnualSavings = 900 + Math.floor(rand() * 900);

    leads.push({
      id: `${hotspot.id}-lead${i}`,
      street: `${STREET_NAMES[Math.floor(rand() * STREET_NAMES.length)]} ${['St', 'Ave', 'Dr', 'Ln'][Math.floor(rand() * 4)]}`,
      lat,
      lng,
      opportunity,
      homesWithoutSolar,
      avgRoofSqft,
      estAnnualSavings,
    });
  }
  return leads;
}

const CITY_HALF_SPAN_DEG = 0.09;
const CITY_GRID_SIZE = 24;
const CITY_SIGMA_DEG = 0.025;

function buildCityField(hotspot, leads) {
  const bounds = {
    latMin: hotspot.lat - CITY_HALF_SPAN_DEG,
    latMax: hotspot.lat + CITY_HALF_SPAN_DEG,
    lngMin: hotspot.lng - CITY_HALF_SPAN_DEG,
    lngMax: hotspot.lng + CITY_HALF_SPAN_DEG,
  };
  return buildField(leads, bounds, CITY_GRID_SIZE, CITY_SIGMA_DEG, 0.05);
}

// ---- Precompute everything once at load -------------------------------
// Attaches ._regionalField / ._clusters onto each metro, and
// ._cityField / ._leads onto each cluster, so drill-down clicks are pure
// cache lookups with zero generation cost.
let GLOBAL_FIELD = null;

function precomputeAllData() {
  GLOBAL_FIELD = buildGlobalField();

  GLOBAL_METROS.forEach((metro) => {
    const clusters = generateRegionalClusters(metro);
    metro._clusters = clusters;
    metro._regionalField = buildRegionalField(metro, clusters);

    clusters.forEach((cluster) => {
      const leads = generateCityLeads(cluster);
      cluster._leads = leads;
      cluster._cityField = buildCityField(cluster, leads);
    });
  });
}
