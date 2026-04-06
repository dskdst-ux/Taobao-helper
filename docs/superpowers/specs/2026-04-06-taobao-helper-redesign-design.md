# Taobao Helper — Full Redesign Design Spec
**Date:** 2026-04-06
**Status:** Approved

---

## Overview

A Firefox MV2 browser extension for international Taobao shoppers. Vanilla JS/HTML/CSS only — no frameworks, no build steps. The redesign replaces the current broken overlay sidebar with a non-intrusive edge tab + slide panel, adds selection-based translation, size conversion, seller trust indicators, wishlist, and personal notes.

---

## Core Shell Behavior

- A slim tab is fixed to the right edge of the viewport at all times
- Clicking the tab opens or closes the panel
- The panel slides out from the right as an overlay (~280px wide)
- No X button — the tab is the only open/close control
- State (open/closed) is saved in `browser.storage.local` and restored on every page load
- The panel never auto-opens; it respects the user's last choice

### First-Run Setup
- On first install, a one-time currency selector appears (popup or inline panel)
- User selects which currencies to display (USD, SGD, GBP, EUR, AUD, and others from frankfurter.app's supported list)
- Selection saved to `browser.storage.local`
- Can be changed later via a gear icon in the panel header, which reopens the currency selector

---

## File Structure

```
taobao-helper/
├── manifest.json          — MV2, Firefox, permissions
├── content.js             — All page-level logic (highlight, price, size, seller, translate, wishlist)
├── background.js          — Exchange rate fetch/cache, translation proxy if needed
├── sidebar.css            — Edge tab + panel styles
├── content.css            — Inline highlight styles (marks, price badges)
├── onboarding.html        — First-run currency selector page
├── onboarding.js
├── wishlist.html          — Full wishlist management page
├── wishlist.js
└── icons/
    ├── icon48.png
    └── icon96.png
```

---

## Panel Sections

All sections are collapsible. Each has a clickable header that expands/collapses its content. Default state: all expanded.

### 1. 🧵 Materials
- Scans the page for material keywords from the built-in dictionary
- Displays each detected keyword as a colored badge with its English translation below
- Color coding: green (good), yellow (mixed), red (avoid)
- Filter input at the top of the section — typing narrows the displayed list in real time
- Badges are color-matched to the highlights on the page

### 2. 📦 Shipping
- Same structure as Materials
- Keywords: green (fast/air), yellow (slow/land), red (avoid/pre-order/sea)
- Filter input at top

### 3. 💰 Prices
- Auto-detects all CNY (¥) prices on the page
- Converts to the user's chosen currencies using live rates from frankfurter.app
- Shows up to 8 unique prices, deduplicated by CNY value
- Manual input field at the bottom for prices not detected on the page
- Rate source and last-updated timestamp shown at bottom of section
- Exchange rate is cached for 1 hour in `browser.storage.local`

**Exchange Rate API:** `https://api.frankfurter.app/latest?from=CNY`
- Free, no API key required
- Replaces old exchangerate-api.com integration

### 4. 📏 Sizes
- **Auto-detect:** Scans page text for common CN size patterns (XS/S/M/L/XL/XXL, numeric sizes like 165/88A, shoe sizes like 40/41/42)
- Converts detected sizes to US, EU, UK, AU equivalents using built-in lookup tables
- Covers: tops, bottoms, shoes, children's sizes
- **Manual fallback:** Input field where user types a CN size and sees all conversions immediately
- If auto-detection finds nothing, only the manual tool is shown

### 5. 🌐 Translation
- User highlights any Chinese text on the page
- A small floating bubble appears near the selection
- Clicking the bubble: opens the panel if closed (or updates it if already open), then populates this section with the translation
- Source text and English translation both displayed
- Powered by MyMemory API (free, no key, ~1000 words/day)
- API: `https://api.mymemory.translated.net/get?q=TEXT&langpair=zh|en`
- If API fails: shows error message, does not break the page

### 6. 🏪 Seller
- Only active on product detail pages (item URLs) — not on search results or home pages
- Scrapes seller info from the current product page:
  - Store name
  - Overall rating (%)
  - Store age (years/months since opening)
  - Total review count
  - Seller response rate (%)
- Red flag indicators (shown as warning badges):
  - Store open less than 6 months
  - Rating below 95%
  - Fewer than 10 reviews
  - Response rate below 80%
- If data cannot be scraped (page structure changed), section shows a graceful "unavailable" message

### 7. 🔖 Wishlist
- Shows the 3 most recently saved items as compact cards
- Each card: thumbnail image, product name, price (CNY + converted), date saved
- "View all" button opens the full wishlist page in a new tab
- "Save this item" button at top of section captures:
  - Page URL
  - Product name (scraped from page title/h1)
  - Main product image
  - Current price
  - Date saved
  - Personal note (optional, editable inline)
- Saved to `browser.storage.local`

### 8. 📝 Notes
- A text area for personal notes about the current product
- Notes are keyed by URL — each product page has its own note
- Saved automatically as you type (debounced 500ms)
- Saved to `browser.storage.local`
- Community notes: planned for a future version requiring a backend

---

## Full Wishlist Page (`wishlist.html`)

Opened in a new tab from the sidebar wishlist section.

- Grid of saved item cards
- Each card: image, product name, CNY price + converted prices, date saved, personal note, link back to product, delete button
- Sort by: date saved (newest first, oldest first), price (low to high, high to low)
- Filter by: keyword search across product names and notes
- Bulk delete support
- Export to CSV (nice to have, can be added later)

---

## Inline Page Highlights

These run on page load and via MutationObserver for dynamic content:

- **Material keywords** — `<mark>` elements with color classes
- **Shipping keywords** — `<mark>` elements with color classes
- **Price badges** — inline spans injected next to ¥ prices showing converted amounts
- **Hover tooltips** — hovering a highlighted keyword shows its English translation

---

## APIs

| API | Purpose | Key required | Limit |
|---|---|---|---|
| frankfurter.app | Exchange rates | No | Unlimited (fair use) |
| MyMemory | Translation | No | ~1000 words/day |

---

## Data Storage (`browser.storage.local`)

| Key | Contents |
|---|---|
| `tbh_rates` | Cached exchange rates object |
| `tbh_rates_ts` | Timestamp of last rate fetch |
| `tbh_currencies` | Array of user-selected currency codes |
| `tbh_sidebar_open` | Boolean — last sidebar state |
| `tbh_wishlist` | Array of saved item objects |
| `tbh_notes` | Object keyed by URL → note string |
| `tbh_onboarded` | Boolean — whether first-run is complete |

---

## Constraints

- Manifest V2 only (Firefox compatible)
- No npm, no frameworks, no build steps
- Plain HTML/CSS/JS files only
- Do not use `chrome.*` — use `browser.*` throughout
- All data stored locally — no external servers except the two APIs above
- `manifest.json` must declare `web_accessible_resources` for `wishlist.html` and `onboarding.html` so they can be opened as tabs via `browser.runtime.getURL()`

---

## Out of Scope (Future Versions)

- Community notes (requires backend server + database)
- Custom keyword dictionary (pro version)
- Price history / price drop alerts
- Export wishlist to CSV
- Browser sync across devices
