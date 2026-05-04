import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import EventManagement from './EventManagement.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <EventManagement />
  </StrictMode>,
)
