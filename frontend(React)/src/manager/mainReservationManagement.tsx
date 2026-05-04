import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import ReservationManagement from './ReservationManagement.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ReservationManagement />
  </StrictMode>,
)
