import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { MapContainer, TileLayer, CircleMarker, Popup, useMap } from 'react-leaflet';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ReferenceLine, ResponsiveContainer, LineChart, Line
} from 'recharts';
import {
  REGIONS, MONTHS, MONTH_FULL, DAYS_IN_MONTH, MONTH_KEYS,
  ONI_MONTHLY_2026, IMPACT_LEVELS, TYPE_ICONS,
  buildDailyONI, buildWeeklyONI,
  dayToMonth, dayToWeek, weekLabel, dayToDateStr,
  getOniStatus, getImpactForDay
} from './elninoData';
import 'leaflet/dist/leaflet.css';
import './App.css';

// Pre-compute full year arrays once
const DAILY_ONI = buildDailyONI();
const WEEKLY_ONI = buildWeeklyONI(DAILY_ONI);

const TOTAL_DAYS = 365;
const TOTAL_WEEKS = 52;
const TOTAL_MONTHS = 12;

function MapAutoFocus({ selectedRegion }) {
  const map = useMap();
  useEffect(() => {
    if (selectedRegion) map.setView([selectedRegion.lat, selectedRegion.lng], 5, { animate: true });
  }, [selectedRegion, map]);
  return null;
}

function LiveWeatherPanel({ region }) {
  const [weather, setWeather] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!region) return;
    setLoading(true);
    fetch(`https://api.open-meteo.com/v1/forecast?latitude=${region.lat}&longitude=${region.lng}&current=temperature_2m,relative_humidity_2m,wind_speed_10m,weather_code,precipitation&hourly=precipitation_probability&forecast_days=3&timezone=auto`)
      .then(r => r.json())
      .then(data => { setWeather(data); setLoading(false); })
      .catch(() => setLoading(false));
  }, [region]);

  if (!region) return (
    <div className="empty-state">
      <span>🗺️</span>
      <p>Click a region on the map to see live weather</p>
    </div>
  );
  if (loading) return (
    <div className="empty-state">
      <div className="spinner"></div>
      <p>Fetching live weather for {region.name}…</p>
    </div>
  );
  if (!weather?.current) return (
    <div className="empty-state"><span>⚠️</span><p>Weather data unavailable</p></div>
  );

  const c = weather.current;
  const code = c.weather_code;
  const wIcon = code >= 95 ? '⛈️' : code >= 80 ? '🌧️' : code >= 61 ? '🌦️' : code >= 51 ? '🌦️' : code >= 45 ? '🌫️' : code >= 3 ? '⛅' : '☀️';

  return (
    <div>
      <div className="card mb12">
        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
          <span style={{ fontSize:28 }}>{wIcon}</span>
          <div>
            <div className="card-title">{region.name}</div>
            <div className="muted" style={{ fontSize:11 }}>Live — Open-Meteo API</div>
          </div>
        </div>
      </div>
      <div className="grid2 mb12">
        <div className="metric-card">
          <span className="metric-label">🌡️ Temperature</span>
          <span className="metric-val">{c.temperature_2m?.toFixed(1)}°C</span>
        </div>
        <div className="metric-card">
          <span className="metric-label">💧 Humidity</span>
          <span className="metric-val">{c.relative_humidity_2m}%</span>
        </div>
        <div className="metric-card">
          <span className="metric-label">💨 Wind</span>
          <span className="metric-val">{c.wind_speed_10m?.toFixed(0)} km/h</span>
        </div>
        <div className="metric-card">
          <span className="metric-label">🌧️ Precipitation</span>
          <span className="metric-val">{c.precipitation?.toFixed(1)} mm</span>
        </div>
      </div>
      {weather.hourly?.precipitation_probability && (
        <div>
          <div className="section-label">72-hour rain probability</div>
          <div className="rain-bars">
            {weather.hourly.precipitation_probability.slice(0, 24).filter((_,i) => i % 4 === 0).map((prob, i) => (
              <div key={i} className="rain-col">
                <div className="rain-fill" style={{ height:`${Math.max(2,prob)}%`, background: prob>70?'#2196F3':prob>40?'#64B5F6':'#1a3a5c' }}></div>
                <span className="rain-label">+{i*4}h</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function RemediesPanel({ region, impact }) {
  if (!region || !impact) return null;
  const allRemedies = impact.type.flatMap(t => region.remedies[t] || []);
  const unique = [...new Set(allRemedies)];
  return (
    <div>
      <div className="card mb12" style={{ borderLeft:`3px solid ${IMPACT_LEVELS[impact.level].color}` }}>
        <div className="card-title">{region.name}</div>
        <div className="impact-badges mb8">
          {impact.type.map(t => (
            <span key={t} className="badge">{TYPE_ICONS[t]||'⚠️'} {t}</span>
          ))}
        </div>
        <div className="grid2">
          <div className="metric-card">
            <span className="metric-label">Temp anomaly</span>
            <span className="metric-val" style={{ color: impact.temp>0?'#F44336':'#2196F3' }}>
              {impact.temp>0?'+':''}{impact.temp}°C
            </span>
          </div>
          <div className="metric-card">
            <span className="metric-label">Rain anomaly</span>
            <span className="metric-val" style={{ color: impact.rain>0?'#2196F3':'#FF9800' }}>
              {impact.rain>0?'+':''}{impact.rain} mm
            </span>
          </div>
        </div>
      </div>
      <div className="section-label">Safety actions</div>
      {unique.length === 0
        ? <p className="muted" style={{ fontSize:13 }}>No specific actions needed.</p>
        : unique.slice(0, 7).map((r, i) => (
            <div key={i} className="remedy-row">
              <span className="remedy-arrow">→</span>
              <span>{r}</span>
            </div>
          ))
      }
    </div>
  );
}

// Speed options in ms per step
const SPEED_OPTIONS = [
  { label: '0.5×', ms: 1800 },
  { label: '1×',   ms: 900  },
  { label: '2×',   ms: 450  },
  { label: '4×',   ms: 200  },
];

export default function App() {
  const [mode, setMode] = useState('month');      // 'day' | 'week' | 'month'
  const [dayIdx, setDayIdx] = useState(0);        // 0–364 (source of truth)
  const [playing, setPlaying] = useState(false);
  const [speedIdx, setSpeedIdx] = useState(1);
  const [selectedRegion, setSelectedRegion] = useState(null);
  const [activeTab, setActiveTab] = useState('oni');
  const [filterRegion, setFilterRegion] = useState('All');

  // Derived indices
  const weekIdx  = dayToWeek(dayIdx);
  const monthIdx = dayToMonth(dayIdx);
  const monthKey = MONTH_KEYS[monthIdx];

  const oni    = DAILY_ONI[dayIdx];
  const oniStatus = getOniStatus(oni);

  // Total steps for current mode
  const totalSteps = mode === 'day' ? TOTAL_DAYS : mode === 'week' ? TOTAL_WEEKS : TOTAL_MONTHS;

  // Step index for current mode
  const stepIdx = mode === 'day' ? dayIdx : mode === 'week' ? weekIdx : monthIdx;

  const setStepIdx = useCallback((s) => {
    const clamped = Math.max(0, Math.min(totalSteps - 1, s));
    if (mode === 'day') setDayIdx(clamped);
    else if (mode === 'week') setDayIdx(clamped * 7);
    else setDayIdx(DAYS_IN_MONTH.slice(0, clamped).reduce((a,b)=>a+b, 0));
  }, [mode, totalSteps]);

  // Playback
  useEffect(() => {
    if (!playing) return;
    const speed = SPEED_OPTIONS[speedIdx].ms;
    const timer = setInterval(() => {
      setStepIdx(s => {
        if (typeof s === 'function') return s;
        const next = stepIdx + 1;
        if (next >= totalSteps) { setPlaying(false); return stepIdx; }
        if (mode === 'day') { setDayIdx(d => { if (d >= TOTAL_DAYS-1) { setPlaying(false); return d; } return d+1; }); return stepIdx; }
        if (mode === 'week') { setDayIdx(d => { const nw = Math.min(51, Math.floor(d/7)+1); if (nw >= 52) { setPlaying(false); return d; } return nw*7; }); return stepIdx; }
        // month
        setDayIdx(d => {
          const m = dayToMonth(d);
          if (m >= 11) { setPlaying(false); return d; }
          return DAYS_IN_MONTH.slice(0,m+1).reduce((a,b)=>a+b,0);
        });
        return stepIdx;
      });
    }, speed);
    return () => clearInterval(timer);
  }, [playing, speedIdx, mode, stepIdx, totalSteps, setStepIdx]);

  // Label for current position
  const currentLabel = useMemo(() => {
    if (mode === 'day') return dayToDateStr(dayIdx);
    if (mode === 'week') return weekLabel(weekIdx);
    return `${MONTHS[monthIdx]} 2026`;
  }, [mode, dayIdx, weekIdx, monthIdx]);

  // ONI chart data
  const oniChartData = useMemo(() => {
    if (mode === 'day') {
      return DAILY_ONI.map((v, i) => ({ label: i % 30 === 0 ? MONTHS[dayToMonth(i)] : '', oni: v, idx: i }));
    }
    if (mode === 'week') {
      return WEEKLY_ONI.map((v, i) => ({ label: i % 4 === 0 ? `W${i+1}` : '', oni: v, idx: i }));
    }
    return MONTH_KEYS.map((k, i) => ({ label: MONTHS[i], oni: ONI_MONTHLY_2026[k], idx: i }));
  }, [mode]);

  const allRegions = filterRegion === 'All' ? REGIONS : REGIONS.filter(r => r.region === filterRegion);
  const uniqueRegions = [...new Set(REGIONS.map(r => r.region))];

  // Get impact for selected region at current day
  const selectedImpact = useMemo(() => {
    if (!selectedRegion) return null;
    return getImpactForDay(selectedRegion, dayIdx);
  }, [selectedRegion, dayIdx]);

  const handleMarkerClick = useCallback((region) => {
    setSelectedRegion(region);
    setActiveTab('remedies');
  }, []);

  // Prev / Next step
  const prev = () => setStepIdx(stepIdx - 1);
  const next = () => setStepIdx(stepIdx + 1);

  // Slider value
  const sliderMax = totalSteps - 1;

  // ONI reference line position
  const refLabel = mode === 'month' ? MONTHS[monthIdx] : stepIdx;

  return (
    <div className="app">
      {/* ── Header ── */}
      <header className="app-header">
        <div style={{ display:'flex', alignItems:'center', gap:12 }}>
          <span style={{ fontSize:26 }}>🌊</span>
          <div>
            <h1 style={{ fontSize:17, fontWeight:600, margin:0 }}>El Niño Global Tracker 2026</h1>
            <span className="muted" style={{ fontSize:11 }}>Live impact forecasts · Safety guidance · Day / Week / Month</span>
          </div>
        </div>
        <div className="oni-pill" style={{ background: oniStatus.bg, borderColor: oniStatus.color }}>
          <span className="muted" style={{ fontSize:10 }}>ONI</span>
          <span style={{ fontSize:20, fontWeight:700, color: oniStatus.color }}>{oni>0?'+':''}{oni}</span>
          <span style={{ fontSize:11, fontWeight:500, color: oniStatus.color }}>{oniStatus.label}</span>
        </div>
      </header>

      {/* ── Mode + Controls bar ── */}
      <div className="controls-bar">
        {/* Mode switcher */}
        <div className="mode-switcher">
          {['day','week','month'].map(m => (
            <button key={m} className={`mode-btn ${mode===m?'active':''}`}
              onClick={() => { setMode(m); setPlaying(false); }}>
              {m === 'day' ? '📅 Day' : m === 'week' ? '📆 Week' : '🗓️ Month'}
            </button>
          ))}
        </div>

        {/* Playback */}
        <div className="playback-group">
          <button className="ctrl-btn" onClick={prev} disabled={stepIdx===0}>‹</button>
          <button className="play-btn" onClick={() => setPlaying(p => !p)}>
            {playing ? '⏸ Pause' : '▶ Play'}
          </button>
          <button className="ctrl-btn" onClick={next} disabled={stepIdx>=totalSteps-1}>›</button>
        </div>

        {/* Speed */}
        <div className="speed-group">
          {SPEED_OPTIONS.map((s, i) => (
            <button key={i} className={`speed-btn ${speedIdx===i?'active':''}`}
              onClick={() => setSpeedIdx(i)}>
              {s.label}
            </button>
          ))}
        </div>

        {/* Slider */}
        <div style={{ display:'flex', alignItems:'center', gap:8, flex:1, minWidth:120 }}>
          <input
            type="range" min={0} max={sliderMax} value={stepIdx} step={1}
            style={{ flex:1 }}
            onChange={e => setStepIdx(+e.target.value)}
          />
        </div>

        {/* Current label */}
        <div className="current-label" style={{ color: oniStatus.color }}>
          {currentLabel}
        </div>
      </div>

      {/* ── Month strip (month mode only) ── */}
      {mode === 'month' && (
        <div className="month-strip-bar">
          {MONTHS.map((m, i) => {
            const mk = MONTH_KEYS[i];
            const mOni = ONI_MONTHLY_2026[mk];
            return (
              <button key={m}
                className={`month-chip ${i===monthIdx?'active':''}`}
                onClick={() => setStepIdx(i)}
                style={i===monthIdx?{borderColor:oniStatus.color}:{}}>
                <span className="mc-name">{m}</span>
                <span className="mc-dot" style={{ background: getOniStatus(mOni).color }}></span>
              </button>
            );
          })}
        </div>
      )}

      {/* ── Week strip (week mode only) ── */}
      {mode === 'week' && (
        <div className="week-strip-bar">
          {WEEKLY_ONI.map((v, i) => {
            const m = dayToMonth(i * 7);
            return (
              <button key={i}
                className={`week-chip ${i===weekIdx?'active':''}`}
                onClick={() => setStepIdx(i)}
                style={i===weekIdx?{borderColor:oniStatus.color}:{}}>
                <span className="wc-num">W{i+1}</span>
                <span className="wc-dot" style={{ background: getOniStatus(v).color }}></span>
              </button>
            );
          })}
        </div>
      )}

      {/* ── Main layout ── */}
      <div className="main-layout">
        {/* Map */}
        <div className="map-section">
          <div className="map-toolbar">
            <span className="muted" style={{ fontSize:12, flexShrink:0 }}>Region:</span>
            {['All', ...uniqueRegions].map(r => (
              <button key={r} className={`filter-btn ${filterRegion===r?'active':''}`}
                onClick={() => setFilterRegion(r)}>{r}</button>
            ))}
          </div>
          <div className="map-wrap">
            <MapContainer center={[10, 20]} zoom={2} style={{ height:'100%', width:'100%' }} scrollWheelZoom={true}>
              <TileLayer
                attribution='© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />
              {selectedRegion && <MapAutoFocus selectedRegion={selectedRegion} />}
              {allRegions.map(region => {
                const impact = getImpactForDay(region, dayIdx);
                const lvl = IMPACT_LEVELS[impact.level];
                const isSelected = selectedRegion?.id === region.id;
                return (
                  <CircleMarker key={region.id}
                    center={[region.lat, region.lng]}
                    radius={isSelected ? 22 : 12 + impact.level * 2.5}
                    fillColor={lvl.color} color={isSelected ? '#fff' : lvl.color}
                    weight={isSelected ? 3 : 1.5} fillOpacity={0.8} opacity={0.9}
                    eventHandlers={{ click: () => handleMarkerClick(region) }}>
                    <Popup>
                      <div className="popup-inner">
                        <strong>{region.name}</strong><br/>
                        <span style={{ color:lvl.color }}>{lvl.label} impact</span><br/>
                        {impact.type.map(t => TYPE_ICONS[t]||'').join(' ')} {impact.type.join(', ')}<br/>
                        <small>
                          Temp: {impact.temp>0?'+':''}{impact.temp}°C &nbsp;
                          Rain: {impact.rain>0?'+':''}{impact.rain}mm
                        </small><br/>
                        <button className="popup-btn" onClick={() => { setSelectedRegion(region); setActiveTab('remedies'); }}>
                          View remedies →
                        </button>
                      </div>
                    </Popup>
                  </CircleMarker>
                );
              })}
            </MapContainer>
          </div>
          <div className="legend-bar">
            <span className="muted" style={{ fontSize:11 }}>Impact:</span>
            {Object.entries(IMPACT_LEVELS).map(([k, v]) => (
              <span key={k} className="legend-item">
                <span className="legend-dot" style={{ background:v.color }}></span>
                <span>{v.label}</span>
              </span>
            ))}
          </div>
        </div>

        {/* Side panel */}
        <div className="side-panel">
          <div className="tab-bar">
            {[['oni','📊 ONI Chart'],['weather','🌤️ Live Weather'],['remedies','🛡️ Remedies'],['regions','🗺️ Regions']].map(([id,label]) => (
              <button key={id} className={`tab ${activeTab===id?'active':''}`} onClick={() => setActiveTab(id)}>
                {label}
              </button>
            ))}
          </div>

          <div className="tab-content">
            {/* ONI Chart tab */}
            {activeTab === 'oni' && (
              <div>
                <div className="oni-hero" style={{ background: oniStatus.bg, borderColor: oniStatus.color }}>
                  <div style={{ fontSize:34, fontWeight:700, color:oniStatus.color }}>
                    {oni>0?'+':''}{oni}
                  </div>
                  <div>
                    <div style={{ fontSize:14, fontWeight:600, color:oniStatus.color }}>{oniStatus.label}</div>
                    <div className="muted" style={{ fontSize:12, marginTop:3 }}>{currentLabel}</div>
                    <div className="muted" style={{ fontSize:11, marginTop:1 }}>
                      {mode === 'day' ? 'Daily ONI' : mode === 'week' ? 'Weekly avg ONI' : 'Monthly ONI'} — Oceanic Niño Index
                    </div>
                  </div>
                </div>

                <div className="section-label mt12">2026 ONI forecast — {mode} view</div>
                <ResponsiveContainer width="100%" height={170}>
                  <AreaChart data={oniChartData} margin={{ top:10, right:8, left:-22, bottom:0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e2535" />
                    <XAxis dataKey="label" tick={{ fontSize:10, fill:'#5a6080' }} />
                    <YAxis domain={[-1.2, 2]} tick={{ fontSize:10, fill:'#5a6080' }} />
                    <Tooltip
                      contentStyle={{ background:'#161922', border:'1px solid #2a2d3a', borderRadius:6, fontSize:12 }}
                      labelStyle={{ color:'#a0a8c0' }}
                      formatter={(v) => [`ONI: ${v}`, '']}
                    />
                    <ReferenceLine y={0.5} stroke="#F44336" strokeDasharray="4 2"
                      label={{ value:'El Niño', position:'right', fontSize:9, fill:'#F44336' }} />
                    <ReferenceLine y={-0.5} stroke="#2196F3" strokeDasharray="4 2"
                      label={{ value:'La Niña', position:'right', fontSize:9, fill:'#2196F3' }} />
                    {mode === 'month'
                      ? <ReferenceLine x={MONTHS[monthIdx]} stroke="#FF9800" strokeWidth={2} />
                      : <ReferenceLine x={stepIdx} stroke="#FF9800" strokeWidth={1.5} />
                    }
                    <Area type="monotone" dataKey="oni" stroke="#9C27B0" fill="#2d1535"
                      strokeWidth={mode==='day'?1:2}
                      dot={mode==='month'?{ r:3, fill:'#9C27B0' }:false}
                      activeDot={{ r:4 }}
                    />
                  </AreaChart>
                </ResponsiveContainer>

                <div className="card mt12" style={{ fontSize:12, lineHeight:1.6, color:'#a0a8c0' }}>
                  <div style={{ fontWeight:600, color:'#e8eaf0', marginBottom:6 }}>About El Niño 2026</div>
                  El Niño peaked at +1.4 ONI in January 2026 and is forecast to weaken through mid-year, transitioning to neutral by September and potentially La Niña by late 2026. Switch to <strong style={{ color:'#CE93D8' }}>Day</strong> or <strong style={{ color:'#CE93D8' }}>Week</strong> mode to see fine-grained transitions.
                </div>
              </div>
            )}

            {/* Live weather tab */}
            {activeTab === 'weather' && <LiveWeatherPanel region={selectedRegion} />}

            {/* Remedies tab */}
            {activeTab === 'remedies' && (
              selectedRegion
                ? <RemediesPanel region={selectedRegion} impact={selectedImpact} />
                : (
                  <div className="empty-state">
                    <span>🗺️</span>
                    <p>Click any region on the map to see safety guidance</p>
                    <div className="quick-grid">
                      {REGIONS.slice(0, 6).map(r => (
                        <button key={r.id} className="quick-btn"
                          onClick={() => { setSelectedRegion(r); }}>
                          {r.name}
                        </button>
                      ))}
                    </div>
                  </div>
                )
            )}

            {/* All regions tab */}
            {activeTab === 'regions' && (
              <div>
                <div className="section-label">{currentLabel} — sorted by impact</div>
                {[...REGIONS]
                  .map(r => ({ r, impact: getImpactForDay(r, dayIdx) }))
                  .sort((a, b) => b.impact.level - a.impact.level)
                  .map(({ r, impact }) => {
                    const lvl = IMPACT_LEVELS[impact.level];
                    const isSel = selectedRegion?.id === r.id;
                    return (
                      <div key={r.id}
                        className={`region-row ${isSel?'region-row-active':''}`}
                        style={{ borderLeft:`3px solid ${lvl.color}` }}
                        onClick={() => { setSelectedRegion(r); setActiveTab('remedies'); }}>
                        <div style={{ display:'flex', justifyContent:'space-between', marginBottom:4 }}>
                          <span style={{ fontSize:13, fontWeight:600, color:'#e8eaf0' }}>{r.name}</span>
                          <span style={{ fontSize:11, fontWeight:600, color:lvl.color }}>{lvl.label}</span>
                        </div>
                        <div className="type-chips mb4">
                          {impact.type.map(t => (
                            <span key={t} className="type-chip">{TYPE_ICONS[t]||'⚠️'} {t}</span>
                          ))}
                        </div>
                        <div className="muted" style={{ fontSize:11 }}>
                          <span style={{ color: impact.temp>0?'#F44336':'#2196F3' }}>
                            {impact.temp>0?'▲':'▼'} {Math.abs(impact.temp)}°C
                          </span>
                          &nbsp;·&nbsp;
                          <span style={{ color: impact.rain>0?'#2196F3':'#FF9800' }}>
                            {impact.rain>0?'+':''}{impact.rain}mm rain
                          </span>
                        </div>
                      </div>
                    );
                  })}
              </div>
            )}
          </div>
        </div>
      </div>

      <footer className="app-footer">
        <span>NOAA ENSO forecasts · Open-Meteo live weather · WMO climate advisories</span>
        <span style={{ margin:'0 8px', color:'#2a2d3a' }}>·</span>
        <span>For public awareness — not official emergency guidance</span>
      </footer>
    </div>
  );
}
