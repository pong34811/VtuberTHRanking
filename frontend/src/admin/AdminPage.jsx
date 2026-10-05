import { lazy, Suspense, useCallback, useEffect, useRef, useState } from "react";
import {
  Navigate,
  NavLink,
  Route,
  Routes,
  useLocation,
} from "react-router-dom";
import { authApi, messageOf } from "./api";
import AuthScreen from "./AuthScreen";
import ThemeSelector from "../components/ThemeSelector";
import { Button, Field, Loading, Modal, Notice, useSubmit } from "./ui";
import "./admin.css";

const ChannelsTab = lazy(() => import("./ChannelsTab"));
const AgenciesTab = lazy(() => import("./AgenciesTab"));
const RankingsTab = lazy(() => import("./RankingsTab"));
const AuditTab = lazy(() => import("./tabs/AuditTab").then(module => ({ default: module.AuditTab })));
const CategoriesTab = lazy(() => import("./tabs/CategoriesTab").then(module => ({ default: module.CategoriesTab })));
const ReportsTab = lazy(() => import("./tabs/ReportsTab").then(module => ({ default: module.ReportsTab })));
const SettingsTab = lazy(() => import("./tabs/SettingsTab").then(module => ({ default: module.SettingsTab })));
const HomepageTemplateTab = lazy(() => import("./tabs/HomepageTemplateTab").then(module => ({ default: module.HomepageTemplateTab })));
const IntroHomepageTemplateTab = lazy(() => import("./tabs/IntroHomepageTemplateTab"));
const UsersTab = lazy(() => import("./tabs/UsersTab").then(module => ({ default: module.UsersTab })));

const baseTabs = [
  ["channels", "จัดการช่อง", "CH"],
  ["agencies", "สังกัด", "AG"],
  ["rankings", "จัดอันดับ", "RK"],
  ["categories", "หมวดหมู่", "CT"],
  ["reports", "รายงาน", "RP"],
];
const managerTabs = [
  ["users", "ผู้ใช้งาน", "US"],
  ["history", "ประวัติการทำงาน", "LG"],
  ["homepage", "หน้าค้นพบ", "HP"],
  ["intro-homepage", "หน้าแรก", "IN"],
  ["settings", "ตั้งค่าระบบ", "ST"],
];

function AdminNav({ tabs, managerStart }) {
  return (
    <nav aria-label="เมนูผู้ดูแล">
      <p className="admin-nav-label">พื้นที่ทำงาน</p>
      {tabs.map(([key, label, glyph], index) => (
        <span className="admin-nav-item" key={key}>
          {index === managerStart && (
            <span className="admin-nav-label admin-nav-divider">ระบบ</span>
          )}
          <NavLink
            to={"/admin/" + key}
            className={({ isActive }) => (isActive ? "active" : "")}
          >
            <i aria-hidden="true">{glyph}</i>
            <span>{label}</span>
          </NavLink>
        </span>
      ))}
    </nav>
  );
}

