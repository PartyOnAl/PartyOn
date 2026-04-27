import { useEffect } from 'react'
import {
  BrowserRouter,
  Navigate,
  Route,
  Routes,
  useLocation,
  useParams,
} from 'react-router-dom'
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
import PromotionOfferDetailPage from './PromotionOfferDetailPage'
import PurchasedTicket from './PurchasedTicket'
import MyBookings from './MyBookings'
import ReservationFlow from './ReservationFlow'
import Success from './Success'
import Cancel from './Cancel'
// Standalone search page — re-enable route below when needed again.
// import Search from './Search'
import ClubDetail from './ClubDetail'
import DjDetail from './DjDetail'
import SignupPage from './SignupPage'
import MyProfile from './MyProfile'
import TopClubs from './TopClubs'
import { AuthProvider } from './contexts/AuthContext'
import { CatalogProvider } from './contexts/CatalogContext'
import { SavedEventsProvider } from './contexts/SavedEventsContext'
import EventPage from './data/EventPage'

function ScrollToTop() {
  const { pathname } = useLocation()
  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' })
  }, [pathname])
  return null
}

/** Legacy `/club/:id` → `/clubs/:club_id` */
function ClubLegacyRedirect() {
  const { id } = useParams<{ id: string }>()
  const target = id?.trim() ?? ''
  if (!target) {
    return <Navigate to="/" replace />
  }
  return <Navigate to={`/clubs/${encodeURIComponent(target)}`} replace />
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
              <Route path="/home" element={<Home />} />
              <Route path="/profile" element={<MyProfile />} />
              <Route path="/my-profile" element={<MyProfile />} />
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
              <Route path="/reserve/:id" element={<ReservationFlow />} />
              <Route path="/payment-method" element={<PaymentMethod />} />
              <Route path="/promotions" element={<Promotions />} />
              <Route path="/promotions/offer/:offerId" element={<PromotionOfferDetailPage />} />
              <Route path="/my-bookings" element={<MyBookings />} />
              <Route path="/my-tickets" element={<Navigate to="/my-bookings" replace />} />
              <Route path="/my-bookings/:bookingId" element={<PurchasedTicket />} />
              <Route path="/purchased-ticket" element={<Navigate to="/my-bookings" replace />} />
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
            </Routes>
          </SavedEventsProvider>
        </CatalogProvider>
      </AuthProvider>
    </BrowserRouter>
  )
}

export default App
