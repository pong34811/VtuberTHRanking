import { Outlet } from 'react-router-dom'
import Navbar from './Navbar'

export default function Layout() {
  return (
    <div className="min-h-screen flex flex-col">
      <a className="skip-link" href="#main-content">ข้ามไปยังเนื้อหาหลัก</a>
      <Navbar />
      <main id="main-content" className="flex-1 container mx-auto px-4 py-6 max-w-6xl">
        <Outlet />
      </main>
      <footer className="border-t border-[var(--color-border)] py-4 text-center text-sm text-[var(--color-muted)]">
        Ranking VTuber Thai &copy; {new Date().getFullYear()}
      </footer>
    </div>
  )
}
