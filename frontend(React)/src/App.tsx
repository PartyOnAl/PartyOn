import { BrowserRouter, Route, Routes } from 'react-router-dom'
import EventClicked from './EventClicked'
import Home from './Home'
import LoginPage from './LoginPage'
import Payment from './Payment'
import PaymentMethod from './PaymentMethod'
import Promotions from './Promotions'
import ProtectedRoute from './ProtectedRoute'
import PurchasedTicket from './PurchasedTicket'
import Search from './Search'
import SignupPage from './SignupPage'
import TopClubs from './TopClubs'

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<SignupPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route
          path="/home"
          element={
            <ProtectedRoute>
              <Home />
            </ProtectedRoute>
          }
        />
        <Route path="/search" element={<Search />} />
        <Route path="/payment" element={<Payment />} />
        <Route path="/payment-method" element={<PaymentMethod />} />
        <Route path="/promotions" element={<Promotions />} />
        <Route path="/purchased-ticket" element={<PurchasedTicket />} />
        <Route path="/top-clubs" element={<TopClubs />} />
        <Route path="/event" element={<EventClicked />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
