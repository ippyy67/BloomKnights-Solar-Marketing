import express from "express";
import fetch from "node-fetch";
import { geocodeAddress } from "../utils/geocode.js";
import { calculateSolarEstimate } from "../utils/solarCalculations.js";
import { orlandoNeighborhoods } from "../data/orlandoNeighborhoods.js";

const router = express.Router();

const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY;
const ELECTRICITY_RATE = parseFloat(process.env.ORLANDO_ELECTRICITY_RATE_PER_KWH || "0.14");
const COST_PER_WATT = parseFloat(process.env.COST_PER_WATT_INSTALLED || "3.00");

/**
 * Calls Google's Solar API for a given lat/lng.
 * Shared by both routes below.
 */
async function fetchSolarData(lat, lng) {
  const url = new URL("https://solar.googleapis.com/v1/buildingInsights:findClosest");
  url.searchParams.set("location.latitude", lat);
  url.searchParams.set("location.longitude", lng);
  url.searchParams.set("key", GOOGLE_API_KEY);

  const response = await fetch(url);
  const data = await response.json();

  if (data.error) {
    throw new Error(data.error.message || "Google Solar API error");
  }

  return data;
}

/**
 * GET /api/solar?address=123 Main St, Orlando, FL
 *
 * The main endpoint your teammates will call when a user types
 * in an address. Returns roof stats + cost/savings estimate.
 */
router.get("/solar", async (req, res) => {
  const { address } = req.query;

  if (!address) {
    return res.status(400).json({ error: "Missing 'address' query parameter." });
  }

  try {
    const location = await geocodeAddress(address, GOOGLE_API_KEY);
    const solarApiData = await fetchSolarData(location.lat, location.lng);
    const estimate = calculateSolarEstimate(solarApiData, ELECTRICITY_RATE, COST_PER_WATT);

    res.json({
      address: location.formattedAddress,
      coordinates: { lat: location.lat, lng: location.lng },
      ...estimate,
    });
  } catch (err) {
    console.error("Error in /api/solar:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// Simple in-memory cache so we don't re-hit the Solar API on every
// request for the targeting map (it's the same ~8 addresses every time).
let targetsCache = null;

/**
 * GET /api/targets
 *
 * Returns solar potential + priority score for a set of Orlando
 * neighborhoods, for the marketing/targeting map view.
 */
router.get("/targets", async (req, res) => {
  try {
    if (targetsCache) {
      return res.json(targetsCache);
    }

    const results = [];

    for (const neighborhood of orlandoNeighborhoods) {
      try {
        const location = await geocodeAddress(neighborhood.address, GOOGLE_API_KEY);
        const solarApiData = await fetchSolarData(location.lat, location.lng);
        const estimate = calculateSolarEstimate(solarApiData, ELECTRICITY_RATE, COST_PER_WATT);

        // Priority score: higher potential savings + higher current bills
        // = better sales target. Simple weighted formula, tweak freely.
        const priorityScore = Math.round(
          estimate.costs.annualSavings * 0.6 + neighborhood.avgMonthlyBill * 12 * 0.4
        );

        results.push({
          name: neighborhood.name,
          address: location.formattedAddress,
          coordinates: { lat: location.lat, lng: location.lng },
          avgMonthlyBill: neighborhood.avgMonthlyBill,
          estimatedAnnualSavings: estimate.costs.annualSavings,
          systemSizeKw: estimate.system.systemSizeKw,
          priorityScore,
        });
      } catch (innerErr) {
        // If one address fails, skip it but keep going for the rest
        console.error(`Skipping ${neighborhood.name}:`, innerErr.message);
      }
    }

    // Highest priority targets first
    results.sort((a, b) => b.priorityScore - a.priorityScore);

    targetsCache = results;
    res.json(results);
  } catch (err) {
    console.error("Error in /api/targets:", err.message);
    res.status(500).json({ error: err.message });
  }
});

export default router;
