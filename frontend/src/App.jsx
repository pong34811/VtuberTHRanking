import { lazy, Suspense } from 'react'
import { Routes, Route } from 'react-router-dom'
import Layout from './components/Layout'
import HomePage from './pages/HomePage'
import ProfilePage from './pages/ProfilePage'
import ComparePage from './pages/ComparePage'
import SearchPage from './pages/SearchPage'

const AdminPage = lazy(() => import('./admin/AdminPage'))

function App() {
  return (
    <Routes>
      <Route path="/admin/*" element={<Suspense fallback={<div style={{ padding: 32 }}>กำลังโหลด…</div>}><AdminPage /></Suspense>} />
      <Route path="/" element={<Layout />}>
        <Route index element={<HomePage />} />
        <Route path="profile/:slug" element={<ProfilePage />} />
        <Route path="compare" element={<ComparePage />} />
        <Route path="search" element={<SearchPage />} />
      </Route>
    </Routes>
  )
}

export default App
