import { useEffect } from 'react'
import {
  BrowserRouter,
  Navigate,
  Route,
  Routes,
  useLocation,
  useNavigate,
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
import Events from './Events'
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
import UserSettings from './UserSettings'
import TopClubs from './TopClubs'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import { CatalogProvider } from './contexts/CatalogContext'
import { SavedEventsProvider } from './contexts/SavedEventsContext'
import EventPage from './data/EventPage'
import ManagerRoute from './manager/ManagerRoute'
import ManagerDashboard from './manager/ManagerDashboard'
import ClubProfile from './manager/ClubProfile'
import EventManagement from './manager/EventManagement'
import ReservationManagement from './manager/ReservationManagement'
import ManagerPromotions from './manager/ManagerPromotions'
import ManagerAnalytics from './manager/ManagerAnalytics'
import ManagerStaffApproval from './manager/ManagerStaffApproval'
import ManagerDisputes from './manager/ManagerDisputes'
import ManagerSettings from './manager/ManagerSettings'
import ManagerProfile from './manager/ManagerProfile'
import TableManagement from './manager/TableManagement'
import AdminRoute from './admin/AdminRoute'
import AdminPlatformAnalysis from './admin/AdminPlatformAnalysis'
import ClubApproving from './admin/ClubApproving'
import UserManagement from './admin/UserManagement'
import RevenueAndPayments from './admin/RevenueAndPayments'
import StaffMustChangePasswordPage from './StaffMustChangePasswordPage'
import StaffMobileOnlyPage from './StaffMobileOnlyPage'
import TermsOfService from './TermsOfService'
import PrivacyPolicy from './PrivacyPolicy'
import HelpCenter from './HelpCenter'
import { userMustChangePassword } from './lib/mustChangePassword'
import { getStaffRoleFromUser, isMobileOnlyStaffRole } from './lib/staffRoles'
import { isSupabaseConfigured, supabase } from './lib/supabase'

function MustChangePasswordGuard() {
  const { user, isLoading } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()

  useEffect(() => {
    if (isLoading) return
    if (!userMustChangePassword(user)) return
    const path = location.pathname
    if (
      path === '/staff/change-password' ||
      path === '/login' ||
      path === '/signup' ||
      path === '/reset-password'
    ) {
      return
    }
    navigate('/staff/change-password', { replace: true })
  }, [user, isLoading, location.pathname, navigate])

  return null
}

function WebStaffAccessGuard() {
  const { user, profile, isLoading } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const isManagerPath =
    location.pathname.startsWith('/manager') || location.pathname.startsWith('/admin')

  useEffect(() => {
    if (isLoading) return
    if (isManagerPath) return

    const roleNorm = String(profile?.role ?? '').toLowerCase().trim()
    const isAdminRole =
      roleNorm === 'admin' || roleNorm === 'superadmin' || roleNorm === 'super_admin'
    if (isAdminRole) {
      navigate('/admin/platform-analysis', { replace: true })
      return
    }

    const staffRole = getStaffRoleFromUser(user ?? null)
    if (!staffRole) return

    const path = location.pathname
    if (
      path === '/staff/mobile-only' ||
      path === '/login' ||
      path === '/signup' ||
      path === '/reset-password' ||
      path === '/staff/change-password'
    ) {
      return
    }

    if (!supabase || !isSupabaseConfigured) return

    if (isMobileOnlyStaffRole(staffRole)) {
      void supabase.auth.signOut({ scope: 'local' })
      navigate('/staff/mobile-only', { replace: true })
      return
    }

    void supabase.auth.signOut({ scope: 'local' })
    navigate('/login', { replace: true, state: { staffWebBlocked: true } })
  }, [user, profile, isLoading, location.pathname, isManagerPath, navigate])

  return null
}

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
            <MustChangePasswordGuard />
            <WebStaffAccessGuard />
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/signup" element={<SignupPage />} />
              <Route path="/login" element={<LoginPage />} />
              <Route path="/staff/change-password" element={<StaffMustChangePasswordPage />} />
              <Route path="/staff/mobile-only" element={<StaffMobileOnlyPage />} />
              <Route path="/reset-password" element={<ResetPasswordPage />} />
              <Route path="/home" element={<Home />} />
              <Route path="/profile" element={<MyProfile />} />
              <Route path="/my-profile" element={<MyProfile />} />
              <Route path="/settings" element={<UserSettings />} />
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
              <Route path="/events" element={<Events />} />
              <Route path="/events/:eventId" element={<EventClicked />} />
              <Route path="/event" element={<EventClicked />} />
              <Route path="/events-api" element={<EventPage />} />
              <Route
                path="/manager/dashboard"
                element={<ManagerRoute><ManagerDashboard /></ManagerRoute>}
              />
              <Route
                path="/manager/club-profile"
                element={<ManagerRoute><ClubProfile /></ManagerRoute>}
              />
              <Route
                path="/manager/events"
                element={<ManagerRoute><EventManagement /></ManagerRoute>}
              />
              <Route
                path="/manager/reservations"
                element={<ManagerRoute><ReservationManagement /></ManagerRoute>}
              />
              <Route
                path="/manager/tables"
                element={<ManagerRoute><TableManagement /></ManagerRoute>}
              />
              <Route
                path="/manager/promotions"
                element={<ManagerRoute><ManagerPromotions /></ManagerRoute>}
              />
              <Route
                path="/manager/analytics"
                element={<ManagerRoute><ManagerAnalytics /></ManagerRoute>}
              />
              <Route
                path="/manager/staff-approval"
                element={<ManagerRoute><ManagerStaffApproval /></ManagerRoute>}
              />
              <Route
                path="/manager/disputes"
                element={<ManagerRoute><ManagerDisputes /></ManagerRoute>}
              />
              <Route
                path="/manager/settings"
                element={<ManagerRoute><ManagerSettings /></ManagerRoute>}
              />
              <Route
                path="/manager/profile"
                element={<ManagerRoute><ManagerProfile /></ManagerRoute>}
              />
              <Route
                path="/admin/platform-analysis"
                element={<AdminRoute><AdminPlatformAnalysis /></AdminRoute>}
              />
              <Route
                path="/admin/club-approvals"
                element={<AdminRoute><ClubApproving /></AdminRoute>}
              />
              <Route
                path="/admin/user-management"
                element={<AdminRoute><UserManagement /></AdminRoute>}
              />
              <Route
                path="/admin/revenue-payments"
                element={<AdminRoute><RevenueAndPayments /></AdminRoute>}
              />

              <Route path="/terms" element={<TermsOfService />} />
              <Route path="/privacy" element={<PrivacyPolicy />} />
              <Route path="/help" element={<HelpCenter />} />

              <Route path="/header" element={<Header />} />
              <Route path="/footer" element={<Footer />} />
              <Route path="/get-the-app" element={<GetTheApp />} />

              <Route path="/event-clicked" element={<EventClicked />} />
              <Route path="/eventClicked" element={<EventClicked />} />
              <Route path="/topclubs" element={<TopClubs />} />
              <Route path="/purchasedticket" element={<PurchasedTicket />} />
            </Routes>
          </SavedEventsProvider>
        </CatalogProvider>
      </AuthProvider>
    </BrowserRouter>
  )
}

export default App
