// content.js — Taobao Helper main content script
// Handles: material highlighting, shipping highlighting, price conversion

"use strict";

// ─── DICTIONARIES ────────────────────────────────────────────────────────────

const MATERIALS = {
  green: ["亚麻", "真皮", "头层牛皮", "纯亚麻", "棉麻"],
  yellow: ["牛剖层革", "二层皮", "棉麻混纺"],
  red: ["其他材质", "PU", "仿皮", "人造"],
};

const SHIPPING = {
  green: ["空运", "今日发货", "直邮空运"],
  yellow: ["陆运", "48小时发货"],
  red: ["预售", "海运", "7天内发货"],
};

// Sort each tier longest-first so longer matches take priority
for (const tier of Object.values(MATERIALS)) tier.sort((a, b) => b.length - a.length);
for (const tier of Object.values(SHIPPING)) tier.sort((a, b) => b.length - a.length);

// Build flat lookup maps: term → tier
function buildLookup(dict) {
  const map = new Map();
  for (const [tier, terms] of Object.entries(dict)) {
    for (const term of terms) map.set(term, tier);
  }
  return map;
}

const materialLookup = buildLookup(MATERIALS);
const shippingLookup = buildLookup(SHIPPING);

// ─── PRICE CONVERSION ────────────────────────────────────────────────────────

let exchangeRates = null; // { USD, SGD }

async function loadRates() {
  try {
    const response = await browser.runtime.sendMessage({ type: "GET_RATES" });
    if (response && response.rates) {
      exchangeRates = response.rates;
    }
  } catch (e) {
    console.warn("[Taobao Helper] Could not load exchange rates:", e);
  }
}

function formatCurrency(amount, currency) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

// CNY price patterns: ¥123, ￥123.45, 123.00元
const PRICE_REGEX = /[¥￥]([\d,]+(?:\.\d{1,2})?)/g;

function injectPriceConversions(node) {
  if (!exchangeRates) return;
  if (node.nodeType !== Node.TEXT_NODE) return;

  const text = node.textContent;
  if (!PRICE_REGEX.test(text)) return;
  PRICE_REGEX.lastIndex = 0;

  const frag = document.createDocumentFragment();
  let lastIndex = 0;
  let match;

  while ((match = PRICE_REGEX.exec(text)) !== null) {
    // Text before match
    if (match.index > lastIndex) {
      frag.appendChild(document.createTextNode(text.slice(lastIndex, match.index)));
    }

    const rawNum = parseFloat(match[1].replace(/,/g, ""));
    const usd = rawNum * exchangeRates.USD;
    const sgd = rawNum * exchangeRates.SGD;

    // Original price span
    const origSpan = document.createElement("span");
    origSpan.textContent = match[0];

    // Conversion badge
    const badge = document.createElement("span");
    badge.className = "tbh-price-badge";
    badge.title = `${formatCurrency(usd, "USD")} / ${formatCurrency(sgd, "SGD")}`;
    badge.innerHTML =
      `<span class="tbh-usd">${formatCurrency(usd, "USD")}</span>` +
      `<span class="tbh-sgd">${formatCurrency(sgd, "SGD")}</span>`;

    const wrapper = document.createElement("span");
    wrapper.className = "tbh-price-wrapper";
    wrapper.appendChild(origSpan);
    wrapper.appendChild(badge);

    frag.appendChild(wrapper);
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < text.length) {
    frag.appendChild(document.createTextNode(text.slice(lastIndex)));
  }

  node.parentNode.replaceChild(frag, node);
}

// ─── TEXT HIGHLIGHTER ────────────────────────────────────────────────────────

function highlightInTextNode(textNode, lookup, cssPrefix) {
  const text = textNode.textContent;
  if (!text.trim()) return;

  // Check if any keyword exists in the text at all (fast path)
  let hasMatch = false;
  for (const key of lookup.keys()) {
    if (text.includes(key)) { hasMatch = true; break; }
  }
  if (!hasMatch) return;

  const frag = document.createDocumentFragment();
  let remaining = text;
  let changed = false;

  while (remaining.length > 0) {
    let earliest = null; // { index, term, tier }

    for (const [term, tier] of lookup.entries()) {
      const idx = remaining.indexOf(term);
      if (idx === -1) continue;
      if (!earliest || idx < earliest.index || (idx === earliest.index && term.length > earliest.term.length)) {
        earliest = { index: idx, term, tier };
      }
    }

    if (!earliest) {
      frag.appendChild(document.createTextNode(remaining));
      break;
    }

    // Text before match
    if (earliest.index > 0) {
      frag.appendChild(document.createTextNode(remaining.slice(0, earliest.index)));
    }

    // Highlighted span
    const span = document.createElement("mark");
    span.className = `tbh-${cssPrefix}-${earliest.tier}`;
    span.textContent = earliest.term;
    frag.appendChild(span);

    remaining = remaining.slice(earliest.index + earliest.term.length);
    changed = true;
  }

  if (changed) {
    textNode.parentNode.replaceChild(frag, textNode);
  }
}

// ─── WALKER ──────────────────────────────────────────────────────────────────

// Tags we never walk into
const SKIP_TAGS = new Set([
  "SCRIPT", "STYLE", "NOSCRIPT", "IFRAME", "TEXTAREA", "INPUT",
  "BUTTON", "SELECT", "OPTION", "CODE", "PRE", "SVG",
]);

// Class tokens that indicate already-processed nodes
const PROCESSED_CLASS = "tbh-processed";

function walkAndProcess(root) {
  const walker = document.createTreeWalker(
    root,
    NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT,
    {
      acceptNode(node) {
        if (node.nodeType === Node.ELEMENT_NODE) {
          if (SKIP_TAGS.has(node.tagName)) return NodeFilter.FILTER_REJECT;
          if (node.classList && node.classList.contains(PROCESSED_CLASS)) return NodeFilter.FILTER_REJECT;
          return NodeFilter.FILTER_SKIP; // Visit children
        }
        // Text nodes: check parent
        const parent = node.parentElement;
        if (!parent) return NodeFilter.FILTER_REJECT;
        if (SKIP_TAGS.has(parent.tagName)) return NodeFilter.FILTER_REJECT;
        if (parent.classList && parent.classList.contains(PROCESSED_CLASS)) return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      },
    }
  );

  const textNodes = [];
  let node;
  while ((node = walker.nextNode())) {
    textNodes.push(node);
  }

  for (const tn of textNodes) {
    highlightInTextNode(tn, materialLookup, "mat");
    highlightInTextNode(tn, shippingLookup, "ship");
    injectPriceConversions(tn);
  }
}

// ─── MUTATION OBSERVER ───────────────────────────────────────────────────────

let mutationTimer = null;

const observer = new MutationObserver((mutations) => {
  // Debounce to avoid thrashing on rapid DOM updates (e.g. lazy-load)
  clearTimeout(mutationTimer);
  mutationTimer = setTimeout(() => {
    for (const mut of mutations) {
      for (const node of mut.addedNodes) {
        if (node.nodeType === Node.ELEMENT_NODE) {
          walkAndProcess(node);
        }
      }
    }
  }, 200);
});

// ─── INIT ────────────────────────────────────────────────────────────────────

(async function init() {
  await loadRates();

  // Process existing DOM
  walkAndProcess(document.body);

  // Watch for dynamic content (Taobao is heavy SPA)
  observer.observe(document.body, {
    childList: true,
    subtree: true,
  });
})();
