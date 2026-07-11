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

function showInfoPanel(html, options) {
  const panel = document.getElementById('info-panel');
  const detailMode = options && options.detailMode;
  panel.classList.toggle('detail-view', detailMode);
  document.getElementById('info-content').innerHTML = html;
  panel.classList.remove('hidden');
}

function showNeighborhoodListings(hood) {
  const listings = NEIGHBORHOOD_LISTINGS[hood.name] || [
    {
      address: '123 ' + hood.name + ' Ave',
      coverage: '27%',
      solarInstalled: 'No',
      roofSqft: '1,760',
      estSavings: '$1,100/yr',
      badge: 'Open home',
      note: 'Solid roof profile and strong conversion potential',
      score: 81,
      utilityBill: '$182/mo',
      shade: 'Low',
    },
  ];

  const cards = listings.map((listing) => `
    <article class="listing-card" data-address="${listing.address}">
      <div class="listing-topline">
        <strong>${listing.address}</strong>
        <span class="listing-badge">${listing.badge}</span>
      </div>
      <div class="listing-metrics">
        <div><span>Solar coverage</span><strong>${listing.coverage}</strong></div>
        <div><span>Solar installed</span><strong>${listing.solarInstalled}</strong></div>
        <div><span>Roof size</span><strong>${listing.roofSqft} sqft</strong></div>
        <div><span>Est. savings</span><strong>${listing.estSavings}</strong></div>
      </div>
      <p>${listing.note}</p>
    </article>
  `).join('');

  showInfoPanel(`
    <h4>${hood.name} — Home listings</h4>
    <p class="hood-tag">${pct(hood.coverage)} renewable coverage · ~${fmt(hood.uncovered)} homes without renewables</p>
    <div class="listing-grid">${cards}</div>
  `, { detailMode: false });

  document.querySelectorAll('.listing-card').forEach((card) => {
    card.onclick = () => {
      const address = card.getAttribute('data-address');
      const listing = listings.find((item) => item.address === address);
      if (!listing) return;
      showInfoPanel(`
        <button class="detail-back" id="listing-back">← Back to listings</button>
        <div class="listing-detail-card">
          <div class="listing-topline">
            <strong>${listing.address}</strong>
            <span class="listing-badge">${listing.badge}</span>
          </div>
          <div class="listing-detail-hero">
            <div>
              <div class="detail-label">Match score</div>
              <div class="detail-value">${listing.score}/100</div>
            </div>
            <div>
              <div class="detail-label">Utility bill</div>
              <div class="detail-value">${listing.utilityBill}</div>
            </div>
          </div>
          <div class="listing-metrics detail-metrics">
            <div><span>Solar coverage</span><strong>${listing.coverage}</strong></div>
            <div><span>Solar installed</span><strong>${listing.solarInstalled}</strong></div>
            <div><span>Roof size</span><strong>${listing.roofSqft} sqft</strong></div>
            <div><span>Est. savings</span><strong>${listing.estSavings}</strong></div>
          </div>
          <div class="detail-section">
            <div class="detail-label">Shade</div>
            <div class="detail-value">${listing.shade}</div>
          </div>
          <div class="detail-section">
            <div class="detail-label">Why it matters</div>
            <p>${listing.note}</p>
          </div>
        </div>
      `, { detailMode: true });
      const backButton = document.getElementById('listing-back');
      if (backButton) {
        backButton.onclick = () => showNeighborhoodListings(hood);
      }
    };
  });
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
//   hood -> none (only the house dots are interactive)
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
      }
      // hood level: no polygon tooltip — only the house dots are interactive,
      // so hovering the gaps between homes stays clean.
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
          '<b>' + h.name + '</b><br/>' + pct(h.coverage) + ' coverage · ~' + fmt(h.uncovered) + ' homes without renewables' + (clickable ? '<br/>— click to view listings —' : ''),
          clickable,
          () => showNeighborhoodListings(h)
        );
      });
  };

  const b = L.latLngBounds(ORLANDO_HOODS.map((h) => [h.lat, h.lng]));
  transition({
    fly: fly ? () => map.flyToBounds(b.pad(0.22), { duration: 0.7 }) : null,
    populate,
  });

  setLegend(city.name + ' — Neighborhood Coverage', 'Hover a bubble for neighborhood stats — click Pine Hills to open nearby home listings.');
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
  // Small dot centered on the house so the underlying building stays visible.
  const dot = L.circleMarker([house.lat, house.lng], {
    radius: emphasized ? 5 : 4,
    color: emphasized ? '#ffffff' : '#0e1420',
    weight: emphasized ? 1.5 : 1,
    fillColor: colorForCoverage(house.coverage),
    fillOpacity: 0.95,
  }).addTo(houseLayer);
  dot.bindTooltip(house.address + ' — ' + pct(house.coverage) + ' renewable', { direction: 'top' });
  dot.on('click', () => showInfoPanel(houseInfoHtml(house, hoodName)));
}

// Real-OSM renderer: every building in the viewport is a colored, hoverable,
// clickable home. Every dot is styled the same for a clean, uniform look.
function renderRealHood(hood, data) {
  tiles.setOpacity(1); // real streets ARE the map now
  data.houses.forEach((house) => {
    addHouseRect(house, hood.name, REAL_HALF_LAT, REAL_HALF_LNG, false);
  });
  setLegend(
    hood.name + ' — Lead Map',
    'Every building is real (OpenStreetMap). Blue = on renewables, red = no coverage. Click any home.'
  );
}

// Fallback renderer: our own drawn plat (only if the OSM fetch failed)
function renderPlatHood(hood) {
  tiles.setOpacity(0.25);
  const plat = getHeroPlat();
  // The modeled plat has its own extent; frame the camera to it so the grid
  // fills the viewport instead of floating inside the (wider) fetch bbox.
  map.fitBounds(L.latLngBounds(plat.bounds).pad(0.04), { animate: true, duration: 0.5 });
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
    'Each dot is a home: blue = on renewables, red = no coverage (lead). Click a home for details. (Offline mode: modeled parcels)'
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
