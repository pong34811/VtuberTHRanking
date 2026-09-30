import { lazy, Suspense } from 'react'
import { Routes, Route, Link, Navigate, useLocation } from 'react-router-dom'
import Layout from './components/Layout'

const HomePage = lazy(() => import('./pages/HomePage'))
const StatsPage = lazy(() => import('./pages/StatsPage'))
const ProfilePage = lazy(() => import('./pages/ProfilePage'))
const AdminPage = lazy(() => import('./admin/AdminPage'))

function LegacySearchRedirect() {
  const { search } = useLocation()
  return <Navigate to={`/discover${search}`} replace />
}

function App() {
  return (
    <Suspense fallback={<div style={{ padding: 32 }}>กำลังโหลด…</div>}>
      <Routes>
        <Route path="/admin/*" element={<AdminPage />} />
        <Route path="/" element={<Layout />}>
          <Route index element={<StatsPage />} />
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
