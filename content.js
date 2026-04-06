// content.js — Taobao Helper v1.1
"use strict";

// ─── DICTIONARIES ────────────────────────────────────────────────────────────

const MATERIALS = {
  green:  ["亚麻", "真皮", "头层牛皮", "纯亚麻", "棉麻"],
  yellow: ["牛剖层革", "二层皮", "棉麻混纺"],
  red:    ["其他材质", "PU", "仿皮", "人造"],
};

const SHIPPING = {
  green:  ["空运", "今日发货", "直邮空运"],
  yellow: ["陆运", "48小时发货"],
  red:    ["预售", "海运", "7天内发货"],
};

for (const tier of Object.values(MATERIALS)) tier.sort((a, b) => b.length - a.length);
for (const tier of Object.values(SHIPPING))  tier.sort((a, b) => b.length - a.length);

function buildLookup(dict) {
  const map = new Map();
  for (const [tier, terms] of Object.entries(dict))
    for (const term of terms) map.set(term, tier);
  return map;
}

const materialLookup = buildLookup(MATERIALS);
const shippingLookup  = buildLookup(SHIPPING);

// ─── STATE ───────────────────────────────────────────────────────────────────

let exchangeRates = null;
let sidebarEl     = null;
let sidebarOpen   = false;

// Aggregated findings for sidebar
const found = {
  materials: { green: new Set(), yellow: new Set(), red: new Set() },
  shipping:  { green: new Set(), yellow: new Set(), red: new Set() },
  prices:    [], // { cny, usd, sgd }
};

// ─── EXCHANGE RATES ──────────────────────────────────────────────────────────

async function loadRates() {
  try {
    const response = await browser.runtime.sendMessage({ type: "GET_RATES" });
    if (response && response.rates) exchangeRates = response.rates;
  } catch (e) {
    console.warn("[Taobao Helper] Could not load rates:", e);
  }
}

function fmt(amount, currency) {
  return new Intl.NumberFormat("en-US", {
    style: "currency", currency,
    minimumFractionDigits: 2, maximumFractionDigits: 2,
  }).format(amount);
}

// ─── PRICE DETECTION ─────────────────────────────────────────────────────────

const PRICE_REGEX = /[¥￥]([\d,]+(?:\.\d{1,2})?)/g;

function injectPriceConversions(node) {
  if (!exchangeRates) return;
  const text = node.textContent;
  PRICE_REGEX.lastIndex = 0;
  if (!PRICE_REGEX.test(text)) return;
  PRICE_REGEX.lastIndex = 0;

  const frag = document.createDocumentFragment();
  let lastIndex = 0, match;

  while ((match = PRICE_REGEX.exec(text)) !== null) {
    if (match.index > lastIndex)
      frag.appendChild(document.createTextNode(text.slice(lastIndex, match.index)));

    const cny = parseFloat(match[1].replace(/,/g, ""));
    const usd = cny * exchangeRates.USD;
    const sgd = cny * exchangeRates.SGD;

    // Track for sidebar
    found.prices.push({ cny, usd, sgd });

    const origSpan = document.createElement("span");
    origSpan.textContent = match[0];

    const badge = document.createElement("span");
    badge.className = "tbh-price-badge";
    badge.innerHTML =
      `<span class="tbh-usd">${fmt(usd, "USD")}</span>` +
      `<span class="tbh-sgd">${fmt(sgd, "SGD")}</span>`;

    const wrapper = document.createElement("span");
    wrapper.className = "tbh-price-wrapper";
    wrapper.appendChild(origSpan);
    wrapper.appendChild(badge);

    frag.appendChild(wrapper);
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < text.length)
    frag.appendChild(document.createTextNode(text.slice(lastIndex)));

  node.parentNode.replaceChild(frag, node);
}

// ─── TEXT HIGHLIGHTER ────────────────────────────────────────────────────────

