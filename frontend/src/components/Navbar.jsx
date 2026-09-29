import { Link, useLocation } from "react-router-dom";
import ThemeSelector from "./ThemeSelector";
export default function Navbar() {
  const location = useLocation();
  const affiliation = new URLSearchParams(location.search).get("affiliation");
  const rankingPage = ["/", "/home", "/stats"].includes(location.pathname);
  const items = [
    ["/home", "อันดับทั้งหมด", rankingPage && !["indie", "agency"].includes(affiliation)],
    ["/home?affiliation=indie", "วีทูปเบอร์อิสระ", rankingPage && affiliation === "indie"],
    ["/home?affiliation=agency", "วีทูปเบอร์สังกัด", rankingPage && affiliation === "agency"],
    ["/discover", "ค้นพบ", location.pathname === "/discover"],
    ["/search", "ค้นหา", location.pathname === "/search"],
  ];
  return (
    <header className="site-header">
      <div className="nav-shell">
        <Link to="/home" className="brand">
          <span className="brand-mark">V</span>
          <span>
            VTuber<span className="brand-th">TH</span>
            <small>RANKINGS</small>
          </span>
        </Link>
        <nav aria-label="เมนูหลัก">
          {items.map(([to, label, active]) => (
            <Link key={to} to={to} className={active ? "active" : undefined} aria-current={active ? "page" : undefined}>
              {label}
            </Link>
          ))}
        </nav>
        <ThemeSelector />
      </div>
    </header>
  );
}
