import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import PaymentMethod from './PaymentMethod.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <PaymentMethod />
  </StrictMode>,
)
