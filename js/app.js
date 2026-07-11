/*
 * app.js
 * Map setup + drill-down interaction: Global -> Regional -> City.
 *
 * All heat data (global/regional/city fields) is precomputed once at boot
 * via precomputeAllData() (see data.js), so every drill-down click is just
 * reading a cached array -- no generation cost at click time.
 */

precomputeAllData();

const map = L.map('map', {
  worldCopyJump: true,
  zoomControl: true,
}).setView([39.5, -98.35], 4); // continental US framing

L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
  attribution: '&copy; OpenStreetMap contributors &copy; CARTO',
  subdomains: 'abcd',
  maxZoom: 19,
}).addTo(map);

const HEAT_GRADIENT = {
  0.0: '#1a3a6b',
  0.2: '#2b6cb0',
  0.4: '#38b2ac',
  0.6: '#ecc94b',
  0.8: '#ed8936',
  1.0: '#e53e3e',
};

let heatLayer = null;
let markerLayer = L.layerGroup().addTo(map);

// Heat layer tuning per zoom level. Since the field is already a dense,
// evenly-spaced grid, radius/blur just need to be big enough to merge
// neighboring cells into a continuous surface -- not so big that the
// canvas blur pass gets expensive on every pan frame.
const HEAT_PRESETS = {
  global:   { radius: 34, blur: 28 },
  regional: { radius: 30, blur: 24 },
  city:     { radius: 26, blur: 20 },
};

function setHeat(points, preset) {
  if (heatLayer) {
    map.removeLayer(heatLayer);
  }
  heatLayer = L.heatLayer(points, {
    radius: preset.radius,
    blur: preset.blur,
    max: 1,
    minOpacity: 0.35,
    maxZoom: 17,
    gradient: HEAT_GRADIENT,
  }).addTo(map);
}

function colorForOpportunity(v) {
  if (v >= 0.75) return '#e53e3e';
  if (v >= 0.55) return '#ed8936';
  if (v >= 0.3) return '#ecc94b';
  return '#38b2ac';
}

function clearMarkers() {
  markerLayer.clearLayers();
}

function createHomeMarker(home) {
  const marker = L.marker([home.lat, home.lng], {
    icon: L.divIcon({
      html: '<div class="sample-home-marker" title="' + home.street + '"></div>',
      className: 'sample-home-marker-wrapper',
      iconSize: [24, 24],
      iconAnchor: [12, 24],
    }),
    riseOnHover: true,
  }).addTo(markerLayer);

  marker.bindTooltip(home.street, { direction: 'top' });
  marker.bindPopup(`<b>${home.street}</b><br/>${Math.round(home.opportunity * 100)}% homes without solar`);

  marker.on('click', () => {
    showInfoPanel(`
      <h4>${home.street} — Sample Home</h4>
      <div class="stat"><span>Homes without solar</span><span>${home.homesWithoutSolar}</span></div>
      <div class="stat"><span>Avg. roof size</span><span>${home.avgRoofSqft} sqft</span></div>
      <div class="stat"><span>Est. annual savings</span><span>$${home.estAnnualSavings}</span></div>
      <div class="stat"><span>Opportunity score</span><span>${Math.round(home.opportunity * 100)}%</span></div>
    `);
  });

  return marker;
}

function showInfoPanel(html) {
  const panel = document.getElementById('info-panel');
  document.getElementById('info-content').innerHTML = html;
  panel.classList.remove('hidden');
}

document.getElementById('info-close').addEventListener('click', () => {
  document.getElementById('info-panel').classList.add('hidden');
});

// ---- Breadcrumb -----------------------------------------------------------
function renderBreadcrumb(path) {
  const nav = document.getElementById('breadcrumb');
  nav.innerHTML = '';
  path.forEach((step, i) => {
    if (i > 0) {
      const sep = document.createElement('span');
      sep.className = 'crumb-sep';
      sep.textContent = '›';
      nav.appendChild(sep);
    }
    const btn = document.createElement('button');
    btn.className = 'crumb' + (i === path.length - 1 ? ' active' : '');
    btn.textContent = step.label;
    btn.dataset.level = step.level;
    if (i !== path.length - 1) {
      btn.addEventListener('click', () => {
        if (step.level === 'global') goGlobal();
        else if (step.level === 'region') goRegion(step.ref);
      });
    }
    nav.appendChild(btn);
  });
}

// ---- Level 1: Global --------------------------------------------------
function goGlobal() {
  document.getElementById('info-panel').classList.add('hidden');
  clearMarkers();
  setHeat(GLOBAL_FIELD, HEAT_PRESETS.global);

  GLOBAL_METROS.forEach((metro) => {
    const marker = L.circleMarker([metro.lat, metro.lng], {
      radius: 7,
      className: 'metro-marker',
      color: '#fff',
      weight: 2,
      fillColor: colorForOpportunity(metro.opportunity),
      fillOpacity: 0.95,
    }).addTo(markerLayer);

    marker.bindTooltip(`${metro.name} — ${Math.round(metro.opportunity * 100)}% uncovered`, {
      direction: 'top',
    });
    marker.on('click', () => goRegion(metro));
  });

  map.flyTo([39.5, -98.35], 4, { duration: 0.6 });
  renderBreadcrumb([{ level: 'global', label: 'Global' }]);
}

// ---- Level 2: Regional --------------------------------------------------
function goRegion(metro) {
  document.getElementById('info-panel').classList.add('hidden');
  clearMarkers();

  // Cached at boot -- no generation cost here.
  setHeat(metro._regionalField, HEAT_PRESETS.regional);

  metro._clusters.forEach((cluster) => {
    const marker = L.circleMarker([cluster.lat, cluster.lng], {
      radius: 8,
      className: 'hotspot-marker',
      color: '#fff',
      weight: 2,
      fillColor: colorForOpportunity(cluster.opportunity),
      fillOpacity: 0.95,
    }).addTo(markerLayer);

    marker.bindTooltip(`${cluster.name} — ${Math.round(cluster.opportunity * 100)}% uncovered`, {
      direction: 'top',
    });
    marker.on('click', () => goCity(cluster, metro));
  });

  map.flyTo([metro.lat, metro.lng], 7, { duration: 0.6 });
  renderBreadcrumb([
    { level: 'global', label: 'Global' },
    { level: 'region', label: metro.name, ref: metro },
  ]);
}

// ---- Level 3: City --------------------------------------------------------
function goCity(hotspot, metro) {
  clearMarkers();

  // Cached at boot -- no generation cost here.
  setHeat(hotspot._cityField, HEAT_PRESETS.city);

  hotspot._leads.forEach((lead) => {
    createHomeMarker(lead);
  });

  map.flyTo([hotspot.lat, hotspot.lng], 13, { duration: 0.6 });
  renderBreadcrumb([
    { level: 'global', label: 'Global' },
    { level: 'region', label: metro.name, ref: metro },
    { level: 'city', label: hotspot.name },
  ]);
}

// ---- Boot -----------------------------------------------------------------
goGlobal();
