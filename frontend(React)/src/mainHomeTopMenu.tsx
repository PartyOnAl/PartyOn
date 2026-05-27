import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import HomeTopMenu from './HomeTopMenu.tsx'
import './Home.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <div className="home">
      <HomeTopMenu />
    </div>
  </StrictMode>,
)
