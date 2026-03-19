export default function LoadingSpinner({ message = 'Fetching live data…' }) {
  return (
    <div className="loading-container">
      <div className="loading-spinner" />
      <div className="loading-text">{message}</div>
      <div className="loading-sources">
        {['Copernicus NDVI', 'NASA FIRMS', 'GBIF', 'eBird', 'Weather', 'GFW'].map(src => (
          <span key={src} className="loading-source-pill">{src}</span>
        ))}
      </div>
    </div>
  )
}
