import { lazy, Suspense } from 'react'
import { Routes, Route, Link, Navigate, useLocation } from 'react-router-dom'
import Layout from './components/Layout'
import { hasLegacyRankingQuery } from '../../shared/intro-homepage-routing.js'

const HomePage = lazy(() => import('./pages/HomePage'))
const IntroPage = lazy(() => import('./pages/IntroPage'))
const StatsPage = lazy(() => import('./pages/StatsPage'))
const ProfilePage = lazy(() => import('./pages/ProfilePage'))
const AdminPage = lazy(() => import('./admin/AdminPage'))

function LegacySearchRedirect() {
  const { search } = useLocation()
  return <Navigate to={`/discover${search}`} replace />
}

function IntroRoute() {
  const { search } = useLocation()
  return hasLegacyRankingQuery(search) ? <Navigate to={`/home${search}`} replace /> : <IntroPage />
}

function App() {
  return (
    <Suspense fallback={<div style={{ padding: 32 }}>กำลังโหลด…</div>}>
      <Routes>
        <Route path="/admin/*" element={<AdminPage />} />
        <Route path="/" element={<Layout />}>
          <Route index element={<IntroRoute />} />
          <Route path="home" element={<StatsPage />} />
          <Route path="stats" element={<StatsPage defaultPeriod="monthly" />} />
          <Route path="discover" element={<HomePage />} />
          <Route path="profile/:slug" element={<ProfilePage />} />
          <Route path="search" element={<LegacySearchRedirect />} />
          <Route path="*" element={<div className="empty-state"><h1 className="text-3xl font-semibold">ไม่พบหน้านี้</h1><p>ลิงก์อาจไม่ถูกต้อง หรือหน้านี้ถูกย้ายแล้ว</p><Link className="secondary-button" to="/">กลับหน้าแรก</Link></div>} />
        </Route>
      </Routes>
    </Suspense>
  )
}

export default App
