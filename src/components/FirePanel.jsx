/**
 * FirePanel — Fire Status, History & Prediction
 *
 * Renders inside ZoneDetail under the "fire" tab.
 * Fetches its own data via firePrediction.js so it is self-contained.
 *
 * Sections:
 *   1. Status bar  — current FWI + FIRMS count + trend badge
 *   2. Risk factors — 4 contributing signals as mini bars
 *   3. 30-day history chart — FWI line + fire event bars (combo)
 *   4. 16-day forecast chart — predicted FWI + rain probability
 *   5. Peak risk callout — worst forecast day
 *   6. Data source note
 */

import { useState, useEffect, useRef } from 'react'
import { Bar, Line } from 'react-chartjs-2'
import {
  Chart as ChartJS, CategoryScale, LinearScale, PointElement,
  LineElement, BarElement, Filler, Tooltip as ChartTooltip, Legend,
} from 'chart.js'
import { Flame, Wind, Droplets, Thermometer, TrendingUp, TrendingDown, Minus, AlertTriangle, Info } from 'lucide-react'
import { fetchFireData, fwiRisk } from '../services/firePrediction'

ChartJS.register(
  CategoryScale, LinearScale, PointElement, LineElement, BarElement,
  Filler, ChartTooltip, Legend,
)

const MONO = 'JetBrains Mono, monospace'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function RiskBadge({ fwi }) {
  const r = fwiRisk(fwi)
  return (
    <span style={{
      fontSize: 10, fontWeight: 700, padding: '3px 10px', borderRadius: 20,
      background: r.bg, color: r.color, fontFamily: MONO, letterSpacing: '.04em',
    }}>
      {r.short}
    </span>
  )
}

function MiniBar({ label, value, color, icon: Icon }) {
  return (
    <div style={{ flex: 1, minWidth: 100 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 5 }}>
        <Icon size={12} color={color} />
        <span style={{ fontSize: 10, color: 'var(--text-secondary)', fontFamily: MONO }}>{label}</span>
        <span style={{ marginLeft: 'auto', fontSize: 11, fontWeight: 700, color, fontFamily: MONO }}>{value}%</span>
      </div>
      <div style={{ height: 5, borderRadius: 3, background: 'var(--bg-elevated)', overflow: 'hidden' }}>
        <div style={{
          height: '100%', borderRadius: 3, background: color,
          width: `${value}%`, transition: 'width .8s cubic-bezier(.4,0,.2,1)',
        }} />
      </div>
    </div>
  )
}

// Shared chart options base
const chartBase = {
  responsive: true,
  maintainAspectRatio: false,
  animation: { duration: 500 },
  plugins: {
    legend: {
      position: 'bottom',
      labels: { color: 'var(--text-muted)', font: { family: MONO, size: 9 }, boxWidth: 10, padding: 10 },
    },
    tooltip: {
      backgroundColor: '#fff',
      borderColor: '#E0E8E2',
      borderWidth: 1,
      titleColor: '#1A2E1E',
      bodyFont: { family: MONO, size: 11 },
      titleFont: { family: MONO, size: 11, weight: '600' },
      padding: 10,
    },
  },
  scales: {
    x: {
      ticks: { color: 'var(--text-muted)', font: { family: MONO, size: 9 }, maxTicksLimit: 8 },
      grid:  { color: 'rgba(180,200,185,0.3)' },
      border:{ color: 'rgba(180,200,185,0.3)' },
    },
  },
}

