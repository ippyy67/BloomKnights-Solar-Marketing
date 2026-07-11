/*
 * app.js -- drill-down map, one visualization per level:
 *
 *   1 USA    -> state choropleth (electoral-map style)
 *   2 State  -> city bubbles (hotspot: bigger+redder = more uncovered homes)
 *   3 City   -> neighborhood bubbles (Orlando districts)
 *   4 Hood   -> REAL buildings (OpenStreetMap) colored by coverage, with one
 *               functional "canvass route" street. Synthetic plat only if the
 *               OSM fetch fails (demo never breaks).
 *
 * DEMO PATH: only Florida -> Orlando -> Pine Hills are clickable; everything
 * else is hover-metrics only. Zooming OUT manually walks back up the levels.
 */

precomputeAllData();

const DEMO_PATH = { state: 'FL', city: 'Orlando', hood: HERO_HOOD_NAME };

const map = L.map('map', {
  worldCopyJump: true,
  zoomControl: true,
  zoomSnap: 0.5,
  preferCanvas: true,
}).setView([38.8, -96.9], 4);

const tiles = L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
  attribution: '&copy; OpenStreetMap contributors &copy; CARTO',
  subdomains: 'abcd',
  maxZoom: 19,
}).addTo(map);

// ---- Shared color rule: coverage 0 (red) -> 1 (blue) ------------------------
const COVERAGE_STOPS = [
  [0.00, [229, 62, 62]],
  [0.25, [237, 137, 54]],
  [0.45, [236, 201, 75]],
  [0.70, [56, 178, 172]],
  [1.00, [43, 108, 176]],
];

function colorForCoverage(v) {
  const t = Math.max(0, Math.min(1, v));
  for (let i = 1; i < COVERAGE_STOPS.length; i++) {
    const t1 = COVERAGE_STOPS[i][0], c1 = COVERAGE_STOPS[i][1];
    if (t <= t1) {
      const t0 = COVERAGE_STOPS[i - 1][0], c0 = COVERAGE_STOPS[i - 1][1];
      const f = (t - t0) / (t1 - t0);
      const rgb = c0.map((ch, k) => Math.round(ch + (c1[k] - ch) * f));
      return 'rgb(' + rgb[0] + ',' + rgb[1] + ',' + rgb[2] + ')';
    }
  }
  return 'rgb(43,108,176)';
}

const pct = (v) => Math.round(v * 100) + '%';
const fmt = (n) => n.toLocaleString('en-US');

// ---- Layers / view state ----------------------------------------------------
let stateLayer = null;
const cityLayer = L.layerGroup().addTo(map);
const hoodLayer = L.layerGroup().addTo(map);
const houseLayer = L.layerGroup().addTo(map);
const streetLayer = L.layerGroup().addTo(map);
const labelLayer = L.layerGroup().addTo(map);

let currentLevel = 'usa';   // 'usa' | 'state' | 'city' | 'hood'
let selectedAbbr = null;
let viewSeq = 0;            // invalidates pending post-flight + async callbacks
let flying = false;         // suppress zoom-demotion during programmatic flights

const ORLANDO = CITY_STATS.FL.find((c) => c.name === DEMO_PATH.city);
const HERO_HOOD = ORLANDO_HOODS.find((h) => h.name === DEMO_PATH.hood);

// ---- UI helpers ---------------------------------------------------------------
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

// ---- State choropleth ------------------------------------------------------------
function stateStyle(feature) {
  const abbr = feature.properties.abbr;
  const cov = STATE_COVERAGE[abbr] !== undefined ? STATE_COVERAGE[abbr] : 0.2;
  if (currentLevel === 'usa') {
    return { fillColor: colorForCoverage(cov), fillOpacity: 0.72, color: '#141923', weight: 1.2 };
  }
  if (abbr === selectedAbbr) {
    return { fillColor: colorForCoverage(cov), fillOpacity: 0.05, color: '#ff8a3d', weight: 2 };
  }
  return { fillColor: colorForCoverage(cov), fillOpacity: 0.16, color: '#141923', weight: 1 };
}

