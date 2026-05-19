import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import FeaturedEvents from './FeaturedEvents.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <FeaturedEvents />
  </StrictMode>,
)
