import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import PurchasedTicket from './PurchasedTicket.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <PurchasedTicket />
  </StrictMode>,
)
