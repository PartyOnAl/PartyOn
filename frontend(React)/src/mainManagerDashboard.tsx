import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import ManagerDashboard from './ManagerDashboard.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ManagerDashboard />
  </StrictMode>,
)
