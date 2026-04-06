import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import TopClubs from './TopClubs.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <TopClubs />
  </StrictMode>,
)
