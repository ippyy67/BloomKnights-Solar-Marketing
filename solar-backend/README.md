# Solar Backend — Orlando Hackathon Project

A small backend server that:
1. Takes a home address
2. Looks up the roof's solar potential using Google's Solar API
3. Calculates install cost, savings, and payback period
4. Also serves a ranked list of Orlando neighborhoods for targeting/marketing

Your teammates' frontend calls this server's endpoints and gets back clean JSON — they never need to touch Google's APIs directly.

---

## 1. One-time setup

### Install tools (if you haven't already)
- [Node.js](https://nodejs.org/) (this gives you `node` and `npm`)
- [VS Code](https://code.visualstudio.com/)
- [Git](https://git-scm.com/)

### Get a Google API key
1. Go to [console.cloud.google.com](https://console.cloud.google.com/)
2. Create a new project
3. Go to "APIs & Services" → "Library" and enable:
   - **Geocoding API**
   - **Solar API**
4. Go to "APIs & Services" → "Credentials" → "Create Credentials" → "API Key"
5. Copy that key

### Set up the project
```bash
# Open this folder in VS Code, then open a terminal inside VS Code
# (Terminal menu → New Terminal) and run:

npm install
cp .env.example .env
```

Now open the new `.env` file and paste your real API key in place of `your_google_api_key_here`.

### Run it
```bash
npm start
```

You should see:
```
✅ Solar backend running at http://localhost:3001
```

Test it by pasting this in your browser (or use Postman/Thunder Client):
```
http://localhost:3001/api/solar?address=400 S Orange Ave, Orlando, FL
```

---

## 2. The API your teammates will use

### `GET /api/solar?address=<any address>`
Returns roof stats + cost/savings estimate for one address.

**Example response:**
```json
{
  "address": "400 S Orange Ave, Orlando, FL 32801, USA",
  "coordinates": { "lat": 28.5421, "lng": -81.3790 },
  "roof": {
    "maxPanelsFit": 42,
    "wholeRoofAreaSqMeters": 210.5,
    "maxSunshineHoursPerYear": 1850
  },
  "system": {
    "recommendedPanelCount": 34,
    "systemSizeKw": 13.6,
    "estimatedYearlyProductionKwh": 17200
  },
  "costs": {
    "estimatedInstallCost": 40800,
    "federalTaxCredit": 12240,
    "netCostAfterTaxCredit": 28560,
    "monthlySavings": 200,
    "annualSavings": 2408,
    "paybackYears": 11.9,
    "twentyYearSavings": 19600
  },
  "utility": {
    "estimatedCurrentAnnualBill": 2676,
    "ratePerKwh": 0.14
  }
}
```

### `GET /api/targets`
Returns a ranked list of Orlando neighborhoods for the "where to target" marketing map.

**Example response:**
```json
[
  {
    "name": "Dr. Phillips",
    "address": "7500 Dr Phillips Blvd, Orlando, FL...",
    "coordinates": { "lat": 28.44, "lng": -81.48 },
    "avgMonthlyBill": 230,
    "estimatedAnnualSavings": 2600,
    "systemSizeKw": 14.1,
    "priorityScore": 3068
  }
]
```
(sorted highest priority first — best neighborhoods to target at the top)

---

## 3. Pushing this to GitHub (step by step, no experience needed)

If you haven't connected this folder to GitHub yet:

1. On [github.com](https://github.com), click **New Repository**, name it (e.g. `solar-hackathon`), leave it empty (no README/gitignore — we already have those), click **Create**.
2. In VS Code's terminal, inside this folder, run:
```bash
git init
git add .
git commit -m "Initial backend setup"
git branch -M main
git remote add origin https://github.com/YOUR-USERNAME/solar-hackathon.git
git push -u origin main
```
3. Send your teammates the GitHub link. They can clone it with:
```bash
git clone https://github.com/YOUR-USERNAME/solar-hackathon.git
```

### Whenever you make changes later:
```bash
git add .
git commit -m "describe what you changed"
git push
```

**Important:** your real `.env` file (with your actual API key) will NOT be pushed to GitHub — the `.gitignore` file blocks it on purpose, so you don't leak your key publicly. Each teammate needs their own `.env` locally (they can copy `.env.example` and use your key, or get their own).

---

## 4. Project structure

```
solar-backend/
├── server.js                     # starts the server, wires everything together
├── routes/
│   └── solar.js                  # the two API endpoints (/api/solar, /api/targets)
├── utils/
│   ├── geocode.js                # address → lat/lng
│   └── solarCalculations.js      # raw Solar API data → cost/savings numbers
├── data/
│   └── orlandoNeighborhoods.js   # sample list for the targeting map
├── .env.example                  # template for your API key (copy to .env)
└── .env                          # your real API key (never committed)
```

## 5. Things to tweak if you have extra time
- `ORLANDO_ELECTRICITY_RATE_PER_KWH` and `COST_PER_WATT_INSTALLED` in `.env` are placeholder estimates — real Duke Energy Florida rates would make this more credible for judges.
- `data/orlandoNeighborhoods.js` — add more real neighborhoods/addresses for a richer targeting map.
- The federal tax credit (30%) is hardcoded in `solarCalculations.js` — verify it's current before your demo.
