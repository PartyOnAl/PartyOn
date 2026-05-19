import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import PlatformAnalytics from './PlatformAnalytics.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <PlatformAnalytics />
  </StrictMode>,
)
