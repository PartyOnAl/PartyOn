import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import UserManagement from './UserManagement.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <UserManagement />
  </StrictMode>,
)
