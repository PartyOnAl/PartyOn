import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import ClubProfile from './ClubProfile.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ClubProfile />
  </StrictMode>,
)
