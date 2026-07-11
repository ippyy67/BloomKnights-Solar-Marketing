/*
 * app.js
 * Map setup + drill-down interaction: Global -> Regional -> City.
 */

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
  0.0: '#2b6cb0',
  0.3: '#38b2ac',
  0.55: '#ecc94b',
  0.75: '#ed8936',
  1.0: '#e53e3e',
};

let heatLayer = null;
let markerLayer = L.layerGroup().addTo(map);

function setHeat(points, radius, blur) {
  if (heatLayer) {
    map.removeLayer(heatLayer);
  }
  heatLayer = L.heatLayer(points, {
    radius: radius,
    blur: blur,
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
  // path: [{level:'global', label:'Global'}, {level:'region', label, ref}, {level:'city', label, ref}]
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

  const points = GLOBAL_METROS.map((m) => [m.lat, m.lng, m.opportunity]);
  setHeat(points, 45, 35);

  GLOBAL_METROS.forEach((metro) => {
    const marker = L.circleMarker([metro.lat, metro.lng], {
      radius: 8,
      className: 'metro-marker',
      color: '#fff',
      weight: 2,
      fillColor: colorForOpportunity(metro.opportunity),
      fillOpacity: 0.9,
    }).addTo(markerLayer);

    marker.bindTooltip(`${metro.name} — ${Math.round(metro.opportunity * 100)}% uncovered`, {
      direction: 'top',
    });
    marker.on('click', () => goRegion(metro));
  });

  map.flyTo([39.5, -98.35], 4, { duration: 0.9 });
  renderBreadcrumb([{ level: 'global', label: 'Global' }]);
}

// ---- Level 2: Regional --------------------------------------------------
function goRegion(metro) {
  document.getElementById('info-panel').classList.add('hidden');
  clearMarkers();

  const { points, clusters } = generateRegionalData(metro);
  setHeat(points, 30, 25);

  clusters.forEach((cluster) => {
    const marker = L.circleMarker([cluster.lat, cluster.lng], {
      radius: 9,
      className: 'hotspot-marker',
      color: '#fff',
      weight: 2,
      fillColor: colorForOpportunity(cluster.opportunity),
      fillOpacity: 0.95,
    }).addTo(markerLayer);

    marker.bindTooltip(`${cluster.name} — ${Math.round(cluster.opportunity * 100)}% uncovered`, {
      direction: 'top',
    });
    marker.on('click', () => goCity(cluster));
  });

  map.flyTo([metro.lat, metro.lng], 7, { duration: 0.9 });
  renderBreadcrumb([
    { level: 'global', label: 'Global' },
    { level: 'region', label: metro.name, ref: metro },
  ]);
}

// ---- Level 3: City --------------------------------------------------------
function goCity(hotspot) {
  clearMarkers();

  const { points, leads } = generateCityData(hotspot);
  setHeat(points, 20, 18);

  leads.forEach((lead) => {
    const marker = L.circleMarker([lead.lat, lead.lng], {
      radius: 7,
      color: '#fff',
      weight: 2,
      fillColor: colorForOpportunity(lead.opportunity),
      fillOpacity: 0.95,
    }).addTo(markerLayer);

    const popupHtml = `
      <b>${lead.street}</b><br/>
      ${Math.round(lead.opportunity * 100)}% homes without solar
    `;
    marker.bindPopup(popupHtml);

    marker.on('click', () => {
      showInfoPanel(`
        <h4>${lead.street} — Lead Cluster</h4>
        <div class="stat"><span>Homes without solar</span><span>${lead.homesWithoutSolar}</span></div>
        <div class="stat"><span>Avg. roof size</span><span>${lead.avgRoofSqft} sqft</span></div>
        <div class="stat"><span>Est. annual savings</span><span>$${lead.estAnnualSavings}</span></div>
        <div class="stat"><span>Opportunity score</span><span>${Math.round(lead.opportunity * 100)}%</span></div>
      `);
    });
  });

  map.flyTo([hotspot.lat, hotspot.lng], 13, { duration: 0.9 });

  const metro = GLOBAL_METROS.find((m) => hotspot.id.startsWith(m.id));
  renderBreadcrumb([
    { level: 'global', label: 'Global' },
    { level: 'region', label: metro ? metro.name : 'Region', ref: metro },
    { level: 'city', label: hotspot.name },
  ]);
}

// ---- Boot -----------------------------------------------------------------
goGlobal();
