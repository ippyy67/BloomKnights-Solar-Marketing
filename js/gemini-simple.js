/*
 * gemini-simple.js -- Gemini-generated finance & environmental analysis for a
 * listing detail card. (Kaushal's backend integration, adapted to the
 * Zillow-style card in app.js.)
 *
 * The API key is asked for once (browser prompt) and kept in localStorage
 * under GEMINI_API_KEY. Results are cached per address so the demo can
 * reopen a card instantly and never re-bill the API.
 */

const NATIONAL_AVG_KWH = 903;      // avg US household kWh / month
const FLORIDA_RATE = 0.1538;       // $ / kWh

function hasGeminiKey() {
  try { return !!localStorage.getItem('GEMINI_API_KEY'); } catch (e) { return false; }
}

function getApiKey() {
  let apiKey = null;
  try { apiKey = localStorage.getItem('GEMINI_API_KEY'); } catch (e) {}
  if (!apiKey) {
    apiKey = prompt('Enter your Google Gemini API key (free at https://aistudio.google.com/app/apikey):');
    if (apiKey) try { localStorage.setItem('GEMINI_API_KEY', apiKey.trim()); } catch (e) {}
  }
  return apiKey;
}

async function callGeminiApi(apiKey, promptText, jsonSchema) {
  const url = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=' + apiKey;
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: promptText }] }],
      generationConfig: { responseMimeType: 'application/json', responseSchema: jsonSchema },
    }),
  });
  const data = await response.json();
  if (!response.ok) throw new Error((data.error && data.error.message) || 'API error');
  return JSON.parse(data.candidates[0].content.parts[0].text);
}

function aiCacheKey(listing) { return 'sunview-ai-' + listing.address; }

function getCachedAnalysis(listing) {
  try { return localStorage.getItem(aiCacheKey(listing)); } catch (e) { return null; }
}