// Tooltips on state polygons per level:
//   usa  -> each state's own coverage
//   state-> none (bubbles carry the info)
//   city -> hovering between bubbles shows Orlando's coverage
//   hood -> hovering between houses shows Pine Hills' coverage
function setStateTooltips() {
  stateLayer.eachLayer((l) => {
    l.unbindTooltip();
    const abbr = l.feature.properties.abbr;
    if (currentLevel === 'usa') {
      const cov = STATE_COVERAGE[abbr] !== undefined ? STATE_COVERAGE[abbr] : 0.2;
      const suffix = abbr === DEMO_PATH.state ? ' — click to drill in' : '';
      l.bindTooltip(l.feature.properties.name + ' — ' + pct(cov) + ' renewable coverage' + suffix, { sticky: true, direction: 'top' });
    } else if (abbr === selectedAbbr) {
      if (currentLevel === 'city') {
        l.bindTooltip(ORLANDO.name + ' — ' + pct(ORLANDO.coverage) + ' renewable coverage', { sticky: true, direction: 'top' });
      } else if (currentLevel === 'hood') {
        l.bindTooltip(HERO_HOOD.name + ' — ' + pct(HERO_HOOD.coverage) + ' neighborhood coverage', { sticky: true, direction: 'top' });
      }
    }
  });
}

