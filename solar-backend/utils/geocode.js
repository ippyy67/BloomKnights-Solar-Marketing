import fetch from "node-fetch";

/**
 * Turns a plain text address (e.g. "123 Main St, Orlando, FL")
 * into { lat, lng } coordinates using Google's Geocoding API.
 *
 * Why we need this: the Solar API doesn't understand addresses,
 * only latitude/longitude. So this is always step 1.
 */
export async function geocodeAddress(address, apiKey) {
  const url = new URL("https://maps.googleapis.com/maps/api/geocode/json");
  url.searchParams.set("address", address);
  url.searchParams.set("key", apiKey);

  const response = await fetch(url);
  const data = await response.json();

  if (data.status !== "OK" || !data.results.length) {
    throw new Error(`Could not find that address (Google said: ${data.status})`);
  }

  const result = data.results[0];
  const { lat, lng } = result.geometry.location;

  return {
    lat,
    lng,
    formattedAddress: result.formatted_address,
  };
}
