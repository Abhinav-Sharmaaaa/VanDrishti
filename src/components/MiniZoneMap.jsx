import { useRef, useEffect } from 'react'
import { useTheme } from '../ThemeContext'

export default function MiniZoneMap({ zone, color, height }) {
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

    ctx.fillStyle = theme === 'dark' ? '#18181b' : '#E2ECE5'
    ctx.fillRect(0, 0, w, h)

    // Terrain dots
    for (let i = 0; i < 200; i++) {
      ctx.fillStyle = `rgba(${160+Math.random()*40}, ${200+Math.random()*30}, ${170+Math.random()*40}, ${0.25+Math.random()*0.25})`
      ctx.fillRect(Math.random()*w, Math.random()*h, 3, 3)
    }

    // Zone polygon
    const cx = w/2, cy = h/2
    const pts = []
    const sides = 5 + Math.floor(Math.random()*2)
    for (let i = 0; i < sides; i++) {
      const angle = (Math.PI * 2 * i / sides) - Math.PI/2
      const r = Math.min(w, h) * 0.3 + Math.random() * Math.min(w, h) * 0.08
      pts.push([cx + Math.cos(angle) * r, cy + Math.sin(angle) * r])
    }

    ctx.beginPath()
    ctx.moveTo(pts[0][0], pts[0][1])
    pts.slice(1).forEach(p => ctx.lineTo(p[0], p[1]))
    ctx.closePath()
    ctx.fillStyle = color + '18'
    ctx.fill()
    ctx.strokeStyle = color
    ctx.lineWidth = 1.5
    ctx.stroke()
  }, [zone, color, theme])

  return (
    <canvas ref={canvasRef} style={{ width: '100%', height: height || 100, display: 'block', borderRadius: 8 }} />
  )
}
