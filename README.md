# 🌊 El Niño Global Tracker 2026

A live interactive dashboard tracking El Niño impacts worldwide across all of 2026 — with real-time weather data, month-by-month forecasts, and safety remedies for 10 affected regions.

**Live demo:** `https://YOUR-USERNAME.github.io/elnino-tracker`

---

## Features

- **🗺️ Interactive world map** — color-coded impact markers for 10 major affected regions
- **⏯️ Year scrubber** — rewind and fast-forward through all 12 months of 2026
- **📊 ONI Index chart** — full-year Oceanic Niño Index forecast with El Niño/La Niña thresholds
- **🌤️ Live weather** — real-time temperature, humidity, wind, and 72h rain forecast via Open-Meteo (no API key needed)
- **🛡️ Safety remedies** — specific, actionable guidance for each hazard type per region and month
- **🗂️ Region sorting** — filter by continent/region, sorted by impact severity
- **📱 Mobile responsive** — works on phones and tablets

## Regions Tracked

| Region | Countries |
|--------|-----------|
| Peru & Ecuador | Peru, Ecuador |
| Eastern Australia | Australia |
| Indonesia & Philippines | Indonesia, Philippines |
| India (Central & South) | India |
| East Africa | Kenya, Ethiopia, Somalia, Tanzania |
| Southern USA | United States |
| Southern Africa | Zimbabwe, Zambia, Mozambique, Malawi |
| Northeast Brazil | Brazil |
| Central America & Caribbean | Guatemala, Honduras, Nicaragua, DR |
| Pacific Islands | Fiji, PNG, Solomon Islands, Vanuatu |

---

## 🚀 Deploy to GitHub Pages in 5 steps

### Step 1 — Create your GitHub repo

1. Go to [github.com/new](https://github.com/new)
2. Name it `elnino-tracker` (or anything you like)
3. Set it to **Public**
4. Click **Create repository**

### Step 2 — Upload this project

**Option A — GitHub web upload (easiest):**
1. Download this project as a ZIP and unzip it
2. On your new repo page, click **"uploading an existing file"**
3. Drag all files in — making sure `.github/` folder is included
4. Commit with message `Initial commit`

**Option B — Git command line:**
```bash
cd elnino-tracker
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/YOUR-USERNAME/elnino-tracker.git
git push -u origin main
```

### Step 3 — Enable GitHub Pages

1. Go to your repo → **Settings** → **Pages** (left sidebar)
2. Under **Source**, select **GitHub Actions**
3. Click **Save**

### Step 4 — Trigger deployment

The GitHub Action runs automatically when you push to `main`. To trigger manually:
1. Go to **Actions** tab in your repo
2. Click **"Deploy El Niño Tracker to GitHub Pages"**
3. Click **"Run workflow"** → **"Run workflow"**

### Step 5 — Visit your live site

After 2–3 minutes, your app will be live at:
```
https://YOUR-USERNAME.github.io/elnino-tracker
```

---

## Local development

```bash
npm install
npm start
```

Opens at `http://localhost:3000`

---

## Data sources

- **El Niño forecasts**: Based on NOAA ENSO outlook and historical ONI patterns
- **Live weather**: [Open-Meteo API](https://open-meteo.com/) — free, no API key required
- **Regional impacts**: WMO seasonal climate outlooks, ICPAC, APCC, IRI forecasts

## Disclaimer

This tool is for **public awareness and education only**. In emergencies, always follow official government and civil defence guidance from your national meteorological service.

---

## Tech stack

- React 18
- React Leaflet (interactive maps)
- Recharts (ONI index chart)
- Open-Meteo API (live weather — no key needed)
- GitHub Actions (CI/CD)
- GitHub Pages (hosting)
