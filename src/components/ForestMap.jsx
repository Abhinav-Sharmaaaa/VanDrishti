import { useRef, useEffect } from 'react'

export default function ForestMap({ zones, activeZone, height }) {
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

    // Light map background
    ctx.fillStyle = '#E2ECE5'
    ctx.fillRect(0, 0, w, h)

    // Draw subtle grid lines
    ctx.strokeStyle = 'rgba(180,200,185,0.5)'
    ctx.lineWidth = 0.5
    for (let x = 0; x < w; x += 40) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke()
    }
    for (let y = 0; y < h; y += 40) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke()
    }

    // Terrain texture (light greens)
    for (let i = 0; i < 800; i++) {
      const x = Math.random() * w
      const y = Math.random() * h
      ctx.fillStyle = `rgba(${160 + Math.random()*40}, ${200 + Math.random()*30}, ${170 + Math.random()*40}, ${0.25 + Math.random()*0.25})`
      ctx.fillRect(x, y, 2 + Math.random()*4, 2 + Math.random()*4)
    }

    // River/water feature
    ctx.beginPath()
    ctx.moveTo(0, h * 0.68)
    ctx.quadraticCurveTo(w * 0.25, h * 0.62, w * 0.4, h * 0.72)
    ctx.quadraticCurveTo(w * 0.6, h * 0.82, w * 0.8, h * 0.75)
    ctx.quadraticCurveTo(w * 0.95, h * 0.7, w, h * 0.73)
    ctx.strokeStyle = 'rgba(100, 180, 220, 0.35)'
    ctx.lineWidth = 8
    ctx.stroke()
    ctx.strokeStyle = 'rgba(80, 160, 200, 0.2)'
    ctx.lineWidth = 3
    ctx.stroke()

    // Draw zones
    const zonePolygons = [
      { 
        id: 'corbett-a', 
        points: [[w*0.18, h*0.22],[w*0.38, h*0.18],[w*0.42, h*0.32],[w*0.35, h*0.45],[w*0.2, h*0.42]],
        color: '#D97706', glowColor: 'rgba(217,119,6,0.12)', status: 'watch'
      },
      { 
        id: 'corbett-b',
        points: [[w*0.5, h*0.15],[w*0.7, h*0.12],[w*0.75, h*0.28],[w*0.65, h*0.38],[w*0.48, h*0.32]],
        color: '#22A95C', glowColor: 'rgba(34,169,92,0.1)', status: 'healthy'
      },
      { 
        id: 'sundarbans-a',
        points: [[w*0.55, h*0.52],[w*0.78, h*0.48],[w*0.85, h*0.65],[w*0.72, h*0.78],[w*0.52, h*0.7]],
        color: '#22A95C', glowColor: 'rgba(34,169,92,0.1)', status: 'healthy'
      },
    ]

    zonePolygons.forEach(zone => {
      const pts = zone.points
      // Fill
      ctx.beginPath()
      ctx.moveTo(pts[0][0], pts[0][1])
      pts.slice(1).forEach(p => ctx.lineTo(p[0], p[1]))
      ctx.closePath()
      ctx.fillStyle = zone.glowColor
      ctx.fill()

      // Border
      ctx.beginPath()
      ctx.moveTo(pts[0][0], pts[0][1])
      pts.slice(1).forEach(p => ctx.lineTo(p[0], p[1]))
      ctx.closePath()
      ctx.strokeStyle = zone.color
      ctx.lineWidth = zone.id === activeZone ? 2.5 : 1.5
      ctx.setLineDash(zone.id === activeZone ? [] : [6,3])
      ctx.stroke()
      ctx.setLineDash([])

      // Zone label
      const cx = pts.reduce((s, p) => s + p[0], 0) / pts.length
      const cy = pts.reduce((s, p) => s + p[1], 0) / pts.length
      ctx.fillStyle = zone.color
      ctx.font = '600 11px "JetBrains Mono", monospace'
      ctx.textAlign = 'center'
      ctx.fillText(zone.id.replace('-', '-').toUpperCase().replace('CORBETT', 'C').replace('SUNDARBANS', 'S'), cx, cy)
    })

    // Coordinate marks
    ctx.fillStyle = 'rgba(100,130,110,0.5)'
    ctx.font = '10px "JetBrains Mono", monospace'
    ctx.textAlign = 'left'
    ctx.fillText('29.5°N', 8, h - 8)
    ctx.fillText('78.8°E', w - 50, h - 8)

  }, [activeZone])

  return (
    <canvas
      ref={canvasRef}
      className="map-canvas"
      style={{ width: '100%', height: height || '100%' }}
    />
  )
}