function highlightInTextNode(textNode, lookup, cssPrefix, foundBucket) {
  const text = textNode.textContent;
  if (!text.trim()) return;

  let hasMatch = false;
  for (const key of lookup.keys()) {
    if (text.includes(key)) { hasMatch = true; break; }
  }
  if (!hasMatch) return;

  const frag = document.createDocumentFragment();
  let remaining = text, changed = false;

  while (remaining.length > 0) {
    let earliest = null;
    for (const [term, tier] of lookup.entries()) {
      const idx = remaining.indexOf(term);
      if (idx === -1) continue;
      if (!earliest || idx < earliest.index ||
         (idx === earliest.index && term.length > earliest.term.length))
        earliest = { index: idx, term, tier };
    }

    if (!earliest) { frag.appendChild(document.createTextNode(remaining)); break; }

    if (earliest.index > 0)
      frag.appendChild(document.createTextNode(remaining.slice(0, earliest.index)));

    const span = document.createElement("mark");
    span.className = `tbh-${cssPrefix}-${earliest.tier}`;
    span.textContent = earliest.term;
    frag.appendChild(span);

    // Track for sidebar
    if (foundBucket) foundBucket[earliest.tier].add(earliest.term);

    remaining = remaining.slice(earliest.index + earliest.term.length);
    changed = true;
  }

  if (changed) textNode.parentNode.replaceChild(frag, textNode);
}

// ─── DOM WALKER ──────────────────────────────────────────────────────────────

const SKIP_TAGS = new Set([
  "SCRIPT","STYLE","NOSCRIPT","IFRAME","TEXTAREA","INPUT",
  "BUTTON","SELECT","OPTION","CODE","PRE","SVG",
]);

function walkAndProcess(root) {
  const walker = document.createTreeWalker(
    root,
    NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT,
    {
      acceptNode(node) {
        if (node.nodeType === Node.ELEMENT_NODE) {
          if (SKIP_TAGS.has(node.tagName)) return NodeFilter.FILTER_REJECT;
          if (node.id === "tbh-sidebar") return NodeFilter.FILTER_REJECT;
          return NodeFilter.FILTER_SKIP;
        }
        const parent = node.parentElement;
        if (!parent) return NodeFilter.FILTER_REJECT;
        if (SKIP_TAGS.has(parent.tagName)) return NodeFilter.FILTER_REJECT;
        if (parent.closest("#tbh-sidebar")) return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      },
    }
  );

  const textNodes = [];
  let node;
  while ((node = walker.nextNode())) textNodes.push(node);

  for (const tn of textNodes) {
    highlightInTextNode(tn, materialLookup, "mat", found.materials);
    highlightInTextNode(tn, shippingLookup,  "ship", found.shipping);
    injectPriceConversions(tn);
  }
}

// ─── SIDEBAR ─────────────────────────────────────────────────────────────────

function buildSidebar() {
  if (sidebarEl) return; // already built

  sidebarEl = document.createElement("div");
  sidebarEl.id = "tbh-sidebar";
  sidebarEl.innerHTML = `
    <div class="tbh-sb-header">
      <span class="tbh-sb-logo">🛒 Taobao Helper</span>
      <button class="tbh-sb-close" id="tbh-close">✕</button>
    </div>

    <div class="tbh-sb-body">

      <!-- Materials -->
      <div class="tbh-sb-section">
        <div class="tbh-sb-section-title">🧵 Materials Found</div>
        <div id="tbh-mat-content"></div>
      </div>

      <!-- Shipping -->
      <div class="tbh-sb-section">
        <div class="tbh-sb-section-title">📦 Shipping Found</div>
        <div id="tbh-ship-content"></div>
      </div>

      <!-- Prices -->
      <div class="tbh-sb-section">
        <div class="tbh-sb-section-title">💰 Prices on Page</div>
        <div id="tbh-price-content"></div>
      </div>

      <!-- Quick Converter -->
      <div class="tbh-sb-section">
        <div class="tbh-sb-section-title">⚡ Quick Converter</div>
        <div class="tbh-converter">
          <div class="tbh-input-row">
            <span class="tbh-cny-symbol">¥</span>
            <input type="number" id="tbh-cny-input" placeholder="Enter CNY" min="0" />
          </div>
          <div class="tbh-conv-results" id="tbh-conv-results">
            <div class="tbh-conv-row tbh-conv-usd">
              <span>🇺🇸 USD</span><span id="tbh-out-usd">—</span>
            </div>
            <div class="tbh-conv-row tbh-conv-sgd">
              <span>🇸🇬 SGD</span><span id="tbh-out-sgd">—</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Rate info -->
      <div class="tbh-sb-footer" id="tbh-rate-footer">Loading rates…</div>

    </div>
  `;

  document.body.appendChild(sidebarEl);

  // Close button
  document.getElementById("tbh-close").addEventListener("click", closeSidebar);

  // Converter input
  document.getElementById("tbh-cny-input").addEventListener("input", (e) => {
    const val = parseFloat(e.target.value);
    if (!exchangeRates || isNaN(val) || val < 0) {
      document.getElementById("tbh-out-usd").textContent = "—";
      document.getElementById("tbh-out-sgd").textContent = "—";
      return;
    }
    document.getElementById("tbh-out-usd").textContent = fmt(val * exchangeRates.USD, "USD");
    document.getElementById("tbh-out-sgd").textContent = fmt(val * exchangeRates.SGD, "SGD");
  });
}

