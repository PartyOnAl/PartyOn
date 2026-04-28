import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import Analytics from './Analytics.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Analytics />
  </StrictMode>,
)
