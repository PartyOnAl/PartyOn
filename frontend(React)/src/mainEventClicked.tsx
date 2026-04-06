import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import EventClicked from './EventClicked.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <EventClicked />
  </StrictMode>,
)
