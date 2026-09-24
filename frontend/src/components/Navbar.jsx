import { NavLink, Link } from "react-router-dom";
import ThemeSelector from "./ThemeSelector";
export default function Navbar() {
  return (
    <header className="site-header">
      <div className="nav-shell">
        <Link to="/" className="brand">
          <span className="brand-mark">V</span>
          <span>
            VTuber<span className="brand-th">TH</span>
            <small>RANKINGS</small>
          </span>
        </Link>
        <nav aria-label="เมนูหลัก">
          {[
            ["/", "หน้าแรก", "01"],
            ["/stats", "สถิติ", "02"],
            ["/search", "ค้นหา", "03"],
            ["/compare", "เปรียบเทียบ", "04"],
          ].map(([to, label, index]) => (
            <NavLink key={to} to={to} end={to === "/"}>
              <span className="nav-index" aria-hidden="true">{index}</span>
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>
        <ThemeSelector />
      </div>
    </header>
  );
}