async function generateListingAnalysis(listing) {
  const slot = document.getElementById('ai-summary');
  if (!slot) return;
  const apiKey = getApiKey();
  if (!apiKey) return;

  slot.innerHTML = '<p class="ai-note">&#10024; Generating financial &amp; environmental analysis&hellip;</p>';

  const rawBill = parseFloat(String(listing.utilityBill || '').replace(/[^0-9.]/g, '')) || 150;
  const calculatedKwh = rawBill / FLORIDA_RATE;
  const percentVsAvg = Math.round(((calculatedKwh - NATIONAL_AVG_KWH) / NATIONAL_AVG_KWH) * 100);

  const propertyContext =
    'Property: ' + listing.address + ', Orlando, Florida\n' +
    'Monthly bill: ' + listing.utilityBill + ' (~' + calculatedKwh.toFixed(0) + ' kWh/mo, ' +
    percentVsAvg + '% ' + (percentVsAvg > 0 ? 'above' : 'below') + ' national average)\n' +
    'Roof: ' + listing.roofSqft + ' sqft, ' + (listing.roofType || 'asphalt shingle') +
    ', age ' + (listing.roofAge || 'unknown') + ', ' + (listing.orientation || '') + '\n' +
    'Peak sun: ' + (listing.sunHours || '~5.5 hrs/day') + ', shade: ' + listing.shade + '\n' +
    'Suggested system: ' + (listing.systemSize || 'unknown') +
    ', install estimate: ' + (listing.installEstimate || 'unknown') + '\n' +
    'Current solar coverage: ' + listing.coverage + ', est. savings: ' + listing.estSavings +
    ', lead score: ' + listing.score + '/100';

  const financeTask = {
    prompt: 'Act as a Solar Financial Analyst. Based on:\n' + propertyContext +
      '\nCalculate realistic values for a residential solar installation in Orlando, Florida, ' +
      'after the 30% federal ITC. For financing, describe a typical solar loan (rate and term), ' +
      'the monthly loan payment, and how long the loan takes to pay off compared against the ' +
      'utility savings. Keep every value short (a few words). Provide a strategic 2-sentence sales hook.',
    schema: {
      type: 'OBJECT',
      properties: {
        estimatedSystemCost: { type: 'STRING' },
        annualSavings: { type: 'STRING' },
        paybackPeriod: { type: 'STRING' },
        roi: { type: 'STRING' },
        financingOptions: { type: 'STRING' },
        monthlyLoanPayment: { type: 'STRING' },
        loanPayoffTime: { type: 'STRING' },
        salesHook: { type: 'STRING' },
      },
      required: ['estimatedSystemCost', 'annualSavings', 'paybackPeriod', 'roi',
        'financingOptions', 'monthlyLoanPayment', 'loanPayoffTime', 'salesHook'],
    },
  };

  const impactTask = {
    prompt: 'Act as an Environmental Impact Engineer. Based on:\n' + propertyContext +
      '\nCalculate measurable eco-impact offsets for shifting this home to clean energy ' +
      '(annual CO2 avoided, equivalent trees planted, water saved by displacing grid generation, ' +
      'and share of the home\'s usage covered). Keep every value short. ' +
      'Provide a compelling 2-sentence door opener.',
    schema: {
      type: 'OBJECT',
      properties: {
        co2Reduction: { type: 'STRING' },
        treesSaved: { type: 'STRING' },
        waterSaved: { type: 'STRING' },
        gridIndependence: { type: 'STRING' },
        doorOpener: { type: 'STRING' },
      },
      required: ['co2Reduction', 'treesSaved', 'waterSaved', 'gridIndependence', 'doorOpener'],
    },
  };

  try {
    const results = await Promise.all([
      callGeminiApi(apiKey, financeTask.prompt, financeTask.schema),
      callGeminiApi(apiKey, impactTask.prompt, impactTask.schema),
    ]);
    const finance = results[0], impact = results[1];

    const html =
      '<div class="ai-card ai-finance">' +
        '<h4>&#128176; Financial analysis</h4>' +
        '<div class="row"><span>System cost</span><strong>' + finance.estimatedSystemCost + '</strong></div>' +
        '<div class="row"><span>Annual savings</span><strong class="val-green">' + finance.annualSavings + '</strong></div>' +
        '<div class="row"><span>Payback period</span><strong class="val-orange">' + finance.paybackPeriod + '</strong></div>' +
        '<div class="row"><span>ROI</span><strong class="val-blue">' + finance.roi + '</strong></div>' +
        '<div class="row"><span>Financing</span><strong>' + finance.financingOptions + '</strong></div>' +
        '<div class="row"><span>Monthly loan payment</span><strong>' + finance.monthlyLoanPayment + '</strong></div>' +
        '<div class="row"><span>Loan paid off in</span><strong class="val-orange">' + finance.loanPayoffTime + '</strong></div>' +
        '<div class="ai-hook">' + finance.salesHook + '</div>' +
      '</div>' +
      '<div class="ai-card ai-impact">' +
        '<h4>&#127793; Environmental impact</h4>' +
        '<div class="row"><span>CO&#8322; avoided / yr</span><strong>' + impact.co2Reduction + '</strong></div>' +
        '<div class="row"><span>Trees equivalent</span><strong class="val-green">' + impact.treesSaved + '</strong></div>' +
        '<div class="row"><span>Water saved / yr</span><strong class="val-blue">' + impact.waterSaved + '</strong></div>' +
        '<div class="row"><span>Grid independence</span><strong class="val-purple">' + impact.gridIndependence + '</strong></div>' +
        '<div class="ai-hook">&ldquo;' + impact.doorOpener + '&rdquo;</div>' +
      '</div>';

    slot.innerHTML = html;
    try { localStorage.setItem(aiCacheKey(listing), html); } catch (e) {}
  } catch (err) {
    const msg = (err && err.message) || 'Unknown error';
    if (msg.indexOf('API key not valid') !== -1) {
      try { localStorage.removeItem('GEMINI_API_KEY'); } catch (e) {}
    }
    slot.innerHTML = '<p class="ai-error">Analysis failed: ' + msg + '</p>' +
      '<button class="cta ai-retry" type="button">Retry</button>';
    const retry = slot.querySelector('.ai-retry');
    if (retry) retry.onclick = () => generateListingAnalysis(listing);
  }
}
