// El Niño 2026 — Regional impact data, monthly forecasts, and remedies
// ONI values interpolated daily between monthly anchor points

export const ONI_MONTHLY_2026 = {
  jan: 1.4, feb: 1.2, mar: 1.0, apr: 0.9, may: 0.7,
  jun: 0.5, jul: 0.3, aug: 0.1, sep: -0.1, oct: -0.3,
  nov: -0.5, dec: -0.6,
};

export const MONTH_KEYS = ['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'];
export const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
export const MONTH_FULL = ['January','February','March','April','May','June','July','August','September','October','November','December'];

// Days per month in 2026 (not a leap year)
export const DAYS_IN_MONTH = [31,28,31,30,31,30,31,31,30,31,30,31];

// Build daily ONI array for all 365 days using cubic interpolation between monthly midpoints
export function buildDailyONI() {
  const monthlyVals = MONTH_KEYS.map(k => ONI_MONTHLY_2026[k]);
  const daily = [];
  let dayOfYear = 0;
  for (let m = 0; m < 12; m++) {
    const days = DAYS_IN_MONTH[m];
    for (let d = 0; d < days; d++) {
      // Simple cosine interpolation between current and next month
      const t = d / days;
      const v0 = monthlyVals[m];
      const v1 = monthlyVals[Math.min(11, m + 1)];
      const smoothT = (1 - Math.cos(t * Math.PI)) / 2;
      daily.push(+(v0 + (v1 - v0) * smoothT).toFixed(3));
      dayOfYear++;
    }
  }
  return daily; // 365 values
}

// Build weekly array (52 weeks)
export function buildWeeklyONI(dailyONI) {
  const weeks = [];
  for (let w = 0; w < 52; w++) {
    const start = w * 7;
    const slice = dailyONI.slice(start, start + 7);
    const avg = slice.reduce((a, b) => a + b, 0) / slice.length;
    weeks.push(+avg.toFixed(3));
  }
  return weeks;
}

// Get month index from day of year (0-based)
export function dayToMonth(dayIdx) {
  let count = 0;
  for (let m = 0; m < 12; m++) {
    count += DAYS_IN_MONTH[m];
    if (dayIdx < count) return m;
  }
  return 11;
}

// Get week index from day of year
export function dayToWeek(dayIdx) { return Math.min(51, Math.floor(dayIdx / 7)); }

// Get week label
export function weekLabel(weekIdx) {
  const dayStart = weekIdx * 7;
  const m = dayToMonth(dayStart);
  const dayInMonth = dayStart - DAYS_IN_MONTH.slice(0, m).reduce((a, b) => a + b, 0);
  return `W${weekIdx + 1} ${MONTHS[m]} ${dayInMonth + 1}`;
}

// Get date string from day index
export function dayToDateStr(dayIdx) {
  let remaining = dayIdx;
  for (let m = 0; m < 12; m++) {
    if (remaining < DAYS_IN_MONTH[m]) {
      return `${MONTHS[m]} ${remaining + 1}, 2026`;
    }
    remaining -= DAYS_IN_MONTH[m];
  }
  return 'Dec 31, 2026';
}

export function getOniStatus(oni) {
  if (oni >= 1.5) return { label: 'Strong El Niño', color: '#9C27B0', bg: '#2d1535' };
  if (oni >= 0.5) return { label: 'El Niño', color: '#F44336', bg: '#2d1010' };
  if (oni >= -0.4) return { label: 'Neutral', color: '#2196F3', bg: '#0d1e35' };
  if (oni >= -1.4) return { label: 'La Niña', color: '#00BCD4', bg: '#002830' };
  return { label: 'Strong La Niña', color: '#0097A7', bg: '#001a1e' };
}

