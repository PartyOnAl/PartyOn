import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import PlatformSettings from './PlatformSettings.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <PlatformSettings />
  </StrictMode>,
)
