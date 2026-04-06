import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import Footer from './Footer.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Footer />
  </StrictMode>,
)
