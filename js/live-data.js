/*
 * live-data.js -- REAL solar data for the demo homes, fetched in the browser
 * from NREL's free public APIs:
 *
 *   - Solar Resource API v1: long-term average irradiance at this lat/lng
 *     (kWh/m^2/day == peak sun hours)
 *   - PVWatts v8: estimated annual production for the suggested system at
 *     this exact location -- the same model the solar industry quotes from
 *
 * Values update the hero listings in place at boot; the modeled numbers stay
 * as fallbacks so the demo can never break offline. Uses DEMO_KEY unless a
 * real (free) key is set in js/secrets.js as window.NREL_API_KEY.
 */

const NREL_KEY_SRC = () => window.NREL_API_KEY || 'DEMO_KEY';

async function fetchNrelJson(url) {
  const r = await fetch(url);
  const j = await r.json();
  if (!r.ok || (j.errors && j.errors.length)) {
    throw new Error((j.errors && j.errors[0]) || 'NREL error');
  }
  return j;
}

async function enrichListingWithLiveData(listing, updateFinancials) {
  const lat = ((REAL_HOOD_BBOX.s + REAL_HOOD_BBOX.n) / 2).toFixed(4);
  const lng = ((REAL_HOOD_BBOX.w + REAL_HOOD_BBOX.e) / 2).toFixed(4);
  const sysKw = parseFloat(listing.systemSize) || 7.2;
  const key = NREL_KEY_SRC();

  const solarUrl = 'https://developer.nrel.gov/api/solar/solar_resource/v1.json' +
    '?api_key=' + key + '&lat=' + lat + '&lon=' + lng;
  const pvUrl = 'https://developer.nrel.gov/api/pvwatts/v8.json' +
    '?api_key=' + key + '&lat=' + lat + '&lon=' + lng +
    '&system_capacity=' + sysKw +
    '&azimuth=180&tilt=20&array_type=1&module_type=0&losses=14';

  const results = await Promise.allSettled([fetchNrelJson(solarUrl), fetchNrelJson(pvUrl)]);
  const solar = results[0], pv = results[1];

  if (solar.status === 'fulfilled') {
    const ghi = solar.value.outputs && solar.value.outputs.avg_ghi && solar.value.outputs.avg_ghi.annual;
    if (ghi) {
      listing.sunHours = Number(ghi).toFixed(1) + ' hrs/day';
      listing.liveData = true;
    }
  }

  if (pv.status === 'fulfilled') {
    const acAnnual = pv.value.outputs && pv.value.outputs.ac_annual;
    if (acAnnual) {
      listing.annualProduction = Math.round(acAnnual).toLocaleString('en-US') + ' kWh/yr';
      listing.liveData = true;
      if (updateFinancials) {
        const savings = Math.round(acAnnual * FLORIDA_RATE);
        listing.estSavings = '$' + savings.toLocaleString('en-US') + '/yr';
        const cost = parseFloat(String(listing.installEstimate || '').replace(/[^0-9.]/g, ''));
        if (cost && savings > 0) listing.paybackYears = (cost / savings).toFixed(1) + ' yrs';
      }
    }
  }
}

// Warm live data for the two demo homes at boot. Financials only update on
// the lead home; the covered home keeps its "already installed" story but
// still gets real sun hours and real production for its existing system.
function warmLiveData() {
  const listings = NEIGHBORHOOD_LISTINGS[HERO_HOOD_NAME] || [];
  [HERO_LEAD_ADDRESS, HERO_COVERED_ADDRESS].forEach((addr) => {
    const listing = listings.find((l) => l.address === addr);
    if (listing) {
      enrichListingWithLiveData(listing, listing.solarInstalled !== 'Yes').catch(() => {});
    }
  });
}