export default function AdminPage() {
  const [session, setSession] = useState(null),
    [setupRequired, setSetupRequired] = useState(false),
    [checking, setChecking] = useState(true),
    [passwordOpen, setPasswordOpen] = useState(false),
    [authError, setAuthError] = useState(""),
    [logoutError, setLogoutError] = useState("");
  const loc = useLocation();
  const authRequest = useRef({ id: 0, controller: null });
  const check = useCallback(() => {
    authRequest.current.controller?.abort();
    const controller = new AbortController();
    const id = ++authRequest.current.id;
    authRequest.current.controller = controller;
    const current = () => authRequest.current.id === id;
    setChecking(true);
    setAuthError("");
    authApi("/me", { signal: controller.signal })
      .then((data) => {
        if (!data.user || !["manager", "staff"].includes(data.user.role) || typeof data.csrfToken !== "string") {
          throw new Error("เซิร์ฟเวอร์ตอบกลับไม่ถูกต้อง กรุณาลองใหม่");
        }
        if (current()) { setSession(data); setSetupRequired(false); }
      })
      .catch((error) => {
        if (!current() || error.name === "AbortError") return;
        if (error.status === 401) {
          setSession(null);
          setPasswordOpen(false);
          setSetupRequired(error.data?.setupRequired === true);
        } else setAuthError(messageOf(error));
      })
      .finally(() => { if (current()) setChecking(false); });
  }, []);
  useEffect(() => {
    check();
    const unauthorized = () => check();
    window.addEventListener("admin:unauthorized", unauthorized);
    return () => {
      window.removeEventListener("admin:unauthorized", unauthorized);
      authRequest.current.id += 1;
      authRequest.current.controller?.abort();
    };
  }, [check]);
  if (checking)
    return <div className="admin-boot">กำลังตรวจสอบการเข้าสู่ระบบ…</div>;
  if (authError) return <main className="admin-auth"><section className="admin-card">
    <h1>ตรวจสอบการเข้าสู่ระบบไม่สำเร็จ</h1>
    <Notice>{authError}</Notice>
    <Button type="button" onClick={check}>ลองอีกครั้ง</Button>
  </section></main>;
  if (!session?.user) return <AuthScreen setupRequired={setupRequired} onAuthenticated={(data) => { setSession(data); setSetupRequired(false); }} />;
  const { user, csrfToken } = session,
    isManager = user.role === "manager",
    tabs = isManager ? [...baseTabs, ...managerTabs] : baseTabs;
  const logout = async () => {
    setLogoutError("");
    try {
      await authApi("/logout", { method: "POST", csrfToken });
      setSession(null);
    } catch (error) {
      setLogoutError(error.message || "ออกจากระบบไม่สำเร็จ กรุณาลองอีกครั้ง");
    }
  };
  const props = { csrfToken, isManager, currentUser: user };
  const current = loc.pathname.split("/").pop();
  const title = tabs.find(([key]) => key === current)?.[1] || "";
  const guard = (element) =>
    isManager ? element : <Navigate to="../channels" replace />;
  return (
    <div className="admin-app">
      <aside>
        <a className="admin-brand" href="/">
          <b>VT</b>
          <span>
            VTuberTH<small>CONTROL CENTER</small>
          </span>
        </a>
        <AdminNav tabs={tabs} managerStart={isManager ? baseTabs.length : -1} />
        <div className="admin-user">
          <span className="admin-user-avatar" aria-hidden="true">
            {(user.display_name || user.username).charAt(0).toUpperCase()}
          </span>
          <div>
            <strong>{user.display_name || user.username}</strong>
            <small>
              {user.role === "manager" ? "ผู้จัดการระบบ" : "เจ้าหน้าที่"}
            </small>
          </div>
          <div className="admin-user-actions">
            <ThemeSelector />
            <button onClick={() => setPasswordOpen(true)}>เปลี่ยนรหัสผ่าน</button>
            <button onClick={logout}>ออกจากระบบ</button>
          </div>
        </div>
      </aside>
      <main>
        <header className="admin-top">
          <div>
            <p>
              ADMIN CONSOLE <span>/</span> {title}
            </p>
            <h1>{title}</h1>
          </div>
          <div className="admin-mobile-account" role="group" aria-label="บัญชีผู้ใช้บนมือถือ">
            <ThemeSelector />
            <button type="button" onClick={() => setPasswordOpen(true)}>เปลี่ยนรหัสผ่าน</button>
            <button type="button" onClick={logout}>ออกจากระบบ</button>
          </div>
        </header>
        <Notice>{logoutError}</Notice>
        <Suspense fallback={<Loading />}>
        <Routes>
          <Route index element={<Navigate to="channels" replace />} />
          <Route path="channels" element={<ChannelsTab {...props} />} />
          <Route path="agencies" element={<AgenciesTab {...props} />} />
          <Route path="rankings" element={<RankingsTab {...props} />} />
          <Route path="categories" element={<CategoriesTab {...props} />} />
          <Route path="reports" element={<ReportsTab {...props} />} />
          <Route path="users" element={guard(<UsersTab {...props} />)} />
          <Route path="history" element={guard(<AuditTab />)} />
          <Route path="homepage" element={guard(<HomepageTemplateTab {...props} />)} />
          <Route path="intro-homepage" element={guard(<IntroHomepageTemplateTab {...props} />)} />
          <Route path="settings" element={guard(<SettingsTab {...props} />)} />
          <Route path="*" element={<Navigate to="channels" replace />} />
        </Routes>
        </Suspense>
      </main>
      {passwordOpen && (
        <PasswordForm
          csrfToken={csrfToken}
          onClose={() => setPasswordOpen(false)}
        />
      )}
    </div>
  );
}
function PasswordForm({ csrfToken, onClose }) {
  const [form, setForm] = useState({ currentPassword: "", newPassword: "" }),
    [success, setSuccess] = useState("");
  const save = useSubmit(
    () => authApi("/password", { method: "POST", csrfToken, body: form }),
    () => {
      setSuccess("เปลี่ยนรหัสผ่านแล้ว กรุณาเข้าสู่ระบบอีกครั้ง");
      setTimeout(
        () => window.dispatchEvent(new Event("admin:unauthorized")),
        900,
      );
    },
  );
  return (
    <Modal title="เปลี่ยนรหัสผ่าน" onClose={onClose}>
      <form onSubmit={save.submit}>
        <Notice>{save.error}</Notice>
        <Notice type="success">{success}</Notice>
        <Field label="รหัสผ่านปัจจุบัน">
          <input
            type="password"
            autoComplete="current-password"
            required
            value={form.currentPassword}
            onChange={(e) =>
              setForm({ ...form, currentPassword: e.target.value })
            }
          />
        </Field>
        <Field label="รหัสผ่านใหม่">
          <input
            type="password"
            autoComplete="new-password"
            minLength="12"
            maxLength="128"
            required
            value={form.newPassword}
            onChange={(e) => setForm({ ...form, newPassword: e.target.value })}
          />
        </Field>
        <Button className="primary" busy={save.busy}>
          เปลี่ยนรหัสผ่าน
        </Button>
      </form>
    </Modal>
  );
}
