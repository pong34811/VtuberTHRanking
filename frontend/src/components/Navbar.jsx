import { Link, useLocation } from 'react-router-dom'

export default function Navbar() {
  const { pathname } = useLocation()
  const links = [
    { to: '/', label: 'หน้าหลัก' },
    { to: '/search', label: 'ค้นหา' },
    { to: '/compare', label: 'เปรียบเทียบ' },
  ]

  return (
    <header className="sticky top-0 z-50 bg-[var(--color-bg)]/80 backdrop-blur border-b border-[var(--color-border)]">
      <div className="container mx-auto px-4 max-w-6xl flex items-center justify-between h-14">
        <Link to="/" className="text-lg font-bold text-[var(--color-accent)]">
          🏆 VTuberThai Rankings
        </Link>
        <nav className="flex gap-4">
          {links.map((link) => (
            <Link
              key={link.to}
              to={link.to}
              className={`text-sm px-3 py-1.5 rounded-md transition-colors ${
                pathname === link.to
                  ? 'bg-[var(--color-accent)] text-white'
                  : 'text-[var(--color-muted)] hover:text-[var(--color-text)]'
              }`}
            >
              {link.label}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  )
}
