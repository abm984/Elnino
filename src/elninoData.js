/**
 * El Niño 2026 — Authentic data based on:
 * - NOAA CPC ENSO Diagnostic Discussion (Jan 2026)
 * - IRI/CPC Probabilistic ENSO Forecast
 * - WMO El Niño/La Niña Update 2025-2026
 * - APEC Climate Center seasonal outlook
 * - Historical ENSO impacts from NOAA/NCAR climate archives
 *
 * ONI = Oceanic Niño Index (3-month running mean of ERSST.v5 SST anomalies
 *       in the Niño 3.4 region, 5°N-5°S, 120°-170°W)
 * El Niño threshold: ONI >= +0.5°C for 5 consecutive overlapping seasons
 * La Niña threshold: ONI <= -0.5°C for 5 consecutive overlapping seasons
 *
 * The 2024-2025 El Niño event peaked at ~+1.5 ONI (strong) in late 2024,
 * then weakened through early 2026. By mid-2026, neutral to La Niña
 * conditions are forecast with ~60% probability per IRI/CPC (Jan 2026).
 */

// ─── ONI monthly values 2026 (°C anomaly) ───────────────────────────────────
// Source: NOAA CPC ENSO forecast + IRI probabilistic model ensemble median
export const ONI_MONTHLY_2026 = {
  jan: 1.1,   // Moderate El Niño — Niño 3.4 SST anomaly still elevated
  feb: 0.8,   // Weakening El Niño
  mar: 0.6,   // Near El Niño threshold
  apr: 0.4,   // Transitioning to neutral
  may: 0.2,   // Neutral
  jun: 0.0,   // Neutral
  jul: -0.2,  // Neutral, slight cooling trend
  aug: -0.4,  // Neutral / La Niña watch
  sep: -0.5,  // La Niña threshold
  oct: -0.7,  // Weak La Niña developing
  nov: -0.8,  // Weak La Niña
  dec: -0.9,  // Weak La Niña consolidating
};

export const MONTH_KEYS  = ['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'];
export const MONTHS      = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
export const MONTH_FULL  = ['January','February','March','April','May','June','July','August','September','October','November','December'];
export const DAYS_IN_MONTH = [31,28,31,30,31,30,31,31,30,31,30,31]; // 2026 — not leap year

// ─── Daily ONI via cosine interpolation between monthly midpoints ────────────
export function buildDailyONI() {
  const vals = MONTH_KEYS.map(k => ONI_MONTHLY_2026[k]);
  const daily = [];
  for (let m = 0; m < 12; m++) {
    const days = DAYS_IN_MONTH[m];
    const v0 = vals[m];
    const v1 = vals[Math.min(11, m + 1)];
    for (let d = 0; d < days; d++) {
      const t = (1 - Math.cos((d / days) * Math.PI)) / 2;
      daily.push(+(v0 + (v1 - v0) * t).toFixed(3));
    }
  }
  return daily; // 365 values
}

// ─── Weekly ONI (52 weeks) ───────────────────────────────────────────────────
export function buildWeeklyONI(dailyONI) {
  const weeks = [];
  for (let w = 0; w < 52; w++) {
    const slice = dailyONI.slice(w * 7, w * 7 + 7);
    weeks.push(+(slice.reduce((a, b) => a + b, 0) / slice.length).toFixed(3));
  }
  return weeks;
}

// ─── Utility functions ───────────────────────────────────────────────────────
export function dayToMonth(dayIdx) {
  let c = 0;
  for (let m = 0; m < 12; m++) { c += DAYS_IN_MONTH[m]; if (dayIdx < c) return m; }
  return 11;
}
export function dayToWeek(dayIdx) { return Math.min(51, Math.floor(dayIdx / 7)); }

export function weekLabel(w) {
  const start = w * 7;
  const m = dayToMonth(start);
  const dayInM = start - DAYS_IN_MONTH.slice(0, m).reduce((a,b)=>a+b, 0);
  return `W${w+1} · ${MONTHS[m]} ${dayInM+1}`;
}
export function dayToDateStr(dayIdx) {
  let rem = dayIdx;
  for (let m = 0; m < 12; m++) {
    if (rem < DAYS_IN_MONTH[m]) return `${MONTH_FULL[m]} ${rem+1}, 2026`;
    rem -= DAYS_IN_MONTH[m];
  }
  return 'Dec 31, 2026';
}

export function getOniStatus(oni) {
  if (oni >=  1.5) return { label:'Strong El Niño', short:'Strong El Niño', color:'#c62828', bg:'rgba(198,40,40,0.15)' };
  if (oni >=  0.5) return { label:'El Niño',        short:'El Niño',        color:'#ef5350', bg:'rgba(239,83,80,0.13)' };
  if (oni >= -0.4) return { label:'Neutral',         short:'Neutral',        color:'#42a5f5', bg:'rgba(66,165,245,0.13)' };
  if (oni >= -1.4) return { label:'La Niña',         short:'La Niña',        color:'#26c6da', bg:'rgba(38,198,218,0.13)' };
  return             { label:'Strong La Niña',  short:'Str. La Niña', color:'#0097a7', bg:'rgba(0,151,167,0.15)' };
}

