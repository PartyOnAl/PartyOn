import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import Search from './Search.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Search />
  </StrictMode>,
)