function renderSidebarContent() {
  // Materials
  const matEl = document.getElementById("tbh-mat-content");
  matEl.innerHTML = "";
  let matAny = false;
  for (const tier of ["green", "yellow", "red"]) {
    if (found.materials[tier].size === 0) continue;
    matAny = true;
    const row = document.createElement("div");
    row.className = "tbh-keyword-row";
    row.innerHTML = `<span class="tbh-dot tbh-dot-${tier}"></span>
      <span class="tbh-keyword-list">${[...found.materials[tier]].join(" · ")}</span>`;
    matEl.appendChild(row);
  }
  if (!matAny) matEl.innerHTML = `<div class="tbh-empty">No material keywords detected</div>`;

  // Shipping
  const shipEl = document.getElementById("tbh-ship-content");
  shipEl.innerHTML = "";
  let shipAny = false;
  for (const tier of ["green", "yellow", "red"]) {
    if (found.shipping[tier].size === 0) continue;
    shipAny = true;
    const row = document.createElement("div");
    row.className = "tbh-keyword-row";
    row.innerHTML = `<span class="tbh-dot tbh-dot-${tier}"></span>
      <span class="tbh-keyword-list">${[...found.shipping[tier]].join(" · ")}</span>`;
    shipEl.appendChild(row);
  }
  if (!shipAny) shipEl.innerHTML = `<div class="tbh-empty">No shipping keywords detected</div>`;

  // Prices
  const priceEl = document.getElementById("tbh-price-content");
  priceEl.innerHTML = "";
  if (found.prices.length === 0) {
    priceEl.innerHTML = `<div class="tbh-empty">No prices detected</div>`;
  } else {
    // Deduplicate by CNY value, show up to 8
    const seen = new Set();
    const unique = found.prices.filter(p => {
      if (seen.has(p.cny)) return false;
      seen.add(p.cny); return true;
    }).slice(0, 8);

    unique.forEach(p => {
      const row = document.createElement("div");
      row.className = "tbh-price-row";
      row.innerHTML = `
        <span class="tbh-price-cny">¥${p.cny.toLocaleString()}</span>
        <span class="tbh-price-usd">${fmt(p.usd, "USD")}</span>
        <span class="tbh-price-sgd">${fmt(p.sgd, "SGD")}</span>`;
      priceEl.appendChild(row);
    });
  }

  // Rate footer
  const footerEl = document.getElementById("tbh-rate-footer");
  if (exchangeRates) {
    footerEl.textContent = `1 CNY = ${exchangeRates.USD.toFixed(4)} USD · ${exchangeRates.SGD.toFixed(4)} SGD`;
  } else {
    footerEl.textContent = "⚠️ Rates unavailable — check your API key";
  }
}

function openSidebar() {
  if (!sidebarEl) buildSidebar();
  renderSidebarContent();
  sidebarEl.classList.add("tbh-open");
  sidebarOpen = true;
}

function closeSidebar() {
  if (sidebarEl) sidebarEl.classList.remove("tbh-open");
  sidebarOpen = false;
}

function toggleSidebar() {
  sidebarOpen ? closeSidebar() : openSidebar();
}

// ─── MUTATION OBSERVER ───────────────────────────────────────────────────────

let mutationTimer = null;
const observer = new MutationObserver((mutations) => {
  clearTimeout(mutationTimer);
  mutationTimer = setTimeout(() => {
    for (const mut of mutations) {
      for (const node of mut.addedNodes) {
        if (node.nodeType === Node.ELEMENT_NODE &&
            node.id !== "tbh-sidebar" &&
            !node.closest?.("#tbh-sidebar")) {
          walkAndProcess(node);
        }
      }
    }
  }, 300);
});

// ─── MESSAGE LISTENER ────────────────────────────────────────────────────────

browser.runtime.onMessage.addListener((message) => {
  if (message.type === "TOGGLE_SIDEBAR") toggleSidebar();
});

// ─── INIT ────────────────────────────────────────────────────────────────────

(async function init() {
  await loadRates();
  walkAndProcess(document.body);
  observer.observe(document.body, { childList: true, subtree: true });
})();
