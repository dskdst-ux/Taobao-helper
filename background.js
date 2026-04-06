// background.js — fetches & caches exchange rates
// Cache duration: 1 hour (3600000ms)
const CACHE_DURATION = 60 * 60 * 1000;

// NOTE: Replace with your free key from https://www.exchangerate-api.com/
const API_KEY = "YOUR_API_KEY_HERE";
const API_URL = `https://v6.exchangerate-api.com/v6/${API_KEY}/latest/CNY`;

async function fetchRates() {
  const stored = await browser.storage.local.get(["rates", "ratesTimestamp"]);
  const now = Date.now();

  if (
    stored.rates &&
    stored.ratesTimestamp &&
    now - stored.ratesTimestamp < CACHE_DURATION
  ) {
    return stored.rates;
  }

  try {
    const resp = await fetch(API_URL);
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const data = await resp.json();

    if (data.result !== "success") throw new Error("API returned failure");

    const rates = {
      USD: data.conversion_rates.USD,
      SGD: data.conversion_rates.SGD,
    };

    await browser.storage.local.set({
      rates,
      ratesTimestamp: now,
    });

    return rates;
  } catch (err) {
    console.error("[Taobao Helper] Rate fetch failed:", err);
    // Fall back to stored rates even if stale
    return stored.rates || null;
  }
}

// Respond to content script requests for rates
browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "GET_RATES") {
    fetchRates().then((rates) => sendResponse({ rates }));
    return true; // Keep channel open for async response
  }
});
