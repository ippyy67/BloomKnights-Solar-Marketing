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
 * "opportunity" / heat weight = estimated share of homes in an area WITHOUT
 * solar (0 = fully covered, 1 = almost no solar penetration). Higher weight
 * is exactly what a solar sales team wants to find.
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

// ---- Level 2: Regional (generated around a clicked metro) ---------------
// Produces a heat point cloud + a handful of clickable "hotspot" cluster
// centers that the user can drill into for the city view.
function generateRegionalData(metro) {
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

  const points = [];
  clusters.forEach((cluster) => {
    const pointsInCluster = 30 + Math.floor(rand() * 20);
    for (let j = 0; j < pointsInCluster; j++) {
      points.push([
        cluster.lat + (rand() - 0.5) * 0.35,
        cluster.lng + (rand() - 0.5) * 0.35,
        clamp01(cluster.opportunity + (rand() - 0.5) * 0.25),
      ]);
    }
  });

  return { points, clusters };
}

// ---- Level 3: City (generated around a clicked regional hotspot) --------
// Produces a dense heat cloud plus a few mock "leads" — individual
// uncovered-home clusters a sales rep could act on.
const STREET_NAMES = [
  'Maple', 'Sunset', 'Palm', 'Cedar', 'Willow', 'Magnolia', 'Live Oak',
  'Lakeview', 'Ridgeline', 'Hillcrest', 'Bayview', 'Orchard',
];

function generateCityData(hotspot) {
  const rand = seededRandom(hashString(hotspot.id + '-city'));
  const points = [];
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

    const pointsInCluster = 25 + Math.floor(rand() * 25);
    for (let j = 0; j < pointsInCluster; j++) {
      points.push([
        lat + (rand() - 0.5) * 0.02,
        lng + (rand() - 0.5) * 0.02,
        clamp01(opportunity + (rand() - 0.5) * 0.2),
      ]);
    }
  }

  return { points, leads };
}

function clamp01(n) {
  return Math.max(0.08, Math.min(1, n));
}
