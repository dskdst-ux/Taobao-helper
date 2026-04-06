# 🛒 Taobao Helper

A Firefox browser extension for international Taobao shoppers.

## Features (v1)

- **Material Highlighter** — highlights fabric/material keywords in green 🟢 yellow 🟡 red 🔴
- **Shipping Highlighter** — highlights shipping terms by speed/method
- **Price Converter** — shows USD 🇺🇸 and SGD 🇸🇬 next to every CNY price, live rates

## Setup

### 1. Get a free exchange rate API key
1. Go to [exchangerate-api.com](https://www.exchangerate-api.com/) and create a free account
2. Copy your API key
3. Open `background.js` and replace `YOUR_API_KEY_HERE` with your key:
   ```js
   const API_KEY = "your_actual_key_here";
   ```

### 2. Add placeholder icons (required to load extension)
Firefox requires icon files to exist. Generate or add:
- `icons/icon48.png` (48×48px)
- `icons/icon96.png` (96×96px)

Quick option: use any PNG or generate one at [favicon.io](https://favicon.io/).

### 3. Load in Firefox
1. Open Firefox → address bar → `about:debugging`
2. Click **This Firefox** → **Load Temporary Add-on**
3. Select the `manifest.json` file from this folder

### 4. Test it
Go to any [taobao.com](https://www.taobao.com) product page and look for:
- Highlighted material keywords in product descriptions
- Highlighted shipping terms
- USD/SGD badges next to CNY prices

---

## Keyword Reference

### Materials
| Color | Terms |
|-------|-------|
| 🟢 Green | 亚麻, 真皮, 头层牛皮, 纯亚麻, 棉麻 |
| 🟡 Yellow | 牛剖层革, 二层皮, 棉麻混纺 |
| 🔴 Red | 其他材质, PU, 仿皮, 人造 |

### Shipping
| Color | Terms |
|-------|-------|
| 🟢 Green | 空运, 今日发货, 直邮空运 |
| 🟡 Yellow | 陆运, 48小时发货 |
| 🔴 Red | 预售, 海运, 7天内发货 |

---

## File Structure
```
taobao-helper/
├── manifest.json       # Extension manifest (MV2, Firefox)
├── background.js       # Exchange rate fetching + caching
├── content.js          # DOM walker, highlighter, price injector
├── content.css         # Highlight + badge styles
├── icons/
│   ├── icon48.png
│   └── icon96.png
└── popup/
    ├── popup.html      # Extension popup
    ├── popup.css
    └── popup.js        # Displays live rates in popup
```

## Notes
- Exchange rates are cached for 1 hour to stay within free API tier limits
- Works on `*.taobao.com` and `*.tmall.com`
- Uses MutationObserver to handle Taobao's dynamic/lazy-loaded content
