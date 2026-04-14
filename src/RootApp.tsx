import App from './App'
import ThumbnailRendererApp from './ThumbnailRendererApp'

export default function RootApp() {
  const params = new URLSearchParams(window.location.search)
  return params.get('thumbnail-renderer') === '1' ? <ThumbnailRendererApp /> : <App />
}
