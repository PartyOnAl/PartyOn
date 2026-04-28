import { useEffect } from 'react'
import { BrowserRouter, Route, Routes, useLocation, Navigate } from 'react-router-dom'

import Home from './Home'
import SignupPage from './SignupPage'
import LoginPage from './LoginPage'
import ResetPasswordPage from './ResetPasswordPage'
import Payment from './Payment'
import PaymentMethod from './PaymentMethod'
import Promotions from './Promotions'
import PurchasedTicket from './PurchasedTicket'
import Search from './Search'
import ClubDetail from './ClubDetail'
import DjDetail from './DjDetail'
import TopClubs from './TopClubs'
import Success from './Success'
import Cancel from './Cancel'
import EventClicked from './EventClicked'
import Header from './Header'
import Footer from './Footer'
import GetTheApp from './GetTheApp'

import { AuthProvider } from './contexts/AuthContext'
import { CatalogProvider } from './contexts/CatalogContext'
import { SavedEventsProvider } from './contexts/SavedEventsContext'

function ScrollToTop() {
  const { pathname } = useLocation()
  useEffect(() => {
    window.scrollTo({ top: 0, left: 0 })
  }, [pathname])
  return null
}

function App() {
  return (
    <BrowserRouter>
      <ScrollToTop />

      <AuthProvider>
        <CatalogProvider>
          <SavedEventsProvider>

            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/signup" element={<SignupPage />} />
              <Route path="/login" element={<LoginPage />} />
              <Route path="/reset-password" element={<ResetPasswordPage />} />

              <Route path="/search" element={<Search />} />

              <Route path="/clubs/nearby" element={<TopClubs />} />
              <Route path="/clubs/:club_id" element={<ClubDetail />} />

              <Route path="/dj/:id" element={<DjDetail />} />

              <Route path="/payment/:id" element={<Payment />} />
              <Route path="/payment-method" element={<PaymentMethod />} />

              <Route path="/promotions" element={<Promotions />} />

              <Route path="/purchased-ticket/:id/:quantity" element={<PurchasedTicket />} />

              <Route path="/event/:id" element={<EventClicked />} />

              <Route path="/success" element={<Success />} />
              <Route path="/cancel" element={<Cancel />} />

              <Route path="/top-clubs" element={<TopClubs />} />

              <Route path="/header" element={<Header />} />
              <Route path="/footer" element={<Footer />} />
              <Route path="/get-the-app" element={<GetTheApp />} />

              {/* fallback */}
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>

          </SavedEventsProvider>
        </CatalogProvider>
      </AuthProvider>

    </BrowserRouter>
  )
}

export default App