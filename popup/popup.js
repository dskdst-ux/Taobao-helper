// popup.js
(async function () {
  const usdEl = document.getElementById("usd-rate");
  const sgdEl = document.getElementById("sgd-rate");
  const metaEl = document.getElementById("rate-meta");

  try {
    const response = await browser.runtime.sendMessage({ type: "GET_RATES" });

    if (response && response.rates) {
      const { USD, SGD } = response.rates;
      usdEl.textContent = USD.toFixed(4);
      sgdEl.textContent = SGD.toFixed(4);

      // Show cache timestamp
      const stored = await browser.storage.local.get("ratesTimestamp");
      if (stored.ratesTimestamp) {
        const ago = Math.round((Date.now() - stored.ratesTimestamp) / 60000);
        metaEl.textContent = ago < 2 ? "Updated just now" : `Updated ${ago} min ago`;
      } else {
        metaEl.textContent = "Live rate";
      }
    } else {
      usdEl.textContent = "—";
      sgdEl.textContent = "—";
      metaEl.textContent = "Could not load rates";
    }
  } catch (e) {
    usdEl.textContent = "—";
    sgdEl.textContent = "—";
    metaEl.textContent = "Error loading rates";
  }
})();
