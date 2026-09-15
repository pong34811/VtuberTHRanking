import { lazy, Suspense } from 'react'
import { Routes, Route } from 'react-router-dom'
import Layout from './components/Layout'

const HomePage = lazy(() => import('./pages/HomePage'))
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
          <Route path="profile/:slug" element={<ProfilePage />} />
          <Route path="compare" element={<ComparePage />} />
          <Route path="search" element={<SearchPage />} />
        </Route>
      </Routes>
    </Suspense>
  )
}

export default App
