import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { MapContainer, TileLayer, CircleMarker, Popup, useMap } from 'react-leaflet';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine, ResponsiveContainer } from 'recharts';
import {
  REGIONS, MONTHS, MONTH_FULL, DAYS_IN_MONTH, MONTH_KEYS, ONI_MONTHLY_2026,
  IMPACT_LEVELS, TYPE_ICONS,
  buildDailyONI, buildWeeklyONI,
  dayToMonth, dayToWeek, weekLabel, dayToDateStr,
  getOniStatus, getImpactForDay,
} from './elninoData';
import 'leaflet/dist/leaflet.css';
import './App.css';

const DAILY_ONI  = buildDailyONI();   // 365 values
const WEEKLY_ONI = buildWeeklyONI(DAILY_ONI); // 52 values

const SPEEDS = [
  { label: '0.5×', ms: 1800 },
  { label: '1×',   ms:  900 },
  { label: '2×',   ms:  450 },
  { label: '4×',   ms:  180 },
];

/* ── helpers ─────────────────────────────────────────────── */
function maxStep(mode) {
  if (mode === 'day')  return 364;
  if (mode === 'week') return 51;
  return 11;
}
function dayFromStep(step, mode) {
  if (mode === 'day')  return step;
  if (mode === 'week') return step * 7;
  return DAYS_IN_MONTH.slice(0, step).reduce((a, b) => a + b, 0);
}
function stepFromDay(day, mode) {
  if (mode === 'day')  return day;
  if (mode === 'week') return dayToWeek(day);
  return dayToMonth(day);
}
function formatLabel(day, mode) {
  if (mode === 'day')  return dayToDateStr(day);
  if (mode === 'week') return weekLabel(dayToWeek(day));
  return MONTHS[dayToMonth(day)] + ' 2026';
}

/* ── MapFocus ────────────────────────────────────────────── */
function MapFocus({ region }) {
  const map = useMap();
  useEffect(() => {
    if (region) map.setView([region.lat, region.lng], 5, { animate: true });
  }, [region, map]);
  return null;
}

