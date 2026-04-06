import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import GetTheApp from './GetTheApp.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <GetTheApp />
  </StrictMode>,
)
