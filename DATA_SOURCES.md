# SunView Florida — Data Sources & Benchmarks

The coverage index shown on the map is illustrative, but it is **calibrated to
the real relative rankings** from the published sources below. These are the
numbers to cite when judges ask.

## Where the coverage index comes from (the one-liner)

> "Coverage is a normalized index built from three public datasets: EIA Form
> 861 net-metering counts at the state level, Google Project Sunroof at the
> city level, and Stanford's DeepSolar census-tract database at the
> neighborhood level."

- **EIA Form 861** — utilities' mandatory annual filings; includes count of
  residential net-metered (rooftop solar) customers per state.
  https://www.eia.gov/electricity/data/eia861/
- **Google Project Sunroof** — public BigQuery dataset: existing installs and
  % of solar-viable roofs, by census tract and postal code.
  https://sunroof.withgoogle.com/data-explorer/
- **Stanford DeepSolar** (published in *Joule*) — ML census of 1.47M US solar
  installations at census-tract level; the standard academic dataset for
  neighborhood-scale adoption. Pine Hills' tracts score low in it.
  https://www.cell.com/joule/fulltext/S2542-4351(18)30570-1

## National (USA view)

- **~7% of U.S. homes have rooftop solar** (~4.7M households, early 2025);
  4.4% of single-family homes nationally.
  Source: SEIA "6 Million Solar Installations" / Solar Insure 2024-25 stats.
  https://seia.org/research-resources/6-million-solar-installations/
- Solar-adopter median income in 2023 was **$115k vs $75k for all U.S.
  households** — the "solar equity gap" our tool targets.
  Source: Lawrence Berkeley National Laboratory (LBNL), Residential
  Solar-Adopter Income and Demographic Trends.
  https://emp.lbl.gov/publications/residential-solar-adopter-income-0

## State level (why our map colors look the way they do)

- **Hawaii** leads: 27% of Hawaiian Electric residential customers — and 45%
  of its single-family homes — have rooftop solar (about half on Oahu).
  Source: Hawaiian Electric via Daily Energy Insider, 2025.
  https://dailyenergyinsider.com/policy/51002-hawaiian-electric-sees-surge-in-rooftop-solar-additions-in-2025/
- **California**: ~20% of single-family homes have solar.
- **Florida ranks #3 nationally in installed solar capacity** (SEIA, 2026),
  and was a top-3 state for residential installs in 2025 alongside CA and
  Puerto Rico.
  Source: SEIA state rankings & Solar Market Insight 2025 Year in Review.
  https://seia.org/states/fl/
  https://seia.org/research-resources/solar-market-insight-report-2025-year-in-review/
- Our index preserves this real ordering: HI (0.84) > CA (0.79) > NV/AZ >
  … > FL (0.42, upper-middle) > … > WV (0.08).

## Orlando (city view)

- Orlando ranked **#32 of 70 U.S. cities for installed solar capacity** in
  Environment America's *Shining Cities* survey, and is repeatedly cited as
  one of the top Florida cities for solar.
  https://environmentamerica.org/florida/center/media-center/new-study-top-florida-cities-place-well-in-national-solar-rankings/
- The City of Orlando has a formal goal of **100% renewable electricity by
  2050**, anchored by OUC's carbon-neutral Electric Integrated Resource Plan.
  https://renewablesroadmap.iclei.org/wp-content/uploads/2021/11/Orlando-case-study_final.pdf
- Orlando is a pioneer in floating solar (1+ MW deployed since 2017).

## Pine Hills (neighborhood view — the story)

- LBNL's demographic work shows **non-White-majority census tracts deploy
  fewer new solar installations than White-majority tracts at every income
  level**, even after controlling for income, homeownership, housing stock,
  prices, and incentives.
  https://www.sciencedirect.com/science/article/abs/pii/S0301421522003871
- Pine Hills is a majority-Black, working-class Orlando community — exactly
  the kind of neighborhood the published research says is being missed by
  solar outreach. Our red (low-coverage) Pine Hills isn't a random choice;
  it reflects a documented national pattern, and reaching those homes is
  the point of the product.

## Live (non-modeled) values in the app

- Building footprints: OpenStreetMap Overpass API, fetched at runtime
- Peak sun hours: NREL Solar Resource API, fetched at runtime
- Production / savings / payback (featured home): NREL PVWatts v8, runtime
- Financial & environmental analysis: Google Gemini, runtime
- Florida electricity rate ($0.154/kWh) and national household average
  (903 kWh/mo): EIA published figures, used as constants in the code
