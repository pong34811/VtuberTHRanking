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
            ["/", "อันดับ"],
            ["/search", "ค้นหา"],
            ["/compare", "เปรียบเทียบ"],
          ].map(([to, label]) => (
            <NavLink key={to} to={to} end={to === "/"}>
              {label}
            </NavLink>
          ))}
        </nav>
        <ThemeSelector />
      </div>
    </header>
  );
}