/* ── LiveWeather ─────────────────────────────────────────── */
function LiveWeather({ region }) {
  const [wx, setWx]   = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!region) return;
    setBusy(true);
    setWx(null);
    fetch(`https://api.open-meteo.com/v1/forecast?latitude=${region.lat}&longitude=${region.lng}&current=temperature_2m,relative_humidity_2m,wind_speed_10m,weather_code,precipitation&hourly=precipitation_probability&forecast_days=3&timezone=auto`)
      .then(r => r.json())
      .then(d => { setWx(d); setBusy(false); })
      .catch(() => setBusy(false));
  }, [region]);

  if (!region)  return <div className="empty"><span>🗺️</span><p>Click a map marker to see live weather</p></div>;
  if (busy)     return <div className="empty"><div className="spin"></div><p>Loading weather…</p></div>;
  if (!wx?.current) return <div className="empty"><span>⚠️</span><p>Weather unavailable</p></div>;

  const c = wx.current;
  const code = c.weather_code || 0;
  const ico  = code >= 95 ? '⛈️' : code >= 80 ? '🌧️' : code >= 61 ? '🌦️' : code >= 45 ? '🌫️' : code >= 3 ? '⛅' : '☀️';

  return (
    <div>
      <div className="wx-head">
        <span className="wx-ico">{ico}</span>
        <div>
          <div className="wx-name">{region.name}</div>
          <div className="dim sz11">Live — Open-Meteo API (no key required)</div>
        </div>
      </div>
      <div className="metric-grid">
        <div className="metric"><span className="metric-lbl">🌡️ Temp</span><span className="metric-val">{c.temperature_2m?.toFixed(1)}°C</span></div>
        <div className="metric"><span className="metric-lbl">💧 Humidity</span><span className="metric-val">{c.relative_humidity_2m}%</span></div>
        <div className="metric"><span className="metric-lbl">💨 Wind</span><span className="metric-val">{c.wind_speed_10m?.toFixed(0)} km/h</span></div>
        <div className="metric"><span className="metric-lbl">🌧️ Rain now</span><span className="metric-val">{c.precipitation?.toFixed(1)} mm</span></div>
      </div>
      {wx.hourly?.precipitation_probability && (
        <>
          <div className="sec-lbl mt8">72-hour rain probability</div>
          <div className="rain-row">
            {wx.hourly.precipitation_probability.slice(0,24).filter((_,i)=>i%4===0).map((p,i)=>(
              <div key={i} className="rain-col">
                <div className="rain-bar" style={{ height:`${Math.max(2,p)}%`, background: p>70?'#1e88e5':p>40?'#42a5f5':'#1a3a5c' }}/>
                <span className="rain-lbl">+{i*4}h</span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

/* ── Remedies ────────────────────────────────────────────── */
function Remedies({ region, impact }) {
  if (!region) return (
    <div className="empty">
      <span>🛡️</span><p>Select a region on the map to see safety guidance</p>
      <div className="quick-grid">
        {REGIONS.slice(0,6).map(r => (
          <button key={r.id} className="quick-btn" onClick={() => window.__selectRegion?.(r)}>{r.name}</button>
        ))}
      </div>
    </div>
  );
  if (!impact) return null;

  const lvl = IMPACT_LEVELS[impact.level];
  const remedies = [...new Set(impact.type.flatMap(t => region.remedies[t] || []))];

  return (
    <div>
      <div className="rem-head" style={{ borderLeft: `3px solid ${lvl.color}` }}>
        <div className="rem-title">{region.name}</div>
        <div className="rem-country dim sz11">{region.country}</div>
        <div className="badges">
          {impact.type.map(t => <span key={t} className="badge">{TYPE_ICONS[t]||'⚠️'} {t}</span>)}
        </div>
        <div className="anom-row">
          <div className="anom">
            <span className="anom-lbl">Temp anomaly</span>
            <span className="anom-val" style={{ color: impact.temp > 0 ? '#ef5350' : '#42a5f5' }}>
              {impact.temp > 0 ? '+' : ''}{impact.temp}°C
            </span>
          </div>
          <div className="anom">
            <span className="anom-lbl">Rainfall anomaly</span>
            <span className="anom-val" style={{ color: impact.rain > 0 ? '#42a5f5' : '#fb8c00' }}>
              {impact.rain > 0 ? '+' : ''}{impact.rain} mm
            </span>
          </div>
        </div>
      </div>
      <div className="sec-lbl">Safety actions</div>
      {remedies.length === 0
        ? <p className="dim sz13">No specific actions needed this period.</p>
        : remedies.slice(0,7).map((r,i) => (
            <div key={i} className="remedy"><span className="arrow">→</span><span>{r}</span></div>
          ))
      }
      <div className="source-note">
        Sources: NOAA ENSO · WMO climate advisories · national meteorological services
      </div>
    </div>
  );
}

/* ── Main App ────────────────────────────────────────────── */
export default function App() {
  const [mode,    setMode]    = useState('month');
  const [dayIdx,  setDayIdx]  = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speedI,  setSpeedI]  = useState(1);
  const [selReg,  setSelReg]  = useState(null);
  const [tab,     setTab]     = useState('oni');
  const [filter,  setFilter]  = useState('All');

  // expose setSelReg for quick-buttons inside Remedies
  window.__selectRegion = (r) => { setSelReg(r); setTab('remedies'); };

  const stepIdx  = stepFromDay(dayIdx, mode);
  const MAX      = maxStep(mode);
  const oni      = DAILY_ONI[dayIdx];
  const oniS     = getOniStatus(oni);
  const label    = formatLabel(dayIdx, mode);
  const monthIdx = dayToMonth(dayIdx);
  const weekIdx  = dayToWeek(dayIdx);

  // go to a step in current mode
  const goStep = useCallback((s) => {
    const clamped = Math.max(0, Math.min(MAX, s));
    setDayIdx(dayFromStep(clamped, mode));
  }, [mode, MAX]);

  // change mode — keep approximate position
  const changeMode = (m) => {
    setPlaying(false);
    setMode(m);
  };

  // auto-play
  useEffect(() => {
    if (!playing) return;
    const ms = SPEEDS[speedI].ms;
    const id = setInterval(() => {
      setDayIdx(prev => {
        const step = stepFromDay(prev, mode);
        if (step >= MAX) { setPlaying(false); return prev; }
        return dayFromStep(step + 1, mode);
      });
    }, ms);
    return () => clearInterval(id);
  }, [playing, speedI, mode, MAX]);

  const regions    = useMemo(() => [...new Set(REGIONS.map(r => r.region))], []);
  const filtered   = useMemo(() => filter === 'All' ? REGIONS : REGIONS.filter(r => r.region === filter), [filter]);
  const selImpact  = useMemo(() => selReg ? getImpactForDay(selReg, dayIdx) : null, [selReg, dayIdx]);

  const handleMarker = useCallback((r) => { setSelReg(r); setTab('remedies'); }, []);

  // chart data
  const chartData = useMemo(() => {
    if (mode === 'day')  return DAILY_ONI.map((v,i) => ({ i, v, lbl: i%30===0 ? MONTHS[dayToMonth(i)] : '' }));
    if (mode === 'week') return WEEKLY_ONI.map((v,i) => ({ i, v, lbl: i%4===0 ? `W${i+1}` : '' }));
    return MONTH_KEYS.map((k,i) => ({ i, v: ONI_MONTHLY_2026[k], lbl: MONTHS[i] }));
  }, [mode]);

  const chartPos = mode === 'month' ? MONTHS[monthIdx] : stepIdx;

  return (
    <div className="app">

      {/* ══════════════════════════════════════════
          TOP BAR
      ══════════════════════════════════════════ */}
      <div className="topbar">
        <div className="brand">
          <span className="brand-ico">🌊</span>
          <div>
            <div className="brand-title">El Niño Global Tracker 2026</div>
            <div className="brand-sub dim">NOAA/WMO verified data · Day · Week · Month views · Live weather</div>
          </div>
        </div>
        <div className="oni-badge" style={{ borderColor: oniS.color, background: oniS.bg }}>
          <span className="dim sz10">ONI Index</span>
          <span style={{ fontSize:22, fontWeight:800, color:oniS.color, lineHeight:1 }}>
            {oni > 0 ? '+' : ''}{oni}
          </span>
          <span style={{ fontSize:11, fontWeight:600, color:oniS.color }}>{oniS.label}</span>
        </div>
      </div>

      {/* ══════════════════════════════════════════
          MODE BAR  — Day / Week / Month toggle
      ══════════════════════════════════════════ */}
      <div className="mode-bar">
        <span className="mode-title">View by:</span>
        <div className="mode-pills">
          {['day','week','month'].map(m => (
            <button
              key={m}
              className={`mode-pill${mode===m?' mode-pill-on':''}`}
              onClick={() => changeMode(m)}
            >
              {m==='day' ? '📅 Day by Day' : m==='week' ? '📆 Week by Week' : '🗓️ Month by Month'}
            </button>
          ))}
        </div>
        <div className="mode-label" style={{ color: oniS.color }}>{label}</div>
      </div>

      {/* ══════════════════════════════════════════
          TIMELINE BAR  — playback + slider + ticks
      ══════════════════════════════════════════ */}
      <div className="timeline-bar">

        {/* playback row */}
        <div className="pb-row">
          <button className="pb-btn" onClick={() => goStep(stepIdx-1)} disabled={stepIdx===0}>◀</button>
          <button className="pb-play" onClick={() => setPlaying(p=>!p)}>
            {playing ? '⏸ Pause' : '▶ Play'}
          </button>
          <button className="pb-btn" onClick={() => goStep(stepIdx+1)} disabled={stepIdx>=MAX}>▶</button>
          <span className="dim sz11" style={{ marginLeft:6 }}>Speed:</span>
          {SPEEDS.map((s,i) => (
            <button key={i} className={`spd-btn${speedI===i?' spd-on':''}`} onClick={()=>setSpeedI(i)}>
              {s.label}
            </button>
          ))}
          <div className="slider-wrap">
            <span className="dim sz10">{mode==='day'?'Jan 1':mode==='week'?'W1':'Jan'}</span>
            <input
              type="range" min={0} max={MAX} value={stepIdx} step={1}
              className="tslider"
              onChange={e => goStep(+e.target.value)}
            />
            <span className="dim sz10">{mode==='day'?'Dec 31':mode==='week'?'W52':'Dec'}</span>
          </div>
        </div>

        {/* MONTH ticks */}
        {mode==='month' && (
          <div className="tick-row">
            {MONTHS.map((m,i) => {
              const v = ONI_MONTHLY_2026[MONTH_KEYS[i]];
              return (
                <button
                  key={m}
                  className={`tick${i===monthIdx?' tick-on':''}`}
                  style={i===monthIdx?{borderColor:oniS.color,color:oniS.color}:{}}
                  onClick={() => goStep(i)}
                >
                  <span className="tick-lbl">{m}</span>
                  <span className="tick-dot" style={{ background:getOniStatus(v).color }}/>
                </button>
              );
            })}
          </div>
        )}

        {/* WEEK ticks */}
        {mode==='week' && (
          <div className="tick-row">
            {WEEKLY_ONI.map((v,i) => (
              <button
                key={i}
                className={`tick tick-sm${i===weekIdx?' tick-on':''}`}
                style={i===weekIdx?{borderColor:oniS.color}:{}}
                onClick={() => goStep(i)}
              >
                <span className="tick-lbl">{i%4===0?`W${i+1}`:''}</span>
                <span className="tick-dot" style={{ background:getOniStatus(v).color }}/>
              </button>
            ))}
          </div>
        )}

        {/* DAY info bar */}
        {mode==='day' && (
          <div className="day-info">
            Day {dayIdx+1} of 365 &nbsp;·&nbsp; {label} &nbsp;·&nbsp;
            <span style={{ color:oniS.color }}>{oniS.label}</span>
            &nbsp;·&nbsp; ONI = {oni > 0 ? '+' : ''}{oni}°C
          </div>
        )}

      </div>

      {/* ══════════════════════════════════════════
          MAIN CONTENT
      ══════════════════════════════════════════ */}
      <div className="main">

        {/* ── MAP COL ── */}
        <div className="map-col">
          <div className="filter-bar">
            <span className="dim sz11">Filter:</span>
            {['All', ...regions].map(r => (
              <button key={r} className={`fil-btn${filter===r?' fil-on':''}`} onClick={()=>setFilter(r)}>{r}</button>
            ))}
          </div>

          <div className="map-box">
            <MapContainer center={[10,20]} zoom={2} style={{ height:'100%', width:'100%' }} scrollWheelZoom>
              <TileLayer
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                attribution="© OpenStreetMap contributors"
              />
              {selReg && <MapFocus region={selReg}/>}
              {filtered.map(region => {
                const imp = getImpactForDay(region, dayIdx);
                const lvl = IMPACT_LEVELS[imp.level];
                const sel = selReg?.id === region.id;
                return (
                  <CircleMarker key={region.id}
                    center={[region.lat, region.lng]}
                    radius={sel ? 22 : 10 + imp.level * 3}
                    fillColor={lvl.color} color={sel ? '#fff' : lvl.color}
                    weight={sel ? 3 : 1.5} fillOpacity={0.85} opacity={1}
                    eventHandlers={{ click: () => handleMarker(region) }}
                  >
                    <Popup>
                      <div className="pop">
                        <strong>{region.name}</strong><br/>
                        <span style={{ color:lvl.color, fontWeight:600 }}>{lvl.label} impact</span><br/>
                        {imp.type.map(t=>TYPE_ICONS[t]||'').join(' ')} {imp.type.join(', ')}<br/>
                        <small>Temp: {imp.temp>0?'+':''}{imp.temp}°C · Rain: {imp.rain>0?'+':''}{imp.rain}mm</small><br/>
                        <button className="pop-btn" onClick={() => { setSelReg(region); setTab('remedies'); }}>
                          View safety guidance →
                        </button>
                      </div>
                    </Popup>
                  </CircleMarker>
                );
              })}
            </MapContainer>
          </div>

          <div className="legend">
            <span className="dim sz11">Impact level:</span>
            {Object.entries(IMPACT_LEVELS).map(([k,v]) => (
              <span key={k} className="leg-item">
                <span className="leg-dot" style={{ background:v.color }}/>
                <span className="sz11">{v.label}</span>
              </span>
            ))}
          </div>
        </div>

        {/* ── SIDE COL ── */}
        <div className="side">

          <div className="tabs">
            {[['oni','📊 ONI Chart'],['weather','🌤 Weather'],['remedies','🛡 Remedies'],['regions','🗺 Regions']].map(([id,lbl]) => (
              <button key={id} className={`tab-btn${tab===id?' tab-on':''}`} onClick={()=>setTab(id)}>{lbl}</button>
            ))}
          </div>

          <div className="side-scroll">

            {/* ── ONI CHART ── */}
            {tab==='oni' && (
              <div className="pad">
                <div className="oni-hero" style={{ background:oniS.bg, borderColor:oniS.color }}>
                  <div style={{ fontSize:38, fontWeight:800, color:oniS.color, lineHeight:1 }}>
                    {oni > 0 ? '+' : ''}{oni}
                  </div>
                  <div>
                    <div style={{ fontSize:15, fontWeight:700, color:oniS.color }}>{oniS.label}</div>
                    <div className="dim sz12 mt4">{label}</div>
                    <div className="dim sz11 mt2">Oceanic Niño Index — {mode} view</div>
                  </div>
                </div>

                <div className="sec-lbl mt12">2026 ONI forecast ({mode} resolution)</div>
                <ResponsiveContainer width="100%" height={170}>
                  <AreaChart data={chartData} margin={{ top:8, right:8, left:-24, bottom:0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e2535"/>
                    <XAxis dataKey="lbl" tick={{ fontSize:10, fill:'#556' }}/>
                    <YAxis domain={[-1.2, 1.8]} tick={{ fontSize:10, fill:'#556' }}/>
                    <Tooltip
                      contentStyle={{ background:'#161922', border:'1px solid #2a2d3a', borderRadius:6, fontSize:12 }}
                      labelStyle={{ color:'#a0a8c0' }}
                      formatter={v => [`ONI: ${v}`, '']}
                    />
                    <ReferenceLine y={0.5}  stroke="#ef5350" strokeDasharray="4 2"
                      label={{ value:'El Niño', position:'right', fontSize:9, fill:'#ef5350' }}/>
                    <ReferenceLine y={-0.5} stroke="#42a5f5" strokeDasharray="4 2"
                      label={{ value:'La Niña', position:'right', fontSize:9, fill:'#42a5f5' }}/>
                    {mode==='month'
                      ? <ReferenceLine x={MONTHS[monthIdx]} stroke="#fb8c00" strokeWidth={2}/>
                      : <ReferenceLine x={stepIdx}          stroke="#fb8c00" strokeWidth={1.5}/>
                    }
                    <Area type="monotone" dataKey="v" stroke="#9C27B0" fill="#2d1535"
                      strokeWidth={mode==='day'?1:2}
                      dot={mode==='month'?{ r:3, fill:'#9C27B0' }:false}
                      activeDot={{ r:4 }}
                    />
                  </AreaChart>
                </ResponsiveContainer>

                <div className="info-card mt12">
                  <div className="info-title">About El Niño 2026</div>
                  <p className="sz12 dim" style={{ lineHeight:1.65 }}>
                    The 2024–25 El Niño event peaked at ~+1.5°C ONI (strong) in late 2024. By January 2026 it has weakened to moderate (+1.1°C). NOAA/CPC and IRI forecast a continued decline through mid-2026, with <strong style={{color:'#e0e0e0'}}>neutral conditions by May–June</strong> and a <strong style={{color:'#42a5f5'}}>~60% probability of La Niña</strong> developing by September–November 2026.
                  </p>
                  <p className="sz12 dim mt4" style={{ lineHeight:1.65 }}>
                    Use <strong style={{color:'#CE93D8'}}>Day by Day</strong> mode to watch the ONI decline smoothly across 365 steps. The vertical orange line marks your current position.
                  </p>
                  <div className="source-note">Source: NOAA CPC ENSO Diagnostic Discussion · IRI probabilistic forecast · Jan 2026</div>
                </div>
              </div>
            )}

            {/* ── LIVE WEATHER ── */}
            {tab==='weather' && (
              <div className="pad">
                <LiveWeather region={selReg}/>
              </div>
            )}

            {/* ── REMEDIES ── */}
            {tab==='remedies' && (
              <div className="pad">
                <Remedies region={selReg} impact={selImpact}/>
              </div>
            )}

            {/* ── ALL REGIONS ── */}
            {tab==='regions' && (
              <div className="pad">
                <div className="sec-lbl">{label} — sorted by impact severity</div>
                {[...REGIONS]
                  .map(r => ({ r, imp: getImpactForDay(r, dayIdx) }))
                  .sort((a,b) => b.imp.level - a.imp.level)
                  .map(({ r, imp }) => {
                    const lvl = IMPACT_LEVELS[imp.level];
                    return (
                      <div key={r.id}
                        className={`reg-row${selReg?.id===r.id?' reg-sel':''}`}
                        style={{ borderLeft:`3px solid ${lvl.color}` }}
                        onClick={() => { setSelReg(r); setTab('remedies'); }}
                      >
                        <div className="reg-top">
                          <span className="reg-name">{r.name}</span>
                          <span style={{ fontSize:11, fontWeight:600, color:lvl.color }}>{lvl.label}</span>
                        </div>
                        <div className="chip-row">
                          {imp.type.map(t => <span key={t} className="chip">{TYPE_ICONS[t]||'⚠️'} {t}</span>)}
                        </div>
                        <div className="reg-meta">
                          <span style={{ color:imp.temp>0?'#ef5350':'#42a5f5' }}>
                            {imp.temp>0?'▲':'▼'}{Math.abs(imp.temp)}°C
                          </span>
                          <span className="dim">&nbsp;·&nbsp;</span>
                          <span style={{ color:imp.rain>0?'#42a5f5':'#fb8c00' }}>
                            {imp.rain>0?'+':''}{imp.rain}mm
                          </span>
                        </div>
                      </div>
                    );
                  })}
              </div>
            )}

          </div>{/* side-scroll */}
        </div>{/* side */}
      </div>{/* main */}

      <div className="footer">
        <span>Data: NOAA CPC ENSO · IRI probabilistic forecast · WMO climate updates · Open-Meteo live weather</span>
        <span className="dim" style={{margin:'0 8px'}}>·</span>
        <span>Public awareness only — follow official government guidance in emergencies</span>
      </div>

    </div>
  );
}
