import { useRef, useEffect } from 'react'
import { useTheme } from '../ThemeContext'

export default function ZoneDetailMap({ zone, height }) {
  const { theme } = useTheme()
  const canvasRef = useRef(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    const dpr = window.devicePixelRatio || 1
    const rect = canvas.getBoundingClientRect()
    canvas.width = rect.width * dpr
    canvas.height = rect.height * dpr
    ctx.scale(dpr, dpr)
    const w = rect.width
    const h = rect.height

    // Light surrounding area
    ctx.fillStyle = theme === 'dark' ? '#18181b' : '#D4DDD7'
    ctx.fillRect(0, 0, w, h)

    // Polygon for the zone
    const margin = 40
    const pts = [
      [margin + w*0.05, margin + h*0.1],
      [w*0.45, margin],
      [w - margin - w*0.05, margin + h*0.15],
      [w - margin, h*0.55],
      [w*0.7, h - margin - h*0.05],
      [w*0.3, h - margin],
      [margin, h*0.6],
    ]

    // Fill zone with terrain
    ctx.save()
    ctx.beginPath()
    ctx.moveTo(pts[0][0], pts[0][1])
    pts.slice(1).forEach(p => ctx.lineTo(p[0], p[1]))
    ctx.closePath()
    ctx.clip()

    // Base fill
    ctx.fillStyle = theme === 'dark' ? '#27272a' : '#C8E6CF'
    ctx.fillRect(0, 0, w, h)

    // NDVI heatmap inside zone
    for (let x = 0; x < w; x += 6) {
      for (let y = 0; y < h; y += 6) {
        const distFromCenter = Math.sqrt(Math.pow((x - w*0.55)/w, 2) + Math.pow((y - h*0.4)/h, 2))
        const noise = Math.random() * 0.3
        const val = Math.min(1, distFromCenter * 1.8 + noise * 0.4)
        
        if (val < 0.4) {
          ctx.fillStyle = `rgba(34, 169, 92, ${0.2 + Math.random()*0.15})`
        } else if (val < 0.65) {
          ctx.fillStyle = `rgba(217, 119, 6, ${0.15 + Math.random()*0.15})`
        } else {
          ctx.fillStyle = `rgba(220, 53, 69, ${0.12 + Math.random()*0.15})`
        }
        ctx.fillRect(x, y, 7, 7)
      }
    }

    // Subtle terrain texture within zone
    for (let i = 0; i < 500; i++) {
      const x = Math.random() * w
      const y = Math.random() * h
      ctx.fillStyle = `rgba(${140+Math.random()*50}, ${190+Math.random()*40}, ${150+Math.random()*50}, ${0.15+Math.random()*0.2})`
      ctx.fillRect(x, y, 3 + Math.random()*5, 3 + Math.random()*5)
    }

    ctx.restore()

    // Zone polygon border
    const colors = {
      'corbett-a': '#D97706',
      'corbett-b': '#22A95C',
      'sundarbans-a': '#22A95C',
      'sundarbans-b': '#C95C0C',
    }
    const zoneColor = colors[zone] || '#D97706'

    ctx.beginPath()
    ctx.moveTo(pts[0][0], pts[0][1])
    pts.slice(1).forEach(p => ctx.lineTo(p[0], p[1]))
    ctx.closePath()
    ctx.strokeStyle = zoneColor
    ctx.lineWidth = 2
    ctx.stroke()

    // Glow
    ctx.strokeStyle = zoneColor
    ctx.lineWidth = 6
    ctx.globalAlpha = 0.2
    ctx.beginPath()
    ctx.moveTo(pts[0][0], pts[0][1])
    pts.slice(1).forEach(p => ctx.lineTo(p[0], p[1]))
    ctx.closePath()
    ctx.stroke()
    ctx.globalAlpha = 1

    // Scale bar
    ctx.fillStyle = 'rgba(100,130,110,0.6)'
    ctx.fillRect(20, h - 30, 60, 2)
    ctx.font = '10px "JetBrains Mono", monospace'
    ctx.textAlign = 'left'
    ctx.fillText('5 km', 25, h - 34)

    // Compass
    ctx.save()
    ctx.translate(w - 35, h - 45)
    ctx.strokeStyle = 'rgba(100,130,110,0.5)'
    ctx.lineWidth = 1.5
    ctx.beginPath(); ctx.moveTo(0, -12); ctx.lineTo(0, 12); ctx.stroke()
    ctx.beginPath(); ctx.moveTo(-12, 0); ctx.lineTo(12, 0); ctx.stroke()
    ctx.fillStyle = 'rgba(27,122,61,0.7)'
    ctx.font = '700 9px "JetBrains Mono", monospace'
    ctx.textAlign = 'center'
    ctx.fillText('N', 0, -16)
    ctx.restore()

  }, [zone, theme])

  return (
    <canvas
      ref={canvasRef}
      className="map-canvas"
      style={{ width: '100%', height: height || '100%' }}
    />
  )
}
