# Taobao Helper — Claude Code Context

## What this is
A Firefox browser extension (Manifest V2) that helps international buyers shop on Taobao.com and Tmall.com. Built for complete beginners — keep code simple, well-commented, and avoid frameworks.

## Developer
- Beginner coder, explain changes clearly
- Target users: international Taobao/Tmall shoppers, r/taobao, r/FashionReps, Southeast Asia (Singapore, Thailand, Malaysia)
- GitHub: github.com/dskdst-ux/Taobao-helper

## File structure
```
taobao-helper/
├── CLAUDE.md           ← you are here
├── manifest.json       # Firefox MV2 manifest
├── background.js       # Exchange rate fetch/cache + toolbar click handler
├── content.js          # Main logic: DOM walker, highlighter, sidebar, price converter
├── content.css         # Highlight styles for material/shipping marks + price badges
├── sidebar.css         # Sliding sidebar UI styles
├── icons/
│   ├── icon48.png
│   └── icon96.png
└── popup/              # Legacy popup (not currently used — sidebar replaced it)
```

## How it works
1. `background.js` fetches CNY→USD/SGD rates from exchangerate-api.com (cached 1hr in browser.storage.local). Toolbar icon click sends TOGGLE_SIDEBAR message to content script.
2. `content.js` runs on every taobao.com + tmall.com page. It:
   - Walks the DOM via TreeWalker
   - Highlights material/shipping keywords inline using `<mark>` tags
   - Injects USD/SGD price badges next to every ¥ price
   - Builds a sidebar (injected into page DOM) that aggregates all findings
   - Listens for TOGGLE_SIDEBAR message from background.js
3. `sidebar.css` styles the sidebar (slides in from right, z-index max)

## Current features (v1.1)
- **Material highlighter**: 🟢 Green (亚麻, 真皮, 头层牛皮, 纯亚麻, 棉麻) · 🟡 Yellow (牛剖层革, 二层皮, 棉麻混纺) · 🔴 Red (其他材质, PU, 仿皮, 人造)
- **Shipping highlighter**: 🟢 Green (空运, 今日发货, 直邮空运) · 🟡 Yellow (陆运, 48小时发货) · 🔴 Red (预售, 海运, 7天内发货)
- **Price converter**: Shows USD + SGD badges next to every CNY price on the page
- **Sidebar**: Click extension icon to toggle. Shows all found keywords, all prices, and a live CNY quick-converter input

## API key
The exchange rate API key lives in `background.js` at the top:
```js
const API_KEY = "YOUR_API_KEY_HERE"; // replace with key from exchangerate-api.com
```
Ed has his own key — never overwrite this line with a placeholder.

## How to test changes
1. Edit files in this folder
2. Open Firefox → about:debugging → This Firefox → click Reload on Taobao Helper
3. Go to a taobao.com or tmall.com product page
4. Click the Taobao Helper icon in the toolbar to open the sidebar

## Known limitations / things to improve
- Taobao/Tmall load content dynamically (React/SPA) — MutationObserver handles this but some deeply lazy-loaded content may be missed
- Some text is inside images (not real DOM text) so it can't be highlighted
- Extension is temporary (loaded via about:debugging) — not yet submitted to Firefox Add-ons store

## Tech constraints
- Manifest V2 only (Firefox compatibility)
- No npm, no bundler, no frameworks — plain JS/HTML/CSS
- browser.* API (not chrome.*) for Firefox
- Must work on both *.taobao.com and *.tmall.com

## Planned features (not built yet)
- Seller reputation score display
- Shipping cost estimator for international routes
- Wishlist / price tracker
- Submit to Firefox Add-ons store