// Impact levels with daily variation — adds subtle sinusoidal noise per region
export function getImpactForDay(region, dayIdx) {
  const m = dayToMonth(dayIdx);
  const mk = MONTH_KEYS[m];
  const base = region.impacts[mk];
  
  // Day within month
  const dayInMonth = dayIdx - DAYS_IN_MONTH.slice(0, m).reduce((a, b) => a + b, 0);
  const daysInM = DAYS_IN_MONTH[m];
  
  // Interpolate toward next month's values near end of month
  const nextM = Math.min(11, m + 1);
  const nextMk = MONTH_KEYS[nextM];
  const next = region.impacts[nextMk];
  const t = dayInMonth / daysInM;
  const smooth = (1 - Math.cos(t * Math.PI)) / 2;
  
  // Regional seed for deterministic daily variation
  const seed = (region.id.charCodeAt(0) + dayIdx) % 7;
  const noise = (seed - 3) * 0.04;
  
  const interpTemp = +(base.temp + (next.temp - base.temp) * smooth + noise).toFixed(2);
  const interpRain = Math.round(base.rain + (next.rain - base.rain) * smooth + seed * 2);
  
  // Level transitions smoothly
  const levelSmooth = base.level + (next.level - base.level) * smooth;
  const level = Math.min(5, Math.max(1, Math.round(levelSmooth)));
  
  // Near end of month, start blending in next month's hazard types
  const types = t > 0.75 ? [...new Set([...base.type, ...next.type.slice(0, 1)])] : base.type;
  
  return { level, type: types, temp: interpTemp, rain: interpRain };
}

export const IMPACT_LEVELS = {
  1: { label: 'Minimal', color: '#4CAF50', bg: '#1a2e1a' },
  2: { label: 'Low', color: '#8BC34A', bg: '#1e2a14' },
  3: { label: 'Moderate', color: '#FF9800', bg: '#2d1f00' },
  4: { label: 'High', color: '#F44336', bg: '#2d1010' },
  5: { label: 'Severe', color: '#9C27B0', bg: '#2d1535' },
};

export const TYPE_ICONS = {
  flooding: '🌊', drought: '🏜️', heat: '🌡️', 'heat wave': '☀️',
  bushfire: '🔥', 'forest fire': '🔥', disease: '🦟', landslide: '⛰️',
  cyclone: '🌀', tornado: '🌪️', tornadoes: '🌪️', 'food crisis': '🌾',
  'food security': '🌾', 'monsoon failure': '⛈️', 'food risk': '🌾',
  'food shortage': '🌾', 'livestock loss': '🐄', 'coastal erosion': '🌊',
  storms: '⛈️', 'storm risk': '⛈️', 'severe storms': '⛈️',
  'hurricane risk': '🌀', 'water shortage': '💧', normal: '✅',
  dry: '☀️', 'dry season': '☀️', 'cold snap': '❄️', 'dry winter': '🌬️',
  'warm winter': '🌤️', 'below normal rain': '🌤️', 'above normal rain': '🌧️',
  'below average': '📉', 'hot dry': '☀️', 'delayed rains': '⏳',
  'drought risk': '🏜️', 'drought start': '🏜️', 'early heat wave': '☀️',
  'midsummer drought': '🏜️', 'drier than normal': '🏜️', 'bushfire risk': '🔥',
  'normal to wet': '🌧️', wetter: '🌧️', 'drought risk': '🏜️',
  'storm risk': '⛈️',
};