// ---------------------------------------------------------------------------
// Subcharts
// ---------------------------------------------------------------------------
function HistoryChart({ history }) {
  const labels    = history.map(d => d.label)
  const fwiData   = history.map(d => d.fwi)
  const fireData  = history.map(d => d.fireCount)

  const data = {
    labels,
    datasets: [
      {
        type: 'line',
        label: 'Fire Weather Index',
        data: fwiData,
        borderColor: '#EA580C',
        backgroundColor: 'rgba(234,88,12,0.08)',
        borderWidth: 2,
        pointRadius: 2,
        pointHoverRadius: 5,
        fill: true,
        tension: 0.35,
        yAxisID: 'y',
      },
      {
        type: 'bar',
        label: 'Fire Events (est.)',
        data: fireData,
        backgroundColor: fireData.map(v =>
          v > 10 ? 'rgba(220,53,69,0.7)' :
          v > 5  ? 'rgba(234,88,12,0.6)' :
          v > 0  ? 'rgba(217,119,6,0.5)' :
                   'rgba(34,169,92,0.3)'
        ),
        borderRadius: 3,
        barPercentage: 0.6,
        yAxisID: 'y2',
      },
    ],
  }

  const opts = {
    ...chartBase,
    scales: {
      ...chartBase.scales,
      y: {
        position: 'left',
        min: 0, max: 100,
        ticks: { color: '#EA580C', font: { family: MONO, size: 9 }, stepSize: 25 },
        grid:  { color: 'rgba(180,200,185,0.3)' },
        border:{ color: 'rgba(180,200,185,0.3)' },
        title: { display: true, text: 'FWI', color: '#EA580C', font: { family: MONO, size: 9 } },
      },
      y2: {
        position: 'right',
        min: 0,
        ticks: { color: 'var(--text-muted)', font: { family: MONO, size: 9 }, stepSize: 5 },
        grid: { drawOnChartArea: false },
        border:{ color: 'rgba(180,200,185,0.3)' },
        title: { display: true, text: 'Events', color: 'var(--text-muted)', font: { family: MONO, size: 9 } },
      },
    },
  }

  return <Line data={data} options={opts} />
}

