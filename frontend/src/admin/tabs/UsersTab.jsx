import { useState } from "react";
import { adminApi } from "../api";
import { useList } from "./useList";
import { Button, Card, Field, Loading, Modal, Notice, fmtDate, useSubmit } from "../ui";

const blankUser = {
  username: "",
  display_name: "",
  email: "",
  role: "staff",
  status: "active",
  password: "",
};
export function UsersTab({ csrfToken, currentUser }) {
  const list = useList("/users"),
    [editing, setEditing] = useState(null);
  return (
    <>
      <Card
        title="ผู้ใช้งาน"
        actions={
          <button
            className="primary"
            onClick={() => setEditing({ ...blankUser })}
          >
            เพิ่มผู้ใช้
          </button>
        }
      >
        <Notice>{list.error}</Notice>
        {list.loading ? (
          <Loading />
        ) : (
          <div className="admin-table-wrap">
            <table>
              <thead>
                <tr>
                  <th>ผู้ใช้</th>
                  <th>สิทธิ์</th>
                  <th>สถานะ</th>
                  <th>เข้าล่าสุด</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {list.rows.map((r) => (
                  <tr key={r.id}>
                    <td>
                      <strong>{r.display_name}</strong>
                      <small>
                        @{r.username} · {r.email}
                      </small>
                    </td>
                    <td>{r.role}</td>
                    <td>{r.status}</td>
                    <td>{fmtDate(r.last_login_at)}</td>
                    <td>
                      <button
                        onClick={() => setEditing({ ...r, password: "" })}
                      >
                        แก้ไข
                      </button>
                      {r.id !== currentUser.id && r.status === "active" && (
                        <QuickDisable
                          row={r}
                          csrfToken={csrfToken}
                          done={list.load}
                        />
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
      {editing && (
        <UserForm
          value={editing}
          csrfToken={csrfToken}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            list.load();
          }}
        />
      )}
    </>
  );
}
function QuickDisable({ row, csrfToken, done }) {
  const save = useSubmit(
    () =>
      adminApi(`/users/${row.id}`, {
        method: "PUT",
        csrfToken,
        body: {
          display_name: row.display_name,
          email: row.email,
          role: row.role,
          status: "inactive",
        },
      }),
    done,
  );
  return (
    <>
      <button className="danger" disabled={save.busy} onClick={save.submit}>
        ปิดใช้งาน
      </button>
      <Notice>{save.error}</Notice>
    </>
  );
}
export function UserForm({ value, csrfToken, onClose, onSaved }) {
  const [form, setForm] = useState(value),
    isEdit = Boolean(value.id);
  // API ปฏิเสธ key นอก user contract (เช่น id, username ตอนแก้ไข, timestamps) ส่งเฉพาะฟิลด์ที่แก้ไขได้
  const payload = Object.fromEntries(
    ['username', 'display_name', 'email', 'role', 'status', 'password']
      .filter(key => !isEdit || key !== 'username')
      .map(key => [key, form[key]]),
  );
  const save = useSubmit(
    () =>
      adminApi(`/users${isEdit ? `/${value.id}` : ""}`, {
        method: isEdit ? "PUT" : "POST",
        csrfToken,
        body: payload,
      }),
    onSaved,
  );
  return (
    <Modal title={isEdit ? "แก้ไขผู้ใช้" : "เพิ่มผู้ใช้"} onClose={onClose}>
      <form onSubmit={save.submit}>
        <Notice>{save.error}</Notice>
        <div className="admin-grid">
          {!isEdit && (
            <Field label="ชื่อผู้ใช้">
              <input
                required
                value={form.username}
                onChange={(e) => setForm({ ...form, username: e.target.value })}
              />
            </Field>
          )}
          <Field label="ชื่อที่แสดง">
            <input
              required
              value={form.display_name}
              onChange={(e) =>
                setForm({ ...form, display_name: e.target.value })
              }
            />
          </Field>
          <Field label="อีเมล">
            <input
              type="email"
              required
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
            />
          </Field>
          <Field label="สิทธิ์">
            <select
              value={form.role}
              onChange={(e) => setForm({ ...form, role: e.target.value })}
            >
              <option value="staff">Staff</option>
              <option value="manager">Manager</option>
            </select>
          </Field>
          <Field label="สถานะ">
            <select
              value={form.status}
              onChange={(e) => setForm({ ...form, status: e.target.value })}
            >
              <option value="active">ใช้งาน</option>
              <option value="inactive">ปิดใช้งาน</option>
            </select>
          </Field>
          <Field label={isEdit ? "รหัสผ่านใหม่ (ไม่บังคับ)" : "รหัสผ่าน"}>
            <input
              type="password"
              autoComplete="new-password"
              minLength="12"
              maxLength="128"
              required={!isEdit}
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
            />
          </Field>
        </div>
        <Button className="primary" busy={save.busy}>
          บันทึก
        </Button>
      </form>
    </Modal>
  );
}

