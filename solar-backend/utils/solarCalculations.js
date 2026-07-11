/**
 * Takes the raw response from Google's Solar API (buildingInsights)
 * and turns it into simple numbers a frontend can display:
 * system size, install cost, savings, payback period.
 *
 * We also take in electricityRate and costPerWatt so those two
 * assumptions live in .env, not buried in code.
 */
export function calculateSolarEstimate(solarApiData, electricityRate, costPerWatt) {
  const solarPotential = solarApiData.solarPotential;

  if (!solarPotential) {
    throw new Error("Google Solar API had no data for this roof.");
  }

  // Google returns a list of possible panel configurations, sorted from
  // smallest to largest system. We'll pick a config near the "max" size
  // Google thinks reasonably fits the roof, capped at a normal home system.
  const configs = solarPotential.solarPanelConfigs || [];
  if (!configs.length) {
    throw new Error("No viable solar panel configuration found for this roof.");
  }

  // Pick the config that covers ~80% of max panel count — a realistic
  // "typical install" rather than maxing out every inch of roof.
  const maxPanels = solarPotential.maxArrayPanelsCount;
  const targetPanelCount = Math.round(maxPanels * 0.8);

  let chosenConfig = configs[0];
  for (const config of configs) {
    if (config.panelsCount <= targetPanelCount) {
      chosenConfig = config;
    }
  }

  const panelCapacityWatts = solarPotential.panelCapacityWatts || 400; // Google's default panel wattage
  const systemSizeWatts = chosenConfig.panelsCount * panelCapacityWatts;
  const systemSizeKw = systemSizeWatts / 1000;

  const yearlyEnergyKwh = chosenConfig.yearlyEnergyDcKwh;

  // --- Cost & savings math ---
  const estimatedInstallCost = Math.round(systemSizeWatts * costPerWatt);

  // 30% federal solar tax credit (as of 2026 — verify before demo if possible)
  const federalTaxCredit = Math.round(estimatedInstallCost * 0.3);
  const netCostAfterTaxCredit = estimatedInstallCost - federalTaxCredit;

  const annualSavings = Math.round(yearlyEnergyKwh * electricityRate);
  const monthlySavings = Math.round(annualSavings / 12);

  const paybackYears = annualSavings > 0
    ? +(netCostAfterTaxCredit / annualSavings).toFixed(1)
    : null;

  const twentyYearSavings = (annualSavings * 20) - netCostAfterTaxCredit;

  // Estimate their current annual bill assuming solar would offset ~90% of usage
  const estimatedCurrentAnnualBill = Math.round(annualSavings / 0.9);

  return {
    roof: {
      maxPanelsFit: maxPanels,
      wholeRoofAreaSqMeters: solarPotential.wholeRoofStats?.areaMeters2 ?? null,
      maxSunshineHoursPerYear: solarPotential.maxSunshineHoursPerYear ?? null,
    },
    system: {
      recommendedPanelCount: chosenConfig.panelsCount,
      systemSizeKw: +systemSizeKw.toFixed(2),
      estimatedYearlyProductionKwh: Math.round(yearlyEnergyKwh),
    },
    costs: {
      estimatedInstallCost,
      federalTaxCredit,
      netCostAfterTaxCredit,
      monthlySavings,
      annualSavings,
      paybackYears,
      twentyYearSavings: Math.round(twentyYearSavings),
    },
    utility: {
      estimatedCurrentAnnualBill,
      ratePerKwh: electricityRate,
    },
  };
}