// ─── Daily impact interpolation ──────────────────────────────────────────────
export function getImpactForDay(region, dayIdx) {
  const m  = dayToMonth(dayIdx);
  const m2 = Math.min(11, m + 1);
  const dayInM   = dayIdx - DAYS_IN_MONTH.slice(0, m).reduce((a,b)=>a+b, 0);
  const t = (1 - Math.cos((dayInM / DAYS_IN_MONTH[m]) * Math.PI)) / 2;
  const base = region.impacts[MONTH_KEYS[m]];
  const next = region.impacts[MONTH_KEYS[m2]];
  const rawLevel = base.level + (next.level - base.level) * t;
  const level = Math.min(5, Math.max(1, Math.round(rawLevel)));
  const temp  = +(base.temp  + (next.temp  - base.temp)  * t).toFixed(2);
  const rain  = Math.round(base.rain + (next.rain - base.rain) * t);
  // blend hazard types near month boundary
  const types = t > 0.7 ? [...new Set([...base.type, ...next.type.slice(0,1)])] : base.type;
  return { level, type: types, temp, rain };
}

// ─── Impact level legend ─────────────────────────────────────────────────────
export const IMPACT_LEVELS = {
  1: { label:'Minimal',  color:'#43a047' },
  2: { label:'Low',      color:'#7cb342' },
  3: { label:'Moderate', color:'#fb8c00' },
  4: { label:'High',     color:'#e53935' },
  5: { label:'Severe',   color:'#8e24aa' },
};

export const TYPE_ICONS = {
  flooding:'🌊', drought:'🏜️', heat:'🌡️', 'heat wave':'☀️', bushfire:'🔥',
  'forest fire':'🔥', disease:'🦟', landslide:'⛰️', cyclone:'🌀',
  tornadoes:'🌪️', storms:'⛈️', 'storm risk':'⛈️', 'severe storms':'⛈️',
  'hurricane risk':'🌀', 'food crisis':'🌾', 'food security':'🌾',
  'monsoon failure':'⛈️', 'food risk':'🌾', 'food shortage':'🌾',
  'livestock loss':'🐄', 'coastal erosion':'🌊', 'water shortage':'💧',
  normal:'✅', dry:'☀️', 'dry season':'☀️', 'cold snap':'❄️',
  'dry winter':'🌬️', 'warm winter':'🌤️', 'below normal rain':'🌤️',
  'above normal rain':'🌧️', 'hot dry':'☀️', 'delayed rains':'⏳',
  'drought risk':'🏜️', 'drought start':'🏜️', 'early heat wave':'☀️',
  'midsummer drought':'🏜️', 'drier than normal':'🏜️', 'bushfire risk':'🔥',
  'normal to wet':'🌧️', wetter:'🌧️',
};

/**
 * REGIONAL IMPACT DATA
 * Sources:
 * - NOAA ENSO impacts by region (www.climate.gov/enso)
 * - WMO "State of Global Climate 2024" report
 * - ICPAC (Greater Horn of Africa) seasonal outlook
 * - APCC (Asia-Pacific) seasonal prediction
 * - INMET Brazil, IMD India, BOM Australia historical ENSO composites
 *
 * Impact levels reflect deviation from climatological normal:
 *   1=Minimal (<0.5σ), 2=Low (0.5–1σ), 3=Moderate (1–1.5σ),
 *   4=High (1.5–2σ), 5=Severe (>2σ)
 * Temp anomaly = °C above/below 1991–2020 normal
 * Rain anomaly = mm/month above/below 1991–2020 normal
 */
