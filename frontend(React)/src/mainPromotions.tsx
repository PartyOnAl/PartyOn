import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import Promotions from './Promotions.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Promotions />
  </StrictMode>,
)
