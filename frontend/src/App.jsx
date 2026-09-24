import { lazy, Suspense } from 'react'
import { Routes, Route, Link } from 'react-router-dom'
import Layout from './components/Layout'

const HomePage = lazy(() => import('./pages/HomePage'))
const StatsPage = lazy(() => import('./pages/StatsPage'))
const ProfilePage = lazy(() => import('./pages/ProfilePage'))
const ComparePage = lazy(() => import('./pages/ComparePage'))
const SearchPage = lazy(() => import('./pages/SearchPage'))
const AdminPage = lazy(() => import('./admin/AdminPage'))

function App() {
  return (
    <Suspense fallback={<div style={{ padding: 32 }}>กำลังโหลด…</div>}>
      <Routes>
        <Route path="/admin/*" element={<AdminPage />} />
        <Route path="/" element={<Layout />}>
          <Route index element={<HomePage />} />
          <Route path="stats" element={<StatsPage />} />
          <Route path="profile/:slug" element={<ProfilePage />} />
          <Route path="compare" element={<ComparePage />} />
          <Route path="search" element={<SearchPage />} />
          <Route path="*" element={<div className="empty-state"><h1 className="text-3xl font-semibold">ไม่พบหน้านี้</h1><p>ลิงก์อาจไม่ถูกต้อง หรือหน้านี้ถูกย้ายแล้ว</p><Link className="secondary-button" to="/">กลับหน้าแรก</Link></div>} />
        </Route>
      </Routes>
    </Suspense>
  )
}

export default App
