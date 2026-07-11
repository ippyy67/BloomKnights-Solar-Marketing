# SunView Florida — Presentation Notes

## Tech stack

**Mapping & visualization**
- **Leaflet 1.9.4** — interactive map engine, canvas rendering for performance
- **CARTO dark basemap** (OpenStreetMap tile data) — the dark theme
- **OpenStreetMap Overpass API** — real building footprints for the Pine Hills
  neighborhood, fetched live in the browser and cached in localStorage
- **us-atlas** (US Census TopoJSON) — real state boundary polygons
- **all-the-cities** — real coordinates/populations for Florida cities
  (both baked into `js/geo-data.js` by our Node pipeline `tools/gen-geodata.js`)

**AI**
- **Google Gemini API** (`gemini-3-flash`, free tier) — per-home financial and
  environmental analysis, generated live on the detail card
- **Structured JSON output** — we constrain Gemini with a `responseSchema`, so
  the model returns typed fields (system cost, payback, loan terms, CO₂ offset…)
  instead of free text. The UI renders data, never raw prose.
- **Model fallback chain** — if a model is deprecated or rate-limited, the app
  automatically falls through to the next one (this saved us: 2.0-flash was
  shut down June 1, 2026)

**Engineering**
- **Vanilla HTML/CSS/JS** — zero frameworks, zero build step; the whole app is
  static files that run anywhere
- **Resilience by design** — offline fallback neighborhood if the OSM fetch
  fails, photo fallback chain, cached AI results (localStorage) so repeat views
  are instant and rate limits can't break a live demo
- **Git team workflow** — feature branch per member (map drill-down, listing
  cards, Gemini backend), merged for the demo

## Points worth making to judges

1. **The user is the solar contractor, not the homeowner.** Everything is
   framed as lead generation: coverage gaps, lead scores, canvass routes,
   door-opener scripts.
2. **Progressive drill-down tells a story** — USA choropleth → Florida cities →
   Orlando neighborhoods → individual real homes, one visualization per level,
   with a consistent color rule (red = no coverage → blue = full coverage).
3. **The houses are real.** At the street level, every dot is an actual
   building footprint pulled live from OpenStreetMap — not decoration.
4. **AI with guardrails.** Structured output means the model can't hallucinate
   the UI; caching means the demo never re-bills or stalls; the fallback chain
   means a model deprecation can't kill it.
5. **It degrades gracefully.** No network? The neighborhood falls back to a
   modeled plat. Model gone? Next in the chain. Photo 404? Placeholder.

## How to talk about the data (the honest, strong version)

Don't say "hardcoded." Say **modeled demo data over real geography, with a
drop-in production data path.** Concretely:

> "All the geography is real — state boundaries from the US Census, real city
> locations, and live building footprints from OpenStreetMap. The coverage
> percentages and listing details are a **modeled demo dataset**: values seeded
> to realistic distributions and calibrated to public benchmarks — we use the
> real Florida average electricity rate ($0.154/kWh) and the real national
> household average (903 kWh/month) to derive usage from a bill. In production,
> each modeled layer has a direct replacement: **Google Solar API / Project
> Sunroof** for roof and irradiance data, **EIA** open data for rates and
> consumption, **NREL PVWatts** for production estimates, and county property
> appraiser parcel records for roof size and age. We deliberately spent our
> hackathon hours on the pipeline and UX, because the data plumbing is
> swappable — the architecture already treats data as a layer."

Shorter version if asked point-blank "is this data real?":

> "The map and buildings are real; the solar metrics are modeled for the demo.
> The pipeline doesn't care — every number on screen flows through the same
> path a production feed would use, and we can name the exact API each one
> would come from."

## Production data sources (name-drop list)

| On-screen number        | Demo source            | Production source                          |
| ----------------------- | ---------------------- | ------------------------------------------ |
| State/city coverage %   | Modeled                | EIA Form 861, NREL Solar Installation data |
| Building footprints     | **Real (OSM, live)**   | Same, or Microsoft Building Footprints     |
| Roof size / age / type  | Modeled                | County property appraiser (Orange County)  |
| Sun hours / shade       | Modeled                | Google Solar API, LIDAR analysis           |
| Utility bill / usage    | Derived from real rates| Utility APIs / customer-provided bills     |
| System size / cost / payback | Gemini (live)     | NREL PVWatts + installer pricing data      |
| CO₂ / environmental offsets  | Gemini (live)     | EPA AVERT emission factors                 |
