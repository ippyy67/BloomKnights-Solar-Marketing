/*
 * app.js
 * Drill-down map with a distinct visualization per level:
 *
 *   Level 1  USA      -> state CHOROPLETH (electoral-map style: whole state
 *                        tinted by renewable coverage per household)
 *   Level 2  State    -> city BUBBLES (hotspot map: circle size = how much of
 *                        the city is uncovered, color = coverage)
 *   Level 3  City     -> individual HOUSES (parcel squares, blue = covered,
 *                        red = no coverage)
 *
 * One color rule everywhere: red (0% coverage) -> orange -> yellow -> teal ->
 * blue (100% coverage).
 */

precomputeAllData();

const map = L.map('map', {
  worldCopyJump: true,
  zoomControl: true,
  zoomSnap: 0.5,
  preferCanvas: true, // houses render as a few hundred vectors -> canvas is cheap
}).setView([38.8, -96.9], 4);

L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
  attribution: '&copy; OpenStreetMap contributors &copy; CARTO',
  subdomains: 'abcd',
  maxZoom: 19,
}).addTo(map);

// ---- Shared color rule: coverage 0 (red) -> 1 (blue) -----------------------
const COVERAGE_STOPS = [
  [0.00, [229, 62, 62]],   // #e53e3e red    - no coverage
  [0.25, [237, 137, 54]],  // #ed8936 orange
  [0.45, [236, 201, 75]],  // #ecc94b yellow
  [0.70, [56, 178, 172]],  // #38b2ac teal
  [1.00, [43, 108, 176]],  // #2b6cb0 blue   - high coverage
];

function colorForCoverage(v) {
  const t = Math.max(0, Math.min(1, v));
  for (let i = 1; i < COVERAGE_STOPS.length; i++) {
    const [t1, c1] = COVERAGE_STOPS[i];
    if (t <= t1) {
      const [t0, c0] = COVERAGE_STOPS[i - 1];
      const f = (t - t0) / (t1 - t0);
      const rgb = c0.map((ch, k) => Math.round(ch + (c1[k] - ch) * f));
      return `rgb(${rgb[0]},${rgb[1]},${rgb[2]})`;
    }
  }
  return 'rgb(43,108,176)';
}

const pct = (v) => Math.round(v * 100) + '%';
const fmt = (n) => n.toLocaleString('en-US');

// ---- Layers ----------------------------------------------------------------
let stateLayer = null;       // choropleth (kept across levels, restyled)
let cityLayer = L.layerGroup().addTo(map);   // bubbles
let houseLayer = L.layerGroup().addTo(map);  // parcels
let labelLayer = L.layerGroup().addTo(map);  // neighborhood labels

let currentLevel = 'usa';
let selectedAbbr = null;

// ---- Legend / info panel ----------------------------------------------------
function setLegend(title, hint) {
  document.getElementById('legend-title').textContent = title;
  document.getElementById('legend-hint').textContent = hint;
}

function showInfoPanel(html) {
  document.getElementById('info-content').innerHTML = html;
  document.getElementById('info-panel').classList.remove('hidden');
}

function hideInfoPanel() {
  document.getElementById('info-panel').classList.add('hidden');
}

document.getElementById('info-close').addEventListener('click', hideInfoPanel);

// ---- Breadcrumb --------------------------------------------------------------
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
    if (i !== path.length - 1) btn.addEventListener('click', step.go);
    nav.appendChild(btn);
  });
}

// ---- State styling -----------------------------------------------------------
function stateStyle(feature) {
  const abbr = feature.properties.abbr;
  const cov = STATE_COVERAGE[abbr] ?? 0.2;
  if (currentLevel === 'usa') {
    return { fillColor: colorForCoverage(cov), fillOpacity: 0.72, color: '#141923', weight: 1.2 };
  }
  if (abbr === selectedAbbr) {
    // Selected state: near-transparent fill so bubbles/houses pop, bright outline.
    return { fillColor: colorForCoverage(cov), fillOpacity: 0.06, color: '#ff8a3d', weight: 2 };
  }
  // Neighbors: dimmed context.
  return { fillColor: colorForCoverage(cov), fillOpacity: 0.16, color: '#141923', weight: 1 };
}

function buildStateLayer() {
  stateLayer = L.geoJSON(US_STATES_GEOJSON, {
    style: stateStyle,
    onEachFeature: (feature, layer) => {
      const abbr = feature.properties.abbr;
      layer.bindTooltip(
        () => `${feature.properties.name} — ${pct(STATE_COVERAGE[abbr] ?? 0.2)} renewable coverage`,
        { sticky: true, direction: 'top' }
      );
      layer.on({
        mouseover: (e) => {
          if (currentLevel !== 'usa') return;
          e.target.setStyle({ weight: 2.5, color: '#ffffff', fillOpacity: 0.85 });
          e.target.bringToFront();
        },
        mouseout: (e) => {
          if (currentLevel !== 'usa') return;
          stateLayer.resetStyle(e.target);
        },
        click: () => {
          if (currentLevel === 'usa') goState(abbr);
        },
      });
    },
  }).addTo(map);
}

