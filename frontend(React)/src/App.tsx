import { BrowserRouter, Route, Routes } from 'react-router-dom'
import LoginPage from './LoginPage'
import SignupPage from './SignupPage'

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<SignupPage />} />
        <Route path="/login" element={<LoginPage />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