function ForecastChart({ forecast }) {
  const labels   = forecast.map(d => d.label)
  const fwiData  = forecast.map(d => d.fwi)
  const rainData = forecast.map(d => d.rainProb ?? 0)

  const data = {
    labels,
    datasets: [
      {
        type: 'line',
        label: 'Predicted FWI',
        data: fwiData,
        borderColor: '#DC3545',
        backgroundColor: 'rgba(220,53,69,0.08)',
        borderWidth: 2,
        borderDash: [5, 3],
        pointRadius: 3,
        pointHoverRadius: 6,
        pointBackgroundColor: fwiData.map(v => fwiRisk(v).color),
        fill: true,
        tension: 0.35,
        yAxisID: 'y',
      },
      {
        type: 'bar',
        label: 'Rain Probability (%)',
        data: rainData,
        backgroundColor: 'rgba(59,130,246,0.35)',
        borderColor: 'rgba(59,130,246,0.6)',
        borderWidth: 1,
        borderRadius: 3,
        barPercentage: 0.5,
        yAxisID: 'y2',
      },
    ],
  }

  const opts = {
    ...chartBase,
    scales: {
      ...chartBase.scales,
      y: {
        position: 'left',
        min: 0, max: 100,
        ticks: { color: '#DC3545', font: { family: MONO, size: 9 }, stepSize: 25 },
        grid:  { color: 'rgba(180,200,185,0.3)' },
        border:{ color: 'rgba(180,200,185,0.3)' },
        title: { display: true, text: 'FWI', color: '#DC3545', font: { family: MONO, size: 9 } },
      },
      y2: {
        position: 'right',
        min: 0, max: 100,
        ticks: { color: '#3B82F6', font: { family: MONO, size: 9 }, stepSize: 25 },
        grid:  { drawOnChartArea: false },
        border:{ color: 'rgba(180,200,185,0.3)' },
        title: { display: true, text: 'Rain %', color: '#3B82F6', font: { family: MONO, size: 9 } },
      },
    },
  }

  return <Line data={data} options={opts} />
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------
export default function FirePanel({ zone }) {
  const [fireData, setFireData] = useState(null)
  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState(null)
  const fetchedRef = useRef(false)

  useEffect(() => {
    if (fetchedRef.current) return
    fetchedRef.current = true

    fetchFireData(zone.lat ?? zone.bbox ? (zone.bbox.minLat + zone.bbox.maxLat) / 2 : 20,
                  zone.lon ?? zone.bbox ? (zone.bbox.minLon + zone.bbox.maxLon) / 2 : 78,
                  zone.fire?.count ?? 0)
      .then(data => {
        if (data) setFireData(data)
        else setError('Could not load fire weather data.')
      })
      .catch(err => setError(err.message))
      .finally(() => setLoading(false))
  }, [zone.id])

  if (loading) return (
    <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-muted)' }}>
      <div style={{ fontSize: 24, marginBottom: 10 }}>🔥</div>
      <div style={{ fontFamily: MONO, fontSize: 11 }}>Fetching fire weather data…</div>
    </div>
  )

  if (error || !fireData) return (
    <div className="card" style={{ textAlign: 'center', padding: '32px 20px', color: 'var(--text-muted)' }}>
      <AlertTriangle size={24} style={{ color: '#D97706', marginBottom: 8 }} />
      <div style={{ fontSize: 13 }}>{error ?? 'No fire data available.'}</div>
    </div>
  )

  const { currentFWI, currentRisk, history, forecast, trend, trendSlope, peakFwiDay, riskFactors } = fireData
  const TrendIcon = trend === 'worsening' ? TrendingUp : trend === 'improving' ? TrendingDown : Minus
  const trendColor = trend === 'worsening' ? '#DC3545' : trend === 'improving' ? '#22A95C' : '#D97706'
  const sevenDayForecast = forecast.slice(0, 7)
  const peakForecast7 = sevenDayForecast.reduce((b, d) => !b || d.fwi > b.fwi ? d : b, null)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

      {/* ── Current Status ─────────────────────────────────────── */}
      <div className="card">
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 16 }}>
          <div>
            <div className="card-title" style={{ marginBottom: 4 }}>Current Fire Status</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: MONO }}>
              NASA FIRMS · Open-Meteo FWI · Updated {new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })} IST
            </div>
          </div>
          <RiskBadge fwi={currentFWI} />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 16 }}>

          {/* Active fires */}
          <div style={{ padding: '14px 16px', borderRadius: 12, background: zone.fire?.count > 5 ? 'rgba(220,53,69,0.07)' : 'var(--bg-elevated)', border: `1px solid ${zone.fire?.count > 5 ? '#DC354544' : 'var(--border)'}` }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
              <Flame size={14} color={zone.fire?.count > 5 ? '#DC3545' : '#EA580C'} />
              <span style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: MONO }}>ACTIVE EVENTS</span>
            </div>
            <div style={{ fontSize: 32, fontWeight: 700, fontFamily: MONO, color: zone.fire?.count > 5 ? '#DC3545' : '#EA580C', lineHeight: 1 }}>
              {zone.fire?.count ?? 0}
            </div>
            <div style={{ fontSize: 9, color: 'var(--text-muted)', fontFamily: MONO, marginTop: 4 }}>
              {zone.fire?.count > 10 ? 'Severe outbreak' : zone.fire?.count > 5 ? 'Multiple events' : zone.fire?.count > 0 ? 'Anomalies detected' : 'No active fires'}
            </div>
          </div>

          {/* Fire Weather Index */}
          <div style={{ padding: '14px 16px', borderRadius: 12, background: currentRisk.bg, border: `1px solid ${currentRisk.color}44` }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
              <Thermometer size={14} color={currentRisk.color} />
              <span style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: MONO }}>FIRE WEATHER INDEX</span>
            </div>
            <div style={{ fontSize: 32, fontWeight: 700, fontFamily: MONO, color: currentRisk.color, lineHeight: 1 }}>
              {currentFWI}
            </div>
            <div style={{ fontSize: 9, color: currentRisk.color, fontFamily: MONO, marginTop: 4, fontWeight: 600 }}>
              {currentRisk.label}
            </div>
          </div>

          {/* 7-day outlook */}
          <div style={{ padding: '14px 16px', borderRadius: 12, background: peakForecast7 ? fwiRisk(peakForecast7.fwi).bg : 'var(--bg-elevated)', border: `1px solid ${peakForecast7 ? fwiRisk(peakForecast7.fwi).color + '44' : 'var(--border)'}` }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
              <TrendIcon size={14} color={trendColor} />
              <span style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: MONO }}>7-DAY OUTLOOK</span>
            </div>
            <div style={{ fontSize: 32, fontWeight: 700, fontFamily: MONO, color: peakForecast7 ? fwiRisk(peakForecast7.fwi).color : '#22A95C', lineHeight: 1 }}>
              {peakForecast7?.fwi ?? '—'}
            </div>
            <div style={{ fontSize: 9, color: trendColor, fontFamily: MONO, marginTop: 4, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}>
              <TrendIcon size={10} />
              {trend === 'worsening' ? `Worsening +${Math.abs(trendSlope)}/day` : trend === 'improving' ? `Improving ${trendSlope}/day` : 'Stable conditions'}
            </div>
          </div>

        </div>

        {/* Risk factors */}
        <div style={{ marginBottom: 4 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', fontFamily: MONO, letterSpacing: '.06em', marginBottom: 10 }}>
            CONTRIBUTING RISK FACTORS
          </div>
          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
            <MiniBar label="Temperature"   value={riskFactors.temp}     color="#EA580C" icon={Thermometer} />
            <MiniBar label="Low Humidity"  value={riskFactors.humidity} color="#D97706" icon={Droplets}    />
            <MiniBar label="Wind Speed"    value={riskFactors.wind}     color="#8B5CF6" icon={Wind}         />
            <MiniBar label="Drought"       value={riskFactors.drought}  color="#DC3545" icon={Flame}        />
          </div>
        </div>
      </div>

      {/* ── 30-Day History ─────────────────────────────────────── */}
      <div className="card">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
          <div>
            <div className="card-title" style={{ marginBottom: 2 }}>30-Day Fire History</div>
            <div style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: MONO }}>
              FWI (line) · Fire events (bars) · Events estimated from FWI where FIRMS data unavailable
            </div>
          </div>
        </div>
        <div style={{ height: 220 }}>
          <HistoryChart history={history} />
        </div>
      </div>

      {/* ── 16-Day Forecast ─────────────────────────────────────── */}
      <div className="card">
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 14 }}>
          <div>
            <div className="card-title" style={{ marginBottom: 2 }}>16-Day Fire Risk Forecast</div>
            <div style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: MONO }}>
              Predicted FWI (dashed line) · Rain probability (bars) · Source: Open-Meteo
            </div>
          </div>
          {peakFwiDay && (
            <div style={{
              padding: '6px 12px', borderRadius: 10, fontSize: 10, fontFamily: MONO,
              background: fwiRisk(peakFwiDay.fwi).bg, color: fwiRisk(peakFwiDay.fwi).color,
              fontWeight: 700, flexShrink: 0,
            }}>
              Peak: {peakFwiDay.date} · FWI {peakFwiDay.fwi}
            </div>
          )}
        </div>

        <div style={{ height: 220 }}>
          <ForecastChart forecast={forecast} />
        </div>

        {/* 7-day forecast table */}
        <div style={{ marginTop: 16 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', fontFamily: MONO, letterSpacing: '.06em', marginBottom: 8 }}>
            NEXT 7 DAYS — DETAILED
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 6 }}>
            {sevenDayForecast.map((day, i) => {
              const r = fwiRisk(day.fwi)
              return (
                <div key={i} style={{
                  textAlign: 'center', padding: '8px 4px', borderRadius: 10,
                  background: r.bg, border: `1px solid ${r.color}33`,
                  transition: 'transform .15s', cursor: 'default',
                }}
                  onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-2px)'}
                  onMouseLeave={e => e.currentTarget.style.transform = ''}
                >
                  <div style={{ fontSize: 9, color: 'var(--text-muted)', fontFamily: MONO, marginBottom: 4 }}>
                    {day.label}
                  </div>
                  <div style={{ fontSize: 20, fontWeight: 700, fontFamily: MONO, color: r.color, lineHeight: 1, marginBottom: 4 }}>
                    {day.fwi}
                  </div>
                  <div style={{ fontSize: 8, color: r.color, fontFamily: MONO, fontWeight: 700, marginBottom: 4 }}>
                    {r.short}
                  </div>
                  {day.tempMax != null && (
                    <div style={{ fontSize: 8, color: 'var(--text-muted)', fontFamily: MONO }}>
                      {day.tempMax}°C
                    </div>
                  )}
                  {day.rainProb != null && day.rainProb > 20 && (
                    <div style={{ fontSize: 8, color: '#3B82F6', fontFamily: MONO, marginTop: 2 }}>
                      🌧 {day.rainProb}%
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* ── Methodology note ──────────────────────────────────── */}
      <div style={{
        display: 'flex', alignItems: 'flex-start', gap: 8, padding: '10px 14px',
        borderRadius: 10, background: 'var(--bg-elevated)', border: '1px solid var(--border)',
        fontSize: 10, color: 'var(--text-muted)', lineHeight: 1.6,
      }}>
        <Info size={13} style={{ flexShrink: 0, marginTop: 1, color: '#6B8872' }} />
        <span>
          <strong style={{ color: 'var(--text-secondary)' }}>FWI methodology:</strong> Simplified Canadian Fire Weather Index computed from Open-Meteo daily
          temperature, humidity, wind speed, precipitation, and evapotranspiration.
          Historical fire event counts are estimated from FWI where NASA FIRMS data is unavailable (MAP_KEY limit: 5 days).
          Forecasts use Open-Meteo's 16-day weather model. Not a substitute for official fire authority assessments.
        </span>
      </div>

    </div>
  )
}