export const REGIONS = [
  {
    id: 'peru', name: 'Peru & Ecuador', country: 'Peru, Ecuador', region: 'South America',
    lat: -9.19, lng: -75.0,
    impacts: {
      jan: { level: 5, type: ['flooding','landslide','disease'], temp: +2.1, rain: +320 },
      feb: { level: 5, type: ['flooding','landslide'], temp: +1.9, rain: +280 },
      mar: { level: 5, type: ['flooding','coastal erosion'], temp: +1.8, rain: +260 },
      apr: { level: 4, type: ['flooding','heat'], temp: +1.5, rain: +180 },
      may: { level: 3, type: ['heat','drought start'], temp: +1.2, rain: +80 },
      jun: { level: 2, type: ['drought'], temp: +0.8, rain: -40 },
      jul: { level: 2, type: ['drought'], temp: +0.6, rain: -50 },
      aug: { level: 1, type: ['normal'], temp: +0.3, rain: -20 },
      sep: { level: 1, type: ['normal'], temp: 0, rain: 0 },
      oct: { level: 2, type: ['drought'], temp: -0.2, rain: -30 },
      nov: { level: 2, type: ['drought'], temp: -0.4, rain: -60 },
      dec: { level: 3, type: ['drought','cold snap'], temp: -0.6, rain: -80 },
    },
    remedies: {
      flooding: ['Move to higher ground immediately','Avoid river banks and flood plains','Store 3 days of clean water','Watch for mudslides on steep slopes'],
      drought: ['Collect and store rainwater','Plant drought-resistant crops','Reduce water usage by 30%','Check on elderly neighbours'],
      heat: ['Stay hydrated — drink 2–3 litres daily','Avoid outdoor work 11am–3pm','Use wet cloths to cool down','Watch for heat exhaustion signs'],
      landslide: ['Evacuate slopes when heavy rain starts','Never shelter under hillsides','Keep emergency bag ready','Follow local civil defence alerts'],
      disease: ['Boil all drinking water','Use mosquito nets — dengue risk rises','Wash hands frequently','Visit health centre at first fever sign'],
      'cold snap': ['Wear layered clothing outdoors','Keep newborns and elderly warm','Check heating before cold arrives'],
      'drought start': ['Begin water conservation now','Monitor river levels weekly'],
      'coastal erosion': ['Stay away from unstable cliff edges','Report new erosion to authorities'],
      normal: ['Stay informed via local weather service','Prepare emergency kit as precaution'],
    },
  },
  {
    id: 'australia_east', name: 'Eastern Australia', country: 'Australia', region: 'Oceania',
    lat: -27.0, lng: 145.0,
    impacts: {
      jan: { level: 4, type: ['drought','bushfire','heat'], temp: +1.8, rain: -110 },
      feb: { level: 4, type: ['drought','bushfire'], temp: +1.6, rain: -90 },
      mar: { level: 3, type: ['drought','heat'], temp: +1.2, rain: -70 },
      apr: { level: 3, type: ['drought'], temp: +1.0, rain: -60 },
      may: { level: 2, type: ['drought'], temp: +0.7, rain: -40 },
      jun: { level: 2, type: ['dry'], temp: +0.4, rain: -30 },
      jul: { level: 1, type: ['normal'], temp: +0.2, rain: -10 },
      aug: { level: 1, type: ['normal'], temp: 0, rain: 0 },
      sep: { level: 2, type: ['bushfire risk'], temp: +0.3, rain: -20 },
      oct: { level: 2, type: ['bushfire risk','heat'], temp: +0.5, rain: -30 },
      nov: { level: 3, type: ['heat','drought'], temp: +0.8, rain: -50 },
      dec: { level: 3, type: ['heat','bushfire'], temp: +1.0, rain: -60 },
    },
    remedies: {
      drought: ['Install water tanks to capture any rainfall','Water gardens only at dawn or dusk','Report water leaks immediately','Farmers: plant native drought-tolerant species'],
      bushfire: ['Clear 10m of vegetation around your home','Prepare a bushfire survival plan','Know your evacuation route before fire season','Register with local emergency management'],
      heat: ['Never leave children or pets in parked cars','Cool your home in the morning, close blinds by noon','Check on older neighbours every day','Wet hair and clothing for natural cooling'],
      'bushfire risk': ['Check Fire Danger Rating daily','Keep gutters clear of leaves','Have hoses and buckets of water ready'],
      dry: ['Mulch garden beds to retain moisture','Fix any dripping taps','Consider grey water recycling systems'],
      normal: ['Stay informed via Bureau of Meteorology','Prepare emergency kit as precaution'],
    },
  },
  {
    id: 'indonesia', name: 'Indonesia & Philippines', country: 'Indonesia, Philippines', region: 'Southeast Asia',
    lat: 0.5, lng: 117.0,
    impacts: {
      jan: { level: 4, type: ['drought','forest fire','food security'], temp: +1.2, rain: -130 },
      feb: { level: 4, type: ['drought','forest fire'], temp: +1.1, rain: -120 },
      mar: { level: 3, type: ['drought'], temp: +0.9, rain: -90 },
      apr: { level: 3, type: ['drought','heat'], temp: +0.8, rain: -70 },
      may: { level: 3, type: ['heat','drought'], temp: +0.7, rain: -60 },
      jun: { level: 2, type: ['heat'], temp: +0.5, rain: -40 },
      jul: { level: 2, type: ['heat','drought'], temp: +0.4, rain: -50 },
      aug: { level: 2, type: ['drought'], temp: +0.3, rain: -40 },
      sep: { level: 1, type: ['normal'], temp: +0.1, rain: -10 },
      oct: { level: 1, type: ['normal'], temp: 0, rain: +10 },
      nov: { level: 2, type: ['flooding'], temp: -0.2, rain: +60 },
      dec: { level: 2, type: ['flooding'], temp: -0.3, rain: +80 },
    },
    remedies: {
      drought: ['Collect rainwater during any wet spells','Protect rice crops with drought-resistant varieties','Avoid burning any vegetation — fire risk is extreme','Communities: share water sources fairly'],
      'forest fire': ['Never light open fires outdoors','Wear masks — air quality drops severely','Keep windows closed on smoky days','Report fires immediately to authorities'],
      'food security': ['Plant diverse crops to reduce single-crop risk','Preserve and store food during good seasons','Connect with local food banks and cooperatives'],
      heat: ['Drink water every 30 minutes during outdoor work','Shade livestock — heat stress kills animals','Avoid heavy exercise from 10am–4pm'],
      flooding: ['Monitor local river levels daily','Move valuables and documents to upper floors','Do not walk through floodwater — leptospirosis risk'],
      normal: ['Stay informed via BMKG (Indonesia) or PAGASA (Philippines)'],
    },
  },
  {
    id: 'india', name: 'India (Central & South)', country: 'India', region: 'South Asia',
    lat: 20.0, lng: 80.0,
    impacts: {
      jan: { level: 2, type: ['dry winter'], temp: +0.6, rain: -30 },
      feb: { level: 2, type: ['warm winter'], temp: +0.8, rain: -30 },
      mar: { level: 3, type: ['early heat wave'], temp: +1.1, rain: -40 },
      apr: { level: 4, type: ['heat wave','water shortage'], temp: +1.4, rain: -60 },
      may: { level: 4, type: ['heat wave','drought'], temp: +1.6, rain: -70 },
      jun: { level: 4, type: ['monsoon failure'], temp: +1.3, rain: -130 },
      jul: { level: 4, type: ['monsoon failure','drought'], temp: +1.1, rain: -120 },
      aug: { level: 3, type: ['drought','food risk'], temp: +0.9, rain: -80 },
      sep: { level: 3, type: ['drought'], temp: +0.7, rain: -60 },
      oct: { level: 2, type: ['below normal rain'], temp: +0.4, rain: -40 },
      nov: { level: 2, type: ['normal'], temp: +0.2, rain: -20 },
      dec: { level: 1, type: ['normal'], temp: 0, rain: 0 },
    },
    remedies: {
      'heat wave': ['Drink ORS (Oral Rehydration Solution) — not just water','Stay in shade or indoors between 12–4pm','Check on elderly and young children every hour','Wet a cloth and place on forehead, neck, armpits'],
      'water shortage': ['Harvest rainwater in every container available','Fix all leaks in household pipes','Avoid water-intensive crops like sugarcane this season','Use drip irrigation instead of flood irrigation'],
      'monsoon failure': ['Plant drought-resistant millets','Apply for government drought relief early','Conserve soil moisture with mulching'],
      drought: ['Government: activate relief and food distribution','Farmers: choose rabi crops carefully','Check bore wells for water table levels'],
      'food risk': ['Increase storage of pulses and grains','Monitor market prices for price gouging','Access PDS (Public Distribution System) allocations'],
      'dry winter': ['Check heating sources for safety','Irrigate winter crops if water is available'],
      'warm winter': ['Adjust sowing dates for rabi crops','Monitor for out-of-season pest activity'],
      'early heat wave': ['Start heat preparedness plans from March','Issue heat advisories in schools and workplaces'],
      'below normal rain': ['Plant only if irrigation is available'],
      normal: ['Track IMD monsoon forecasts from April onwards'],
    },
  },
  {
    id: 'east_africa', name: 'East Africa', country: 'Kenya, Ethiopia, Somalia, Tanzania', region: 'Africa',
    lat: 0.5, lng: 38.0,
    impacts: {
      jan: { level: 4, type: ['drought','food crisis'], temp: +1.3, rain: -100 },
      feb: { level: 4, type: ['drought','livestock loss'], temp: +1.2, rain: -90 },
      mar: { level: 3, type: ['drought'], temp: +1.0, rain: -70 },
      apr: { level: 3, type: ['drought'], temp: +0.9, rain: -60 },
      may: { level: 4, type: ['flooding','disease'], temp: +0.8, rain: +140 },
      jun: { level: 3, type: ['flooding'], temp: +0.6, rain: +110 },
      jul: { level: 2, type: ['normal to wet'], temp: +0.3, rain: +50 },
      aug: { level: 2, type: ['normal'], temp: +0.1, rain: +20 },
      sep: { level: 1, type: ['normal'], temp: 0, rain: 0 },
      oct: { level: 2, type: ['below average'], temp: -0.2, rain: -40 },
      nov: { level: 2, type: ['drought risk'], temp: -0.3, rain: -50 },
      dec: { level: 3, type: ['drought'], temp: -0.5, rain: -80 },
    },
    remedies: {
      drought: ['Destocking livestock before they die of thirst','Use drought-tolerant sorghum and millet varieties','Move to nearest water source with livestock','Register for NDMA (Kenya) or government drought aid'],
      'food crisis': ['Access WFP emergency food distributions','Prioritise feeding children under 5','Reduce one meal per day if needed — spread rations','Community kitchens: pool remaining food'],
      'livestock loss': ['Vaccinate animals now before conditions worsen','Sell weakest animals before total loss','Apply for livestock emergency compensation programmes'],
      flooding: ['Do not drink floodwater — cholera and typhoid risk is high','Use water purification tablets or boil all water','Move animals to higher ground','Avoid crossing flooded roads or rivers'],
      disease: ['Wash hands with soap after every toilet visit','Report cholera or diarrhoea cases to health worker immediately','Ensure latrines are above flood levels'],
      normal: ['Track ICPAC forecasts'],
      'normal to wet': ['Prepare farms for planting — soil is moist'],
      'below average': ['Plant only if irrigation is available'],
      'drought risk': ['Begin water conservation now'],
    },
  },
  {
    id: 'usa_south', name: 'Southern USA', country: 'United States', region: 'North America',
    lat: 33.0, lng: -98.0,
    impacts: {
      jan: { level: 3, type: ['flooding','storms'], temp: +1.0, rain: +90 },
      feb: { level: 3, type: ['flooding','tornadoes'], temp: +0.9, rain: +100 },
      mar: { level: 3, type: ['flooding','severe storms'], temp: +0.8, rain: +80 },
      apr: { level: 2, type: ['storms'], temp: +0.6, rain: +60 },
      may: { level: 2, type: ['above normal rain'], temp: +0.4, rain: +40 },
      jun: { level: 2, type: ['heat'], temp: +0.3, rain: -20 },
      jul: { level: 3, type: ['heat','drought'], temp: +0.5, rain: -50 },
      aug: { level: 3, type: ['heat','drought'], temp: +0.6, rain: -60 },
      sep: { level: 2, type: ['normal'], temp: +0.3, rain: -20 },
      oct: { level: 1, type: ['normal'], temp: +0.1, rain: 0 },
      nov: { level: 2, type: ['flooding'], temp: +0.3, rain: +40 },
      dec: { level: 2, type: ['flooding','storms'], temp: +0.6, rain: +70 },
    },
    remedies: {
      flooding: ['Sign up for NWS flood alerts on your phone','Never drive into flooded roadways — Turn Around, Don\'t Drown','Keep important documents in a waterproof bag','Know your flood zone from FEMA Flood Map'],
      tornadoes: ['Identify the lowest interior room in your home now','When sirens sound — go there immediately','Don\'t shelter under bridges or overpasses','Keep a battery radio for shelter-in-place alerts'],
      'severe storms': ['Unplug electronics during electrical storms','Stay inside and away from windows','Have a 72-hour emergency supply kit ready'],
      heat: ['Check on neighbours without air conditioning','Locate your nearest cooling centre','Never leave children or pets in vehicles','Replace electrolytes when sweating heavily'],
      drought: ['Observe local water restriction orders','Switch to drought-tolerant landscaping','Fix leaks — a dripping tap wastes 1,000 litres/month'],
      storms: ['Trim trees near your home before storm season','Secure outdoor furniture and decorations','Review homeowner insurance for flood coverage'],
      'above normal rain': ['Keep drains and gutters clear','Watch for flash flood warnings'],
      normal: ['Monitor NOAA weather.gov for seasonal outlooks'],
    },
  },
  {
    id: 'southern_africa', name: 'Southern Africa', country: 'Zimbabwe, Zambia, Mozambique, Malawi', region: 'Africa',
    lat: -17.0, lng: 30.0,
    impacts: {
      jan: { level: 5, type: ['drought','food crisis','heat'], temp: +2.0, rain: -150 },
      feb: { level: 5, type: ['drought','food crisis'], temp: +1.8, rain: -140 },
      mar: { level: 4, type: ['drought','heat'], temp: +1.5, rain: -110 },
      apr: { level: 4, type: ['drought'], temp: +1.3, rain: -90 },
      may: { level: 3, type: ['drought'], temp: +1.0, rain: -60 },
      jun: { level: 2, type: ['dry season'], temp: +0.7, rain: -30 },
      jul: { level: 2, type: ['dry season'], temp: +0.5, rain: -20 },
      aug: { level: 2, type: ['dry season'], temp: +0.4, rain: -10 },
      sep: { level: 2, type: ['hot dry'], temp: +0.6, rain: -20 },
      oct: { level: 2, type: ['heat'], temp: +0.8, rain: -30 },
      nov: { level: 3, type: ['delayed rains','heat'], temp: +1.0, rain: -60 },
      dec: { level: 3, type: ['drought risk'], temp: +1.2, rain: -70 },
    },
    remedies: {
      drought: ['Harvest any available wild fruits and vegetables','Maintain seed banks — do not eat all seed stock','Water crops in the evening to reduce evaporation','Form community water-sharing committees'],
      'food crisis': ['Access SADC drought relief programmes','Connect with local NGOs for food assistance','Priority: protect children from malnutrition — seek MUAC screening','Eat smaller and more frequent meals'],
      heat: ['Work fields only in early morning and evening','Keep homes ventilated — open windows at night','Protect livestock from heat stress with shade and water'],
      'dry season': ['Traditional water harvesting: sand dams and rock catchments','Dig trenches around crops to capture any rainfall'],
      'hot dry': ['Fire risk is extreme — no open burning','Check water sources for contamination as levels drop'],
      'delayed rains': ['Plant only when rains are confirmed — wait and watch','Use short-season crop varieties if rains come late'],
      'drought risk': ['Begin food rationing planning now','Identify alternative food and water sources early'],
    },
  },
  {
    id: 'brazil_northeast', name: 'Northeast Brazil', country: 'Brazil', region: 'South America',
    lat: -8.0, lng: -40.0,
    impacts: {
      jan: { level: 4, type: ['drought','heat'], temp: +1.5, rain: -120 },
      feb: { level: 3, type: ['drought'], temp: +1.3, rain: -90 },
      mar: { level: 3, type: ['drought'], temp: +1.1, rain: -80 },
      apr: { level: 3, type: ['heat','drought'], temp: +1.0, rain: -70 },
      may: { level: 2, type: ['heat'], temp: +0.7, rain: -40 },
      jun: { level: 2, type: ['drier than normal'], temp: +0.5, rain: -30 },
      jul: { level: 1, type: ['normal'], temp: +0.3, rain: -10 },
      aug: { level: 1, type: ['normal'], temp: +0.1, rain: 0 },
      sep: { level: 1, type: ['normal'], temp: 0, rain: 0 },
      oct: { level: 2, type: ['below normal rain'], temp: -0.2, rain: -30 },
      nov: { level: 2, type: ['drought risk'], temp: -0.3, rain: -50 },
      dec: { level: 3, type: ['drought'], temp: -0.5, rain: -80 },
    },
    remedies: {
      drought: ['Fill cisterns (cisternas) now before dry spell deepens','Use water-efficient drip systems for small farms','Plant native caatinga plants which survive dry conditions'],
      heat: ['Rest during hottest hours — shade and hydration are vital','Check livestock water every few hours in peak heat'],
      'drier than normal': ['Reduce cattle herd to match available water and forage'],
      normal: ['Monitor INMET and Embrapa climate advisories'],
      'below normal rain': ['Begin water storage preparations'],
      'drought risk': ['Contact SUDENE or EMBRAPA for drought assistance'],
    },
  },
  {
    id: 'central_america', name: 'Central America & Caribbean', country: 'Guatemala, Honduras, Nicaragua, Dominican Republic', region: 'Central America',
    lat: 14.5, lng: -86.0,
    impacts: {
      jan: { level: 3, type: ['dry','heat'], temp: +1.0, rain: -70 },
      feb: { level: 3, type: ['drought'], temp: +0.9, rain: -60 },
      mar: { level: 4, type: ['drought','food security'], temp: +1.2, rain: -90 },
      apr: { level: 4, type: ['drought','heat'], temp: +1.4, rain: -100 },
      may: { level: 3, type: ['heat'], temp: +1.1, rain: -60 },
      jun: { level: 2, type: ['normal'], temp: +0.7, rain: -20 },
      jul: { level: 2, type: ['midsummer drought'], temp: +0.5, rain: -50 },
      aug: { level: 2, type: ['normal'], temp: +0.3, rain: -10 },
      sep: { level: 3, type: ['storm risk'], temp: +0.2, rain: +40 },
      oct: { level: 3, type: ['hurricane risk'], temp: +0.1, rain: +60 },
      nov: { level: 2, type: ['normal'], temp: 0, rain: +20 },
      dec: { level: 2, type: ['dry'], temp: +0.4, rain: -40 },
    },
    remedies: {
      drought: ['Use traditional milpa (corn-squash-bean intercropping) for resilience','Protect hillside slopes with vetiver grass to slow erosion'],
      'food security': ['Access WFP food vouchers in Guatemala dry corridor','Plant fast-maturing bean varieties','Government: activate dry corridor emergency response'],
      heat: ['Ensure coffee and cacao crops have shade trees','Protect outdoor workers with shade breaks and water'],
      'midsummer drought': ['This is the traditional canícula (midsummer dry spell) — prepare early'],
      'storm risk': ['Prepare storm shutters and emergency supplies','Track NOAA Atlantic hurricane forecasts from June'],
      'hurricane risk': ['Follow evacuation orders immediately when issued','Secure roofs and windows now','Identify community shelter locations'],
      normal: ['Monitor INSIVUMEH (Guatemala) or national meteorological services'],
      dry: ['Conserve water — rainy season is ending'],
    },
  },
  {
    id: 'pacific_islands', name: 'Pacific Islands', country: 'Fiji, PNG, Solomon Islands, Vanuatu', region: 'Oceania',
    lat: -8.0, lng: 160.0,
    impacts: {
      jan: { level: 4, type: ['drought','food shortage'], temp: +1.2, rain: -110 },
      feb: { level: 4, type: ['drought'], temp: +1.1, rain: -100 },
      mar: { level: 4, type: ['drought','cyclone'], temp: +1.0, rain: -90 },
      apr: { level: 3, type: ['drought'], temp: +0.8, rain: -70 },
      may: { level: 3, type: ['drought'], temp: +0.6, rain: -50 },
      jun: { level: 2, type: ['dry'], temp: +0.4, rain: -30 },
      jul: { level: 2, type: ['dry'], temp: +0.2, rain: -20 },
      aug: { level: 1, type: ['normal'], temp: 0, rain: 0 },
      sep: { level: 1, type: ['normal'], temp: 0, rain: 0 },
      oct: { level: 2, type: ['wetter'], temp: -0.2, rain: +40 },
      nov: { level: 2, type: ['wetter','storm risk'], temp: -0.3, rain: +60 },
      dec: { level: 3, type: ['storm risk','flooding'], temp: -0.5, rain: +90 },
    },
    remedies: {
      drought: ['Collect and protect every drop of rainwater','Plant drought-tolerant breadfruit and taro varieties','Check for saltwater intrusion in coastal wells','Reduce water use to essential needs only'],
      'food shortage': ['Access SPC (Pacific Community) food security networks','Eat traditional drought-resilient foods (breadfruit, pandanus)'],
      cyclone: ['Secure boats, fishing equipment, and homes','Stock food and water for 5 days before cyclone season','Know your community cyclone shelter'],
      dry: ['Apply mulch heavily to protect soil moisture'],
      wetter: ['Clear drainage around homes to prevent flooding'],
      'storm risk': ['Track FMS (Fiji Met Service) tropical cyclone forecasts'],
      flooding: ['Move to higher ground when warnings issued','Boil all water sources after floods'],
      normal: ['Enjoy the relative calm — stock up and prepare for next season'],
    },
  },
];
