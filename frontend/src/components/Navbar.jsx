import { Link, useLocation } from "react-router-dom";
import { useEffect, useRef, useState } from "react";
import ThemeSelector from "./ThemeSelector";
export default function Navbar() {
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuButton = useRef(null);
  useEffect(() => setMenuOpen(false), [location.pathname, location.search]);
  const closeMenu = () => {
    setMenuOpen(false);
    if (menuButton.current?.offsetParent) menuButton.current.focus();
  };
  const affiliation = new URLSearchParams(location.search).get("affiliation");
  const rankingPage = ["/home", "/stats"].includes(location.pathname);
  const groupHref = (group = "") => {
    const params = new URLSearchParams(rankingPage ? location.search : "");
    params.delete("offset");
    params.delete("affiliation");
    if (group) params.set("affiliation", group);
    const path = rankingPage ? location.pathname : "/home";
    return `${path}${params.size ? `?${params}` : ""}`;
  };
  const items = [
    ["/", "หน้าแรก", location.pathname === "/"],
    [groupHref(), "จัดอันดับ", rankingPage && !["indie", "agency"].includes(affiliation)],
    [groupHref("indie"), "วีทูปเบอร์อิสระ", rankingPage && affiliation === "indie"],
    [groupHref("agency"), "วีทูปเบอร์สังกัด", rankingPage && affiliation === "agency"],
    ["/discover", "ค้นหา", location.pathname === "/discover"],
  ];
  return (
    <header className="site-header" onKeyDown={event => {
      if (event.key === 'Escape' && menuOpen) { event.preventDefault(); closeMenu(); }
    }}>
      <div className="nav-shell">
        <Link to="/" className="brand">
          <span className="brand-mark">V</span>
          <span>
            VTuber<span className="brand-th">TH</span>
            <small>RANKINGS</small>
          </span>
        </Link>
        <button ref={menuButton} type="button" className="public-menu-toggle" aria-expanded={menuOpen} aria-controls="public-main-menu" onClick={() => setMenuOpen(open => !open)}>
          {menuOpen ? 'ปิดเมนู' : 'เมนู'} <span aria-hidden="true">{menuOpen ? '×' : '☰'}</span>
        </button>
        <nav id="public-main-menu" aria-label="เมนูหลัก" data-open={menuOpen}>
          {items.map(([to, label, active]) => (
            <Link key={to} to={to} onClick={closeMenu} className={active ? "active" : undefined} aria-current={active ? "page" : undefined}>
              {label}
            </Link>
          ))}
        </nav>
        <ThemeSelector />
      </div>
    </header>
  );
}
