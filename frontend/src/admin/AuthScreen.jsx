import { useState } from "react";
import { authApi, messageOf } from "./api";
import { Button, Field, Notice } from "./ui";

export default function AuthScreen({ onAuthenticated }) {
  const [login, setLogin] = useState({ username: "", password: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const submit = async (event) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      onAuthenticated(await authApi("/login", { method: "POST", body: login }));
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
        <h1>เข้าสู่ระบบผู้ดูแล</h1>
        <p>จัดการข้อมูลอันดับ VTuber ไทย</p>
        <Notice>{error}</Notice>
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
            autoComplete="current-password"
            minLength="4"
            required
            value={login.password}
            onChange={(e) => setLogin({ ...login, password: e.target.value })}
          />
        </Field>
        <Button className="primary" busy={busy} type="submit">
          เข้าสู่ระบบ
        </Button>
      </form>
    </main>
  );
}
