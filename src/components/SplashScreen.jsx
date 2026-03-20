import { useEffect, useState } from 'react'
import { useTheme } from '../ThemeContext'

export default function SplashScreen({ onComplete }) {
  const [fading, setFading] = useState(false)
  const { theme } = useTheme()

  useEffect(() => {
    // Show splash for 2 sec, then fade out for 0.5s
    const timer1 = setTimeout(() => setFading(true), 1800)
    const timer2 = setTimeout(() => onComplete(), 2300)
    return () => { clearTimeout(timer1); clearTimeout(timer2) }
  }, [onComplete])

  return (
    <div className={`splash-screen ${fading ? 'fade-out' : ''}`}>
      <div className="splash-content">
        <svg className="splash-logo" width="90" height="90" viewBox="0 0 32 32" fill="none">
          <path d="M16 4C12 4 6 10 6 18c0 4 2 6 4 7l5-3V28h2V22l5 3c2-1 4-3 4-7C26 10 20 4 16 4z"
            fill="var(--brand-green)" fillOpacity="0.2" stroke="var(--brand-green)" strokeWidth="1.5" />
          <line x1="16" y1="14" x2="16" y2="28" stroke="var(--brand-green)" strokeWidth="2" strokeDasharray="2 2" />
          <circle cx="16" cy="14" r="2" fill="var(--brand-green)" />
          <circle cx="12" cy="17" r="1.2" fill="var(--brand-green)" fillOpacity="0.7" />
          <circle cx="20" cy="17" r="1.2" fill="var(--brand-green)" fillOpacity="0.7" />
        </svg>
        <h1 className="splash-title">VanDrishti</h1>
        <div className="splash-subtitle">Forest Health Monitoring</div>
        
        <div className="splash-loader">
          <div className="splash-loader-bar"></div>
        </div>
      </div>
      
      <div className="splash-watermark">
        <img 
          src="https://upload.wikimedia.org/wikipedia/commons/5/55/Emblem_of_India.svg" 
          alt="Emblem watermark" 
          style={{ width: 340, opacity: theme === 'dark' ? 0.05 : 0.08, filter: theme === 'dark' ? 'grayscale(1) invert(1) brightness(1.5)' : 'grayscale(1) brightness(0.8)' }}
        />
      </div>
    </div>
  )
}
