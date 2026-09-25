import { useState } from "react";
import { authApi, messageOf } from "./api";
import { Button, Field, Notice } from "./ui";

export default function AuthScreen({ onAuthenticated, setupRequired = false }) {
  const [login, setLogin] = useState({ username: "", password: "", setupToken: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const submit = async (event) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const body = { username: login.username, password: login.password };
      if (setupRequired) body.setupToken = login.setupToken;
      onAuthenticated(await authApi(setupRequired ? "/setup" : "/login", { method: "POST", body }));
    } catch (err) {
      setError(messageOf(err));
    } finally {
      setBusy(false);
    }
  };
  return (
    <main className="admin-auth">
      <form className="admin-card" onSubmit={submit}>
        <div className="admin-logo">VT</div>
        <h1>{setupRequired ? "ตั้งค่าผู้ดูแลคนแรก" : "เข้าสู่ระบบผู้ดูแล"}</h1>
        <p>{setupRequired ? "กรอกรหัสตั้งค่าและสร้างบัญชีสำหรับจัดการเว็บไซต์" : "จัดการข้อมูลอันดับ VTuber ไทย"}</p>
        <Notice>{error}</Notice>
        {setupRequired && <Field label="รหัสตั้งค่า">
          <input
            type="password"
            autoComplete="off"
            required
            value={login.setupToken}
            onChange={(e) => setLogin({ ...login, setupToken: e.target.value })}
          />
        </Field>}
        <Field label="ชื่อผู้ใช้">
          <input
            autoComplete="username"
            required
            value={login.username}
            onChange={(e) => setLogin({ ...login, username: e.target.value })}
          />
        </Field>
        <Field label="รหัสผ่าน">
          <input
            type="password"
            autoComplete={setupRequired ? "new-password" : "current-password"}
            minLength={setupRequired ? 12 : 4}
            maxLength="128"
            required
            value={login.password}
            onChange={(e) => setLogin({ ...login, password: e.target.value })}
          />
        </Field>
        <Button className="primary" busy={busy} type="submit">
          {setupRequired ? "สร้างบัญชีผู้ดูแล" : "เข้าสู่ระบบ"}
        </Button>
      </form>
    </main>
  );
}
