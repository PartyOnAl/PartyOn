import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import AdminPlatformAnalysis from './AdminPlatformAnalysis.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AdminPlatformAnalysis />
  </StrictMode>,
)