function buildStateLayer() {
  stateLayer = L.geoJSON(US_STATES_GEOJSON, {
    style: stateStyle,
    onEachFeature: (feature, layer) => {
      const abbr = feature.properties.abbr;
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
          if (currentLevel === 'usa' && abbr === DEMO_PATH.state) goState(abbr);
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

// ---- Transition helper -------------------------------------------------------------
function transition(opts) {
  viewSeq++;
  const seq = viewSeq;
  hideInfoPanel();
  cityLayer.clearLayers();
  hoodLayer.clearLayers();
  houseLayer.clearLayers();
  streetLayer.clearLayers();
  labelLayer.clearLayers();
  stateLayer.setStyle(stateStyle);
  setStateTooltips();
  tiles.setOpacity(currentLevel === 'hood' ? 0.6 : 1);

  if (opts.fly) {
    flying = true;
    map.once('moveend', () => {
      flying = false;
      if (seq === viewSeq && opts.populate) opts.populate();
    });
    opts.fly();
  } else if (opts.populate) {
    opts.populate();
  }
}

// ---- Level 1: USA --------------------------------------------------------------------
function goUSA(opts) {
  const fly = !opts || opts.fly !== false;
  currentLevel = 'usa';
  selectedAbbr = null;

  transition({
    fly: fly ? () => map.flyTo([38.8, -96.9], 4, { duration: 0.7 }) : null,
  });

  setLegend('Renewable Coverage', 'Share of households on renewable energy, by state. Hover any state — click Florida to drill in.');
  renderBreadcrumb([{ label: 'USA' }]);
}

// ---- Bubble helpers ---------------------------------------------------------------------
function addBubble(layerGroup, latlng, radius, coverage, tooltipHtml, clickable, onClick) {
  const marker = L.circleMarker(latlng, {
    radius: radius,
    color: '#ffffff',
    weight: 1.5,
    fillColor: colorForCoverage(coverage),
    fillOpacity: 0.8,
  }).addTo(layerGroup);
  marker.bindTooltip(tooltipHtml, { direction: 'top' });
  if (clickable) {
    L.circleMarker(latlng, {
      radius: radius + 6,
      color: '#ff8a3d',
      weight: 2,
      dashArray: '5 5',
      fill: false,
      interactive: false,
    }).addTo(layerGroup);
    marker.on('click', onClick);
  }
  return marker;
}

function bubbleRadius(cov, magnitude, magScale) {
  return (7 + (1 - cov) * 24) * (0.7 + 0.5 * Math.min(1, Math.sqrt(magnitude / magScale)));
}

// ---- Level 2: state -> city bubbles --------------------------------------------------------
function goState(abbr, opts) {
  const fly = !opts || opts.fly !== false;
  currentLevel = 'state';
  selectedAbbr = abbr;

  const populate = () => {
    const cities = (CITY_STATS[abbr] || []).slice();
    cities.map((city) => ({ city, r: bubbleRadius(city.coverage, city.pop, 900000) }))
      .sort((a, b) => b.r - a.r)
      .forEach(({ city, r }) => {
        const clickable = abbr === DEMO_PATH.state && city.name === DEMO_PATH.city;
        addBubble(
          cityLayer,
          [city.lat, city.lng],
          r,
          city.coverage,
          '<b>' + city.name + '</b><br/>' + pct(city.coverage) + ' coverage · ~' + fmt(city.uncovered) + ' homes without renewables' + (clickable ? '<br/>— click to drill in —' : ''),
          clickable,
          () => goCity(city)
        );
      });
  };

  const bounds = stateFeatureBounds(abbr);
  transition({
    fly: fly && bounds ? () => map.flyToBounds(bounds.pad(0.08), { duration: 0.7 }) : null,
    populate,
  });

  setLegend(stateName(abbr) + ' — City Coverage', 'Bigger, redder circles = more homes without renewables. Hover any city — click Orlando to drill in.');
  renderBreadcrumb([{ label: 'USA', go: () => goUSA() }, { label: stateName(abbr) }]);
}

// ---- Level 3: city -> neighborhood bubbles ---------------------------------------------------
function goCity(city, opts) {
  const fly = !opts || opts.fly !== false;
  currentLevel = 'city';

  const populate = () => {
    ORLANDO_HOODS.map((h) => ({ h, r: bubbleRadius(h.coverage, h.households, 20000) }))
      .sort((a, b) => b.r - a.r)
      .forEach(({ h, r }) => {
        const clickable = h.name === DEMO_PATH.hood;
        addBubble(
          hoodLayer,
          [h.lat, h.lng],
          r,
          h.coverage,
          '<b>' + h.name + '</b><br/>' + pct(h.coverage) + ' coverage · ~' + fmt(h.uncovered) + ' homes without renewables' + (clickable ? '<br/>— click to open the lead map —' : ''),
          clickable,
          () => goHood(h)
        );
      });
  };

  const b = L.latLngBounds(ORLANDO_HOODS.map((h) => [h.lat, h.lng]));
  transition({
    fly: fly ? () => map.flyToBounds(b.pad(0.22), { duration: 0.7 }) : null,
    populate,
  });

  setLegend(city.name + ' — Neighborhood Coverage', 'Hover a bubble for neighborhood stats — click Pine Hills to open the house-level lead map.');
  renderBreadcrumb([
    { label: 'USA', go: () => goUSA() },
    { label: stateName(selectedAbbr), go: () => goState(selectedAbbr) },
    { label: city.name },
  ]);
}

// ---- Level 4: hood -> real buildings ------------------------------------------------------------
const REAL_HALF_LAT = 0.000085, REAL_HALF_LNG = 0.000095; // ~house-sized squares

function houseInfoHtml(house, hoodName) {
  const grade = house.coverage < 0.25 ? 'Hot' : house.coverage < 0.5 ? 'Warm' : 'Covered';
  return '<h4>' + house.address + '</h4>' +
    '<p class="hood-tag">' + hoodName + ' · ' + ORLANDO.name + '</p>' +
    '<div class="stat"><span>Lead quality</span><span>' + grade + '</span></div>' +
    '<div class="stat"><span>Renewable coverage</span><span>' + pct(house.coverage) + '</span></div>' +
    '<div class="stat"><span>Solar installed</span><span>' + (house.hasSolar ? 'Yes' : 'No') + '</span></div>' +
    '<div class="stat"><span>Roof size</span><span>' + fmt(house.roofSqft) + ' sqft</span></div>' +
    '<div class="stat"><span>Est. savings if converted</span><span>$' + fmt(house.estAnnualSavings) + '/yr</span></div>';
}

function addHouseRect(house, hoodName, halfLat, halfLng, emphasized) {
  const rect = L.rectangle(
    [[house.lat - halfLat, house.lng - halfLng], [house.lat + halfLat, house.lng + halfLng]],
    {
      color: emphasized ? '#ffffff' : '#0e1420',
      weight: emphasized ? 1.5 : 1,
      fillColor: colorForCoverage(house.coverage),
      fillOpacity: 0.95,
    }
  ).addTo(houseLayer);
  rect.bindTooltip(house.address + ' — ' + pct(house.coverage) + ' renewable', { direction: 'top' });
  rect.on('click', () => showInfoPanel(houseInfoHtml(house, hoodName)));
}

// Real-OSM renderer: every building in the viewport is a colored, hoverable,
// clickable home; the hero street gets an orange dashed "canvass route" line
// and white-outlined houses.
function renderRealHood(hood, data) {
  tiles.setOpacity(1); // real streets ARE the map now
  data.heroPaths.forEach((path) => {
    L.polyline(path, {
      color: '#ff8a3d',
      weight: 4,
      opacity: 0.85,
      dashArray: '8 8',
      lineCap: 'round',
    }).addTo(streetLayer).bindTooltip('Canvass route — ' + data.heroName, { sticky: true });
  });
  data.houses.forEach((house) => {
    addHouseRect(house, hood.name, REAL_HALF_LAT, REAL_HALF_LNG, data.heroName && house.street === data.heroName);
  });
  setLegend(
    hood.name + ' — Lead Map',
    'Every building is real (OpenStreetMap). Blue = on renewables, red = no coverage. Orange dashes = today’s canvass route' + (data.heroName ? ' (' + data.heroName + ')' : '') + '. Click any home.'
  );
}

// Fallback renderer: our own drawn plat (only if the OSM fetch failed)
function renderPlatHood(hood) {
  tiles.setOpacity(0.25);
  const plat = getHeroPlat();
  plat.streets.forEach((st) => {
    L.polyline(st.path, {
      color: '#3d4761',
      weight: st.cross ? 3 : 5,
      opacity: 0.95,
      lineCap: 'round',
      interactive: false,
    }).addTo(streetLayer);
    L.tooltip({ permanent: true, direction: st.cross ? 'bottom' : 'right', className: 'street-label' })
      .setLatLng(st.cross ? st.path[1] : st.path[0])
      .setContent(st.name)
      .addTo(labelLayer);
  });
  plat.houses.forEach((house) => {
    addHouseRect(house, hood.name, house.halfLat, house.halfLng, false);
  });
  setLegend(
    hood.name + ' — Lead Map',
    'Each square is a home: blue = on renewables, red = no coverage (lead). Click a home for details. (Offline mode: modeled parcels)'
  );
}

function goHood(hood, opts) {
  const fly = !opts || opts.fly !== false;
  currentLevel = 'hood';

  const b = REAL_HOOD_BBOX;
  const targetBounds = L.latLngBounds([[b.s, b.w], [b.n, b.e]]);

  const populate = () => {
    const mySeq = viewSeq;
    fetchRealHood()
      .then((raw) => {
        if (mySeq !== viewSeq || currentLevel !== 'hood') return;
        renderRealHood(hood, buildRealHood(raw));
      })
      .catch(() => {
        if (mySeq !== viewSeq || currentLevel !== 'hood') return;
        renderPlatHood(hood);
      });
  };

  transition({
    fly: fly ? () => map.flyToBounds(targetBounds.pad(0.05), { duration: 0.8 }) : null,
    populate,
  });

  setLegend(hood.name + ' — Lead Map', 'Loading real parcel data…');
  renderBreadcrumb([
    { label: 'USA', go: () => goUSA() },
    { label: stateName(selectedAbbr), go: () => goState(selectedAbbr) },
    { label: ORLANDO.name, go: () => goCity(ORLANDO) },
    { label: hood.name },
  ]);
}

// ---- Manual zoom-out walks back up the levels ----------------------------------------------------
map.on('zoomend', () => {
  if (flying) return;
  const z = map.getZoom();
  if (currentLevel === 'hood' && z < 13) {
    goCity(ORLANDO, { fly: false });
  } else if (currentLevel === 'city' && z < 9.5) {
    goState(DEMO_PATH.state, { fly: false });
  } else if (currentLevel === 'state' && z < 5.75) {
    goUSA({ fly: false });
  }
});

// ---- Boot -----------------------------------------------------------------------------------------
buildStateLayer();
goUSA({ fly: false });
