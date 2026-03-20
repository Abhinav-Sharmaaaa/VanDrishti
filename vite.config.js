import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      // OpenWeatherMap — v2.5 is free tier; v3.0 requires a paid subscription
      '/api': {
        target: 'https://api.openweathermap.org',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, '/data/2.5'),
      },

      // NASA FIRMS
      '/firms': {
        target: 'https://firms.modaps.eosdis.nasa.gov',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/firms/, '/api/area/csv'),
      },

      // Sentinel Hub (NDVI + Tree Cover) — blocked by CORS on direct browser calls
      '/sentinel': {
        target: 'https://services.sentinel-hub.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/sentinel/, ''),
      },

      // GBIF — already CORS-friendly but proxying keeps all calls local in dev
      '/gbif': {
        target: 'https://api.gbif.org',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/gbif/, '/v1'),
      },

      // Nominatim (reverse geocoding)
      '/nominatim': {
        target: 'https://nominatim.openstreetmap.org',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/nominatim/, ''),
      },

      // Groq — free LLM API (Llama 3), proxied to avoid CORS
      '/groq': {
        target: 'https://api.groq.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/groq/, ''),
      },
    },
  },
})