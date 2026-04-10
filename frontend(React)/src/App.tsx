import { BrowserRouter, Route, Routes } from 'react-router-dom'
import EventClicked from './EventClicked'
import Footer from './Footer'
import GetTheApp from './GetTheApp'
import Header from './Header'
import Home from './Home'
import LoginPage from './LoginPage'
import ResetPasswordPage from './ResetPasswordPage'
import Payment from './Payment'
import PaymentMethod from './PaymentMethod'
import Promotions from './Promotions'
import PurchasedTicket from './PurchasedTicket'
import Search from './Search'
import SignupPage from './SignupPage'
import TopClubs from './TopClubs'
import { AuthProvider } from './contexts/AuthContext'

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/signup" element={<SignupPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />
        <Route path="/home" element={<Home />} />
        <Route path="/search" element={<Search />} />
        <Route path="/payment" element={<Payment />} />
        <Route path="/payment-method" element={<PaymentMethod />} />
        <Route path="/promotions" element={<Promotions />} />
        <Route path="/purchased-ticket" element={<PurchasedTicket />} />
        <Route path="/top-clubs" element={<TopClubs />} />
        <Route path="/event/:id" element={<EventClicked />} />
        <Route path="/events/:eventId" element={<EventClicked />} />
        <Route path="/event" element={<EventClicked />} />
        <Route path="/header" element={<Header />} />
        <Route path="/footer" element={<Footer />} />
        <Route path="/get-the-app" element={<GetTheApp />} />

        <Route path="/event-clicked" element={<EventClicked />} />
        <Route path="/eventClicked" element={<EventClicked />} />
        <Route path="/topclubs" element={<TopClubs />} />
        <Route path="/purchasedticket" element={<PurchasedTicket />} />
        <Route path="/paymentmethod" element={<PaymentMethod />} />
      </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}

export default App