function stateFeatureBounds(abbr) {
  let bounds = null;
  stateLayer.eachLayer((l) => {
    if (l.feature.properties.abbr === abbr) bounds = l.getBounds();
  });
  return bounds;
}

function stateName(abbr) {
  const f = US_STATES_GEOJSON.features.find((f) => f.properties.abbr === abbr);
  return f ? f.properties.name : abbr;
}

// ---- Level 1: USA choropleth ---------------------------------------------------
function goUSA() {
  currentLevel = 'usa';
  selectedAbbr = null;
  hideInfoPanel();
  cityLayer.clearLayers();
  houseLayer.clearLayers();
  labelLayer.clearLayers();
  stateLayer.setStyle(stateStyle);

  map.flyTo([38.8, -96.9], 4, { duration: 0.7 });
  setLegend('Renewable Coverage', 'Share of households on renewable energy, by state. Click a state to drill in.');
  renderBreadcrumb([{ label: 'USA' }]);
}

// ---- Level 2: state -> city bubbles ---------------------------------------------
function bubbleRadius(city) {
  // Hotspot semantics: the LESS covered a city is, the bigger its circle.
  // Mild population weighting so metros read larger than small towns.
  const popFactor = 0.7 + 0.6 * Math.min(1, Math.sqrt(city.pop / 900000));
  return (7 + (1 - city.coverage) * 24) * popFactor;
}

function goState(abbr) {
  currentLevel = 'state';
  selectedAbbr = abbr;
  hideInfoPanel();
  cityLayer.clearLayers();
  houseLayer.clearLayers();
  labelLayer.clearLayers();
  stateLayer.setStyle(stateStyle);

  const cities = (CITY_STATS[abbr] || []).slice().sort((a, b) => b.pop - a.pop);
  cities.forEach((city) => {
    const marker = L.circleMarker([city.lat, city.lng], {
      radius: bubbleRadius(city),
      color: '#ffffff',
      weight: 1.5,
      fillColor: colorForCoverage(city.coverage),
      fillOpacity: 0.78,
    }).addTo(cityLayer);

    marker.bindTooltip(
      `<b>${city.name}</b><br/>${pct(city.coverage)} coverage · ~${fmt(city.uncovered)} homes without renewables`,
      { direction: 'top' }
    );
    marker.on('click', () => goCity(city));
  });

  const bounds = stateFeatureBounds(abbr);
  if (bounds) map.flyToBounds(bounds.pad(0.08), { duration: 0.7 });

  setLegend(
    stateName(abbr) + ' — City Coverage',
    'Bigger, redder circles = more homes without renewables (hotspots worth targeting). Click a city.'
  );
  renderBreadcrumb([{ label: 'USA', go: goUSA }, { label: stateName(abbr) }]);
}

// ---- Level 3: city -> houses -----------------------------------------------------
const HOUSE_HALF = 0.00022; // ~half a parcel, in degrees

function goCity(city) {
  currentLevel = 'city';
  hideInfoPanel();
  cityLayer.clearLayers();
  houseLayer.clearLayers();
  labelLayer.clearLayers();
  stateLayer.setStyle(stateStyle);

  const detail = getCityDetail(city);

  detail.houses.forEach((house) => {
    const rect = L.rectangle(
      [[house.lat - HOUSE_HALF, house.lng - HOUSE_HALF * 1.12],
       [house.lat + HOUSE_HALF, house.lng + HOUSE_HALF * 1.12]],
      {
        color: '#0e1420',
        weight: 1,
        fillColor: colorForCoverage(house.coverage),
        fillOpacity: 0.92,
      }
    ).addTo(houseLayer);

    rect.bindTooltip(`${house.address} — ${pct(house.coverage)} renewable`, { direction: 'top' });
    rect.on('click', () => {
      showInfoPanel(`
        <h4>${house.address}</h4>
        <p class="hood-tag">${house.hood} · ${city.name}</p>
        <div class="stat"><span>Renewable coverage</span><span>${pct(house.coverage)}</span></div>
        <div class="stat"><span>Solar installed</span><span>${house.hasSolar ? 'Yes' : 'No'}</span></div>
        <div class="stat"><span>Roof size</span><span>${fmt(house.roofSqft)} sqft</span></div>
        <div class="stat"><span>Est. savings if converted</span><span>$${fmt(house.estAnnualSavings)}/yr</span></div>
      `);
    });
  });

  // Neighborhood labels give the sales team something to say on the video.
  detail.hoods.forEach((hood) => {
    L.tooltip({
      permanent: true,
      direction: 'center',
      className: 'hood-label',
    }).setLatLng([hood.lat, hood.lng]).setContent(hood.name).addTo(labelLayer);
  });

  const b = L.latLngBounds(detail.houses.map((h) => [h.lat, h.lng]));
  map.flyToBounds(b.pad(0.18), { duration: 0.8 });

  setLegend(
    city.name + ' — Household Coverage',
    'Each square is a home. Blue = running on renewables, red = no coverage yet. Click one for lead details.'
  );
  renderBreadcrumb([
    { label: 'USA', go: goUSA },
    { label: stateName(selectedAbbr), go: () => goState(selectedAbbr) },
    { label: city.name },
  ]);
}

// ---- Boot ------------------------------------------------------------------------
buildStateLayer();
goUSA();
