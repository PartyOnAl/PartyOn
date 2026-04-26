import { useEffect } from 'react'
import { BrowserRouter, Route, Routes, useLocation } from 'react-router-dom'
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
import Success from './Success'
import Cancel from './Cancel'
// Standalone search page — re-enable route below when needed again.
// import Search from './Search'
import ClubDetail from './ClubDetail'
import DjDetail from './DjDetail'
import SignupPage from './SignupPage'
import TopClubs from './TopClubs'
import Success from './Success'
import Cancel from './Cancel'
import { AuthProvider } from './contexts/AuthContext'
import EventPage from './data/EventPage';

function ScrollToTop() {
  const { pathname } = useLocation()
  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' })
  }, [pathname])
  return null
}

function App() {
  return (
    <BrowserRouter>
      <ScrollToTop />
      <AuthProvider>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/signup" element={<SignupPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />
        <Route path="/home" element={<Home />} />
        <Route path="/search" element={<Search />} />
        <Route path="/payment/:id" element={<Payment />} />
        <Route path="/payment-method" element={<PaymentMethod />} />
        <Route path="/promotions" element={<Promotions />} />
        <Route path="/purchased-ticket/:id/:quantity" element={<PurchasedTicket />} />
        <Route path="/top-clubs" element={<TopClubs />} />
        <Route path="/nearby-clubs" element={<TopClubs />} />
        <Route path="/clubs/nearby" element={<TopClubs />} />
        <Route path="/event/:id" element={<EventClicked />} />
        <Route path="/events/:eventId" element={<EventClicked />} />
        <Route path="/event" element={<EventClicked />} />
        <Route path="/header" element={<Header />} />
        <Route path="/footer" element={<Footer />} />
        <Route path="/get-the-app" element={<GetTheApp />} />
        <CatalogProvider>
          <SavedEventsProvider>
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/signup" element={<SignupPage />} />
              <Route path="/login" element={<LoginPage />} />
              <Route path="/reset-password" element={<ResetPasswordPage />} />
              <Route path="/home" element={<Home />} />
              {/* <Route path="/search" element={<Search />} /> */}
              <Route
                path="/search"
                element={<Navigate to={{ pathname: '/', hash: 'events' }} replace />}
              />
              {/* Static `/clubs/*` paths must come before `/clubs/:club_id` */}
              <Route path="/clubs/nearby" element={<TopClubs />} />
              <Route path="/clubs/:club_id" element={<ClubDetail />} />
              <Route path="/club/:id" element={<ClubLegacyRedirect />} />
              <Route path="/dj/:id" element={<DjDetail />} />
              <Route path="/payment" element={<Navigate to="/" replace />} />
              <Route path="/payment/:id" element={<Payment />} />
              <Route path="/payment-method" element={<PaymentMethod />} />
              <Route path="/promotions" element={<Promotions />} />
              <Route path="/promotions/offer/:offerId" element={<PromotionOfferDetailPage />} />
              <Route path="/purchased-ticket" element={<PurchasedTicket />} />
              <Route path="/purchased-ticket/:id/:quantity" element={<PurchasedTicket />} />
              <Route path="/success" element={<Success />} />
              <Route path="/cancel" element={<Cancel />} />
              <Route path="/top-clubs" element={<TopClubs />} />
              <Route path="/nearby-clubs" element={<TopClubs />} />
              <Route path="/event/:id" element={<EventClicked />} />
              <Route path="/events/:eventId" element={<EventClicked />} />
              <Route path="/event" element={<EventClicked />} />
              <Route path="/events-api" element={<EventPage />} />
              <Route path="/header" element={<Header />} />
              <Route path="/footer" element={<Footer />} />
              <Route path="/get-the-app" element={<GetTheApp />} />

        <Route path="/event-clicked" element={<EventClicked />} />
        <Route path="/eventClicked" element={<EventClicked />} />
        <Route path="/topclubs" element={<TopClubs />} />
        <Route path="/purchasedticket" element={<PurchasedTicket />} />
        <Route path="/paymentmethod" element={<PaymentMethod />} />
        <Route path="/success" element={<Success />} />
        <Route path="/cancel" element={<Cancel />} />
      </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}

export default App