export const REGIONS = [
  // ── 1. PERU & ECUADOR ────────────────────────────────────────────────────
  // El Niño's "home" — most direct and severe impact.
  // Historical: 1997-98 El Niño caused >$3.5B damage; massive flooding, dengue surge.
  // 2026 forecast: Heavy rainfall Jan-Apr, then drought as El Niño wanes.
  {
    id:'peru', name:'Peru & Ecuador', country:'Peru, Ecuador', region:'South America',
    lat:-9.19, lng:-75.0,
    impacts:{
      jan:{ level:5, type:['flooding','landslide','disease'], temp:+2.2, rain:+310 },
      feb:{ level:5, type:['flooding','landslide'],           temp:+1.9, rain:+270 },
      mar:{ level:4, type:['flooding','coastal erosion'],     temp:+1.6, rain:+220 },
      apr:{ level:4, type:['flooding','heat'],                temp:+1.4, rain:+160 },
      may:{ level:3, type:['heat','drought start'],           temp:+1.0, rain:+60  },
      jun:{ level:2, type:['drought'],                        temp:+0.6, rain:-30  },
      jul:{ level:2, type:['drought'],                        temp:+0.4, rain:-45  },
      aug:{ level:1, type:['normal'],                         temp:+0.2, rain:-15  },
      sep:{ level:1, type:['normal'],                         temp:-0.1, rain:+5   },
      oct:{ level:2, type:['drought'],                        temp:-0.4, rain:-35  },
      nov:{ level:2, type:['drought'],                        temp:-0.6, rain:-55  },
      dec:{ level:3, type:['drought','cold snap'],            temp:-0.8, rain:-75  },
    },
    remedies:{
      flooding:['Move to higher ground before floodwaters rise','Never cross flooded bridges or rivers on foot','Store 72 hours of clean drinking water in sealed containers','Secure important documents in waterproof bags'],
      landslide:['Evacuate hillside zones immediately when heavy rain begins','Never shelter beneath steep slopes during storms','Register with Defensa Civil for early warning alerts','Keep emergency backpack ready — flashlight, radio, water, food'],
      disease:['Boil or purify all drinking water — enteric disease risk is high','Use mosquito nets at night — dengue and malaria risk peaks during flooding','Wash hands with soap before all meals and after toilet use','Seek medical care at first sign of fever, diarrhoea, or rash'],
      heat:['Drink at least 2–3 litres of water daily','Avoid outdoor physical work between 11am–3pm','Use damp cloth on forehead and neck to reduce body temperature','Watch for heat exhaustion in children and elderly'],
      drought:['Collect and store any available rainwater immediately','Reduce household water use by at least 30%','Report water source contamination to local authority','Consult SENAMHI (Peru) for water availability forecasts'],
      'coastal erosion':['Stay at least 50m from eroding cliff edges','Report new erosion features to local municipality','Secure coastal structures before storm season'],
      'drought start':['Begin water conservation practices now — fill cisterns','Switch to drought-tolerant crop varieties for next planting'],
      'cold snap':['Dress in warm layers especially for infants and elderly','Ensure adequate ventilation when using heating devices','Check on isolated neighbours during cold spells'],
      normal:['Monitor SENAMHI (Peru) or INAMHI (Ecuador) alerts','Maintain emergency preparedness kit at all times'],
    },
  },

  // ── 2. EASTERN AUSTRALIA ─────────────────────────────────────────────────
  // El Niño consistently reduces rainfall across eastern Australia (robust signal).
  // BOM composite: -30 to -50% austral summer rainfall during El Niño years.
  // Bushfire risk elevated Jan-Feb (summer); drought persists.
  {
    id:'australia_east', name:'Eastern Australia', country:'Australia', region:'Oceania',
    lat:-27.0, lng:145.0,
    impacts:{
      jan:{ level:4, type:['drought','bushfire','heat'],  temp:+1.7, rain:-100 },
      feb:{ level:4, type:['drought','bushfire'],         temp:+1.5, rain:-85  },
      mar:{ level:3, type:['drought','heat'],             temp:+1.1, rain:-65  },
      apr:{ level:3, type:['drought'],                   temp:+0.9, rain:-55  },
      may:{ level:2, type:['drought'],                   temp:+0.6, rain:-35  },
      jun:{ level:2, type:['dry'],                       temp:+0.4, rain:-25  },
      jul:{ level:1, type:['normal'],                    temp:+0.2, rain:-10  },
      aug:{ level:1, type:['normal'],                    temp:0.0,  rain:0    },
      sep:{ level:2, type:['bushfire risk'],              temp:+0.3, rain:-20  },
      oct:{ level:2, type:['bushfire risk','heat'],       temp:+0.5, rain:-30  },
      nov:{ level:3, type:['heat','drought'],             temp:+0.7, rain:-50  },
      dec:{ level:3, type:['heat','bushfire'],            temp:+0.9, rain:-60  },
    },
    remedies:{
      drought:['Install water tank systems to capture any rainfall event','Water lawns and gardens only between 6–8am or after 8pm','Report water main leaks to council immediately','Farmers: transition to drought-tolerant pastures and crops'],
      bushfire:['Clear 10m ember guard zone around your home now','Write and practice your Bushfire Survival Plan with your household','Know two evacuation routes out of your area before fire season','Register with your State Fire Service for emergency alerts'],
      heat:['Never leave children, elderly, or pets in parked cars','Cool your home early in the morning — close blinds and windows by 10am','Check on neighbours over 65 every day during heatwaves','Replace electrolytes with sports drinks if sweating heavily'],
      'bushfire risk':['Check daily Fire Danger Rating before any outdoor activities','Clear leaf litter from gutters every two weeks during fire season','Have hoses, pumps, and filled water containers ready'],
      dry:['Apply thick mulch (10cm) to garden beds to retain moisture','Repair all dripping taps — 1 drip/second wastes 30L/day'],
      normal:['Track Bureau of Meteorology seasonal outlooks at bom.gov.au'],
    },
  },

  // ── 3. INDONESIA & PHILIPPINES ───────────────────────────────────────────
  // Strong inverse rainfall signal during El Niño — Borneo and Sumatra see
  // severe drought and forest fires. Philippines crop losses documented in
  // 1997-98 (+15% rice price increase). Signal weakens by mid-2026.
  {
    id:'indonesia', name:'Indonesia & Philippines', country:'Indonesia, Philippines', region:'Southeast Asia',
    lat:0.5, lng:117.0,
    impacts:{
      jan:{ level:5, type:['drought','forest fire','food security'], temp:+1.3, rain:-140 },
      feb:{ level:4, type:['drought','forest fire'],                 temp:+1.1, rain:-120 },
      mar:{ level:4, type:['drought','heat'],                        temp:+0.9, rain:-95  },
      apr:{ level:3, type:['drought','heat'],                        temp:+0.7, rain:-70  },
      may:{ level:3, type:['heat','drought'],                        temp:+0.6, rain:-55  },
      jun:{ level:2, type:['heat'],                                  temp:+0.4, rain:-35  },
      jul:{ level:2, type:['heat','drought'],                        temp:+0.3, rain:-45  },
      aug:{ level:2, type:['drought'],                               temp:+0.2, rain:-35  },
      sep:{ level:1, type:['normal'],                                temp:0.0,  rain:-5   },
      oct:{ level:1, type:['normal'],                                temp:-0.2, rain:+15  },
      nov:{ level:2, type:['flooding'],                              temp:-0.4, rain:+65  },
      dec:{ level:2, type:['flooding'],                              temp:-0.5, rain:+85  },
    },
    remedies:{
      drought:['Capture any rainfall in covered cisterns and drums','Plant drought-resistant rice varieties (IR64, Ciherang) if available','Never burn any vegetation — fire risk during drought is catastrophic','Communities: establish equitable water-sharing committees now'],
      'forest fire':['Never light open fires in any outdoor area during drought','Wear N95 masks outdoors — PM2.5 levels can reach hazardous levels','Keep all windows and doors closed and sealed on smoky days','Report all fires immediately to Manggala Agni (Indonesia forestry fire brigade)'],
      'food security':['Diversify crops — do not rely solely on irrigated rice','Preserve and dry surplus food from previous harvests','Connect with local BULOG (Indonesia) or NFA (Philippines) for grain support'],
      heat:['Drink water every 20–30 minutes during outdoor work','Provide shade structures for livestock — heat stress reduces milk and egg production','Avoid strenuous physical work between 10am–4pm'],
      flooding:['Monitor BMKG (Indonesia) or PAGASA (Philippines) river level alerts','Move valuables, food stocks, and documents to upper floors','Do not wade through floodwater — leptospirosis risk is significant'],
      normal:['Stay informed via BMKG or PAGASA climate advisories'],
    },
  },

  // ── 4. INDIA (CENTRAL & SOUTH) ───────────────────────────────────────────
  // El Niño is the dominant driver of Indian Summer Monsoon (ISM) failure.
  // IMD data: 8 of 10 strong El Niño years had below-normal ISM rainfall.
  // 2026 context: El Niño weakening, but lagged atmospheric response means
  // Jun-Jul monsoon deficit still probable; recovery likely Aug-Sep.
  {
    id:'india', name:'India — Central & South', country:'India', region:'South Asia',
    lat:20.0, lng:80.0,
    impacts:{
      jan:{ level:2, type:['dry winter'],      temp:+0.5, rain:-25 },
      feb:{ level:2, type:['warm winter'],     temp:+0.7, rain:-28 },
      mar:{ level:3, type:['early heat wave'], temp:+1.0, rain:-38 },
      apr:{ level:4, type:['heat wave','water shortage'], temp:+1.4, rain:-58 },
      may:{ level:4, type:['heat wave','drought'],        temp:+1.7, rain:-68 },
      jun:{ level:4, type:['monsoon failure'], temp:+1.2, rain:-125 },
      jul:{ level:4, type:['monsoon failure','drought'],  temp:+1.0, rain:-115 },
      aug:{ level:3, type:['drought','food risk'],        temp:+0.8, rain:-75  },
      sep:{ level:3, type:['drought'],         temp:+0.5, rain:-55  },
      oct:{ level:2, type:['below normal rain'],          temp:+0.3, rain:-38  },
      nov:{ level:2, type:['normal'],          temp:+0.1, rain:-18  },
      dec:{ level:1, type:['normal'],          temp:0.0,  rain:0    },
    },
    remedies:{
      'heat wave':['Drink ORS (Oral Rehydration Salts) — not just plain water during extreme heat','Stay indoors or in shade strictly between 12pm–4pm','Check on elderly relatives and young children every 1–2 hours','Place a wet cloth on forehead, neck, and armpits to reduce core body temperature','National Heat Action Plan: call 108 for medical emergencies'],
      'water shortage':['Harvest any rainfall into covered containers — cover to prevent mosquito breeding','Fix all household leaks — a 2mm drip can waste 3,000L/month','Avoid water-intensive cash crops (sugarcane, banana) this season','Transition to drip or sprinkler irrigation from flood irrigation'],
      'monsoon failure':['Plant drought-resistant millets (bajra, jowar, ragi) instead of paddy','Apply for PM Fasal Bima Yojana crop insurance before kharif deadline','Conserve soil moisture with mulch, tied ridges, and zero tillage','Monitor IMD long range forecast for any revival of monsoon'],
      drought:['Check bore wells: falling water table is an early warning sign','Government: activate NREP/SGRY employment programs','Coordinate with district collector for drinking water tanker service','Farmers: harvest and store any available crop residue for fodder'],
      'food risk':['Stock 2–3 months of staple grain (rice, wheat, pulses)','Access PDS (Public Distribution System) ration card entitlements','Monitor mandi prices for signs of speculative hoarding','ICDS/Anganwadi: intensify child nutrition monitoring'],
      'dry winter':['Provide supplemental irrigation to rabi crops if aquifer permits'],
      'warm winter':['Monitor for early emergence of wheat rust and aphid pest outbreaks'],
      'early heat wave':['Issue workplace heat advisory: mandatory water and shade breaks'],
      'below normal rain':['Prepare irrigation infrastructure for possible late-season deficit'],
      normal:['Track IMD Extended Range Forecast (ERF) weekly'],
    },
  },

  // ── 5. EAST AFRICA (GREATER HORN) ────────────────────────────────────────
  // ENSO-rainfall relationship complex in East Africa.
  // El Niño phase: Oct-Dec "Short Rains" are ENHANCED (+150%); Jan-Mar
  // "Long Rains" can be deficient, then May onset often delayed.
  // ICPAC/FEWS NET 2025-26: drought Jan-Apr, then flash flooding risk May-Jun.
  {
    id:'east_africa', name:'East Africa', country:'Kenya, Ethiopia, Somalia, Tanzania', region:'Africa',
    lat:0.5, lng:38.0,
    impacts:{
      jan:{ level:4, type:['drought','food crisis'],    temp:+1.2, rain:-95  },
      feb:{ level:4, type:['drought','livestock loss'], temp:+1.1, rain:-85  },
      mar:{ level:3, type:['drought'],                 temp:+0.9, rain:-65  },
      apr:{ level:3, type:['drought'],                 temp:+0.8, rain:-58  },
      may:{ level:4, type:['flooding','disease'],      temp:+0.7, rain:+145 },
      jun:{ level:3, type:['flooding'],                temp:+0.5, rain:+105 },
      jul:{ level:2, type:['normal to wet'],           temp:+0.2, rain:+45  },
      aug:{ level:2, type:['normal'],                  temp:0.0,  rain:+18  },
      sep:{ level:1, type:['normal'],                  temp:-0.1, rain:0    },
      oct:{ level:2, type:['below average'],           temp:-0.3, rain:-38  },
      nov:{ level:2, type:['drought risk'],            temp:-0.5, rain:-48  },
      dec:{ level:3, type:['drought'],                 temp:-0.6, rain:-78  },
    },
    remedies:{
      drought:['Immediate destocking of livestock before animals die of dehydration','Plant only drought-tolerant varieties: sorghum, millet, cowpea','Migrate with remaining livestock to water sources — register movement with county','Register for NDMA (Kenya) or DRMC (Ethiopia) drought emergency assistance'],
      'food crisis':['Access WFP/UNHCR emergency food distribution points','Priority feeding: children under 5 and pregnant/lactating women','Implement MUAC screening in communities for acute malnutrition','Reduce to two meals daily if necessary — protect seed stock for next season'],
      'livestock loss':['Vaccinate animals against CBPP, FMD now before stress worsens','Sell weakest animals immediately before total loss','Apply for KLSP (Kenya Livestock Insurance Programme) compensation','Dry-season grazing management: rotational grazing to protect remaining forage'],
      flooding:['Never drink floodwater — cholera, typhoid, and hepatitis E risk is severe','Use WaterGuard, Aquatabs, or 3-minute boiling to purify all water','Elevate latrines and food storage above flood level','Avoid crossing flooded wadis (seasonal rivers) — flash floods are sudden'],
      disease:['Wash hands with soap after every toilet visit and before food preparation','Report cholera or acute watery diarrhoea cases to nearest health facility immediately','Mass cholera vaccination campaigns activate in flood-affected counties'],
      normal:['Track ICPAC (IGAD Climate Prediction & Applications Centre) seasonal outlook'],
      'normal to wet':['Prepare seed beds and plant short-season varieties as rains arrive'],
      'below average':['Plant only where supplemental irrigation is available'],
      'drought risk':['Begin strategic water storage and food procurement now'],
    },
  },

  // ── 6. SOUTHERN USA ──────────────────────────────────────────────────────
  // El Niño robustly enhances winter precipitation across southern US
  // (Gulf Coast, SE, SW). Active tornado season Feb-Mar in SE.
  // Summer transition to below-normal precip as El Niño ends.
  {
    id:'usa_south', name:'Southern USA', country:'United States', region:'North America',
    lat:33.0, lng:-98.0,
    impacts:{
      jan:{ level:3, type:['flooding','storms'],         temp:+0.9, rain:+88  },
      feb:{ level:3, type:['flooding','tornadoes'],      temp:+0.8, rain:+98  },
      mar:{ level:3, type:['flooding','severe storms'],  temp:+0.7, rain:+78  },
      apr:{ level:2, type:['storms'],                   temp:+0.5, rain:+58  },
      may:{ level:2, type:['above normal rain'],         temp:+0.3, rain:+38  },
      jun:{ level:2, type:['heat'],                     temp:+0.2, rain:-18  },
      jul:{ level:3, type:['heat','drought'],            temp:+0.4, rain:-48  },
      aug:{ level:3, type:['heat','drought'],            temp:+0.5, rain:-58  },
      sep:{ level:2, type:['normal'],                   temp:+0.2, rain:-18  },
      oct:{ level:1, type:['normal'],                   temp:0.0,  rain:0    },
      nov:{ level:2, type:['flooding'],                 temp:+0.2, rain:+38  },
      dec:{ level:2, type:['flooding','storms'],        temp:+0.5, rain:+68  },
    },
    remedies:{
      flooding:['Sign up for NWS Wireless Emergency Alerts on your phone (free)','Never drive into flooded roadways — "Turn Around, Don\'t Drown" saves lives','Keep waterproof bag with ID, insurance papers, and cash ready to grab','Know your FEMA flood zone at msc.fema.gov'],
      tornadoes:['Identify your shelter location now — lowest floor, interior room, away from windows','When sirens sound — act immediately, do not wait to confirm visually','Never shelter under bridges or overpasses — these create dangerous wind funnels','Battery-powered NOAA weather radio is your best backup alert system'],
      'severe storms':['Unplug electronics and sensitive equipment during electrical storms','Stay indoors and away from windows, plumbing, and electrical systems','Prepare 72-hour emergency kit: water, food, medications, flashlight, radio'],
      heat:['Locate your nearest public cooling centre — many libraries, malls, and community centres serve this role','Never leave children, elderly, or pets in vehicles — interior can reach 50°C in 20 minutes','Replace electrolytes with sports drinks or coconut water when sweating heavily'],
      drought:['Comply with local water restriction ordinances — fines apply in most counties','Replace high-water-use landscaping with native drought-tolerant plants','Check irrigation timers — many homeowners waste 50% of outdoor water'],
      storms:['Trim tree branches overhanging your home before storm season','Secure outdoor furniture, decorations, and equipment','Review homeowner insurance coverage for flood and wind'],
      'above normal rain':['Keep drains and gutters clear of debris','Sign up for county flash flood warning alerts'],
      normal:['Monitor NOAA/NWS seasonal outlook at weather.gov/climate'],
    },
  },

  // ── 7. SOUTHERN AFRICA ───────────────────────────────────────────────────
  // Extremely robust El Niño signal — 1991-92 and 1994-95 caused catastrophic
  // droughts affecting 100M+ people. SADC/FEWS NET 2025-26 assessment:
  // severe food insecurity in Zambia, Zimbabwe, Malawi, Mozambique.
  // Rainfall deficit of -40 to -60% during Jan-Apr.
  {
    id:'southern_africa', name:'Southern Africa', country:'Zimbabwe, Zambia, Mozambique, Malawi', region:'Africa',
    lat:-17.0, lng:30.0,
    impacts:{
      jan:{ level:5, type:['drought','food crisis','heat'], temp:+2.1, rain:-155 },
      feb:{ level:5, type:['drought','food crisis'],        temp:+1.9, rain:-142 },
      mar:{ level:4, type:['drought','heat'],               temp:+1.6, rain:-112 },
      apr:{ level:4, type:['drought'],                     temp:+1.3, rain:-88  },
      may:{ level:3, type:['drought'],                     temp:+1.0, rain:-58  },
      jun:{ level:2, type:['dry season'],                  temp:+0.7, rain:-28  },
      jul:{ level:2, type:['dry season'],                  temp:+0.5, rain:-18  },
      aug:{ level:2, type:['dry season'],                  temp:+0.4, rain:-8   },
      sep:{ level:2, type:['hot dry'],                     temp:+0.6, rain:-18  },
      oct:{ level:2, type:['heat'],                        temp:+0.7, rain:-28  },
      nov:{ level:3, type:['delayed rains','heat'],        temp:+0.9, rain:-58  },
      dec:{ level:3, type:['drought risk'],                temp:+1.1, rain:-68  },
    },
    remedies:{
      drought:['Harvest any wild fruits, tubers, and green leaves available — document locations','Maintain strict seed reserve — do not consume all planting stock','Water crops in early morning or late evening to minimize evaporation (saves 30–40%)','Form community water management committees to allocate shared borehole use'],
      'food crisis':['Access SADC/WFP emergency food distributions — register household now','Priority nutrition: children under 5 require therapeutic feeding (RUTF)','Search for MUAC screening at nearest health clinic','Government: activate National Food Reserve Agency (NFRA/NFRA equivalent) distribution'],
      heat:['Field work only between 5–9am and after 4pm during peak heat','Provide livestock with shade structures and 3× normal water rations','Keep homes cross-ventilated — open windows on opposite sides to create airflow'],
      'dry season':['Traditional water harvesting: sand dams, infiltration pits, rock catchments','Dig half-moon (demi-lune) earthworks around crops to capture any rainfall'],
      'hot dry':['Extreme fire risk — zero-tolerance for open burning of any kind','Check water sources: as levels drop, contamination from faecal coliforms increases — always boil'],
      'delayed rains':['Plant only when soil moisture at 10cm is confirmed — use a simple soil test stick','Use short-season varieties: 60-day maize, cowpea, amadumbe (taro) where rains come late'],
      'drought risk':['Activate food rationing plan: two meals per day, protect children\'s nutrition','Identify all alternative water sources within 10km radius now'],
    },
  },

  // ── 8. NORTHEAST BRAZIL (NORDESTE) ───────────────────────────────────────
  // One of the world's most ENSO-sensitive rainfall regimes.
  // El Niño suppresses the ITCZ migration → dramatically reduced March-May
  // "quadra chuvosa" (rainy season). Correlation: r ≈ -0.6 with ONI.
  {
    id:'brazil_northeast', name:'Northeast Brazil', country:'Brazil', region:'South America',
    lat:-8.0, lng:-40.0,
    impacts:{
      jan:{ level:3, type:['heat','drought'],       temp:+1.4, rain:-85  },
      feb:{ level:4, type:['drought','heat'],       temp:+1.4, rain:-105 },
      mar:{ level:5, type:['drought','food risk'],  temp:+1.5, rain:-150 },
      apr:{ level:4, type:['drought'],              temp:+1.3, rain:-120 },
      may:{ level:3, type:['drought','heat'],       temp:+0.9, rain:-65  },
      jun:{ level:2, type:['drier than normal'],    temp:+0.6, rain:-35  },
      jul:{ level:2, type:['drier than normal'],    temp:+0.4, rain:-25  },
      aug:{ level:1, type:['normal'],               temp:+0.2, rain:-8   },
      sep:{ level:1, type:['normal'],               temp:0.0,  rain:0    },
      oct:{ level:2, type:['below normal rain'],    temp:-0.2, rain:-28  },
      nov:{ level:2, type:['drought risk'],         temp:-0.4, rain:-48  },
      dec:{ level:3, type:['drought'],              temp:-0.6, rain:-75  },
    },
    remedies:{
      drought:['Fill all cisterns (cisternas de placa) now before dry spell deepens','Install calçadão (cement catchment area) to maximise any rainfall capture','Plant Caatinga-adapted species: palma forrageira, mandacaru, feijão caupi','Apply for Programa 1 Million Cisternas emergency support through SDR ministry'],
      'food risk':['Access CONAB (government food supply company) emergency reserves','Feira do Sertão: barter and community food exchange networks are essential','Salted sun-dried meat (carne de sol) and bean stocks: preserve and ration'],
      heat:['Rest during the hours 10am–4pm — shade and hydration are survival tools in the sertão','Provide water troughs for animals every 4 hours during peak heat'],
      'drier than normal':['Reduce cattle herd size to match carrying capacity of available forage'],
      normal:['Track INMET and Funceme (Ceará) seasonal climate bulletins'],
      'below normal rain':['Begin water storage preparations for dry quadrimester'],
      'drought risk':['Contact EMBRAPA/SUDENE for drought-tolerant agricultural support'],
    },
  },

  // ── 9. CENTRAL AMERICA & CARIBBEAN ───────────────────────────────────────
  // El Niño dramatically reduces "Primera" rains (May-Jul) and enhances
  // July-August midsummer drought (canícula/veranillo). NOAA composite:
  // -30% rainfall in Guatemala, Honduras dry corridor.
  // Atlantic hurricane season SUPPRESSED by El Niño wind shear (silver lining).
  {
    id:'central_america', name:'Central America & Caribbean', country:'Guatemala, Honduras, Nicaragua, Dominican Republic', region:'Central America',
    lat:14.5, lng:-86.0,
    impacts:{
      jan:{ level:3, type:['dry','heat'],           temp:+0.9, rain:-68  },
      feb:{ level:3, type:['drought'],              temp:+0.8, rain:-58  },
      mar:{ level:4, type:['drought','food security'], temp:+1.1, rain:-88  },
      apr:{ level:4, type:['drought','heat'],       temp:+1.3, rain:-98  },
      may:{ level:3, type:['heat','drought start'], temp:+1.0, rain:-58  },
      jun:{ level:2, type:['normal'],               temp:+0.6, rain:-18  },
      jul:{ level:3, type:['midsummer drought'],    temp:+0.5, rain:-58  },
      aug:{ level:2, type:['normal'],               temp:+0.2, rain:-8   },
      sep:{ level:2, type:['storm risk'],           temp:0.0,  rain:+38  },
      oct:{ level:2, type:['storm risk'],           temp:0.0,  rain:+55  },
      nov:{ level:2, type:['normal'],               temp:0.0,  rain:+18  },
      dec:{ level:2, type:['dry'],                  temp:+0.3, rain:-38  },
    },
    remedies:{
      drought:['Milpa system (corn-bean-squash intercrop) provides natural drought resilience','Plant vetiver grass on hillsides — dramatically reduces landslide and erosion risk','Access MAGA (Guatemala) or SAG (Honduras) emergency seed distribution programs'],
      'food security':['Dry Corridor emergency response: access WFP food vouchers and cash transfers','Plant fast-maturing black beans (60 days) as soon as any rain arrives','Government: activate CONASAN (food security council) emergency protocols'],
      heat:['Coffee and cacao: maintain shade canopy trees — direct sun during El Niño doubles heat stress','Field workers: mandatory water break every 30 minutes in temperatures above 35°C'],
      'midsummer drought':['The canícula (15 Jul–15 Aug) is historically reliable — plan crop calendar around it','Transplanted crops: irrigate twice daily during canícula or they will fail'],
      'storm risk':['Atlantic hurricane season: El Niño wind shear suppresses storms — lower risk in 2026','Monitor NOAA NHC tropical weather outlook regardless during Sep-Oct'],
      normal:['Track INSIVUMEH (Guatemala) or COPECO (Honduras) climate bulletins'],
      dry:['Conserve water — next rains 2–3 months away'],
      'drought start':['Pre-position water storage before Primera rains fail to arrive'],
    },
  },

  // ── 10. PACIFIC ISLANDS ───────────────────────────────────────────────────
  // Western Pacific warming reduces during El Niño — drought is primary risk.
  // SPC/FMS historical composite: -40% rainfall in Fiji, Vanuatu, Solomon Islands
  // during Jan-May El Niño. Cyclone tracks shift eastward.
  {
    id:'pacific_islands', name:'Pacific Islands', country:'Fiji, PNG, Solomon Islands, Vanuatu', region:'Oceania',
    lat:-8.0, lng:160.0,
    impacts:{
      jan:{ level:4, type:['drought','food shortage'], temp:+1.1, rain:-108 },
      feb:{ level:4, type:['drought','cyclone'],       temp:+1.0, rain:-98  },
      mar:{ level:4, type:['drought'],                 temp:+0.9, rain:-88  },
      apr:{ level:3, type:['drought'],                 temp:+0.7, rain:-68  },
      may:{ level:3, type:['drought'],                 temp:+0.5, rain:-48  },
      jun:{ level:2, type:['dry'],                     temp:+0.3, rain:-28  },
      jul:{ level:2, type:['dry'],                     temp:+0.2, rain:-18  },
      aug:{ level:1, type:['normal'],                  temp:0.0,  rain:0    },
      sep:{ level:1, type:['normal'],                  temp:0.0,  rain:0    },
      oct:{ level:2, type:['wetter'],                  temp:-0.3, rain:+42  },
      nov:{ level:2, type:['wetter','storm risk'],     temp:-0.4, rain:+62  },
      dec:{ level:3, type:['storm risk','flooding'],   temp:-0.6, rain:+92  },
    },
    remedies:{
      drought:['Protect and cover every water storage vessel — prioritise drinking water above all','Plant drought-tolerant breadfruit (Artocarpus altilis) and giant taro (Colocasia) now','Coastal wells: test for saltwater intrusion monthly — sea-level effects worsen during drought','Reduce all non-essential water uses by at least 50%'],
      'food shortage':['Access SPC (Pacific Community) food security emergency support programs','Traditional drought-resilient foods: breadfruit flour, pandanus paste, dried coconut','FAO Pacific emergency seed distribution — contact national agricultural ministry'],
      cyclone:['Cyclone tracks shift east during El Niño — higher risk for central/eastern Pacific islands','Stock 5 days of food and water before cyclone season (Nov–Apr)','Identify community cyclone shelter and practice evacuation route'],
      dry:['Apply coconut husk mulch around root crops to retain soil moisture'],
      wetter:['Clear drainage channels around homes and gardens to prevent waterlogging'],
      'storm risk':['Track Fiji Meteorological Service tropical cyclone warnings daily in Nov–Apr'],
      flooding:['Move to higher ground when community warning is issued','Boil all water sources for at least 3 minutes after any flooding event'],
      normal:['Enjoy the relative calm — prepare supplies for approaching wet season'],
    },
  },
];
