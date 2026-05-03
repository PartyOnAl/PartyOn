import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import ClubApproving from './ClubApproving.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ClubApproving />
  </StrictMode>,
)
