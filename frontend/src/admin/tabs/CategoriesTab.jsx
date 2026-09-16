import { useState } from "react";
import { adminApi } from "../api";
import { useList } from "./useList";
import { Button, Card, Field, Loading, Modal, Notice, useSubmit } from "../ui";

export function CategoriesTab({ csrfToken }) {
  const list = useList("/categories"),
    [editing, setEditing] = useState(null);
  return (
    <>
      <Card title="หมวดหมู่อันดับ">
        <Notice>{list.error}</Notice>
        {list.loading ? (
          <Loading />
        ) : (
          <div className="admin-table-wrap">
            <table>
              <thead>
                <tr>
                  <th>หมวดหมู่</th>
                  <th>Slug</th>
                  <th>ลำดับ</th>
                  <th>สถานะ</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {list.rows.map((r) => (
                  <tr key={r.id}>
                    <td>
                      <strong>{r.name}</strong>
                      <small>{r.description}</small>
                    </td>
                    <td>{r.slug}</td>
                    <td>{r.sort_order}</td>
                    <td>{r.status}</td>
                    <td>
                      <button onClick={() => setEditing(r)}>แก้ไข</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
      {editing && (
        <CategoryForm
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
function CategoryForm({ value, csrfToken, onClose, onSaved }) {
  const [form, setForm] = useState(value);
  const save = useSubmit(
    () =>
      adminApi(`/categories/${value.id}`, {
        method: "PUT",
        body: form,
        csrfToken,
      }),
    onSaved,
  );
  return (
    <Modal title="แก้ไขหมวดหมู่" onClose={onClose}>
      <form onSubmit={save.submit}>
        <Notice>{save.error}</Notice>
        <div className="admin-grid">
          <Field label="ชื่อ">
            <input
              required
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </Field>
          <Field label="Slug">
            <input
              required
              value={form.slug}
              onChange={(e) => setForm({ ...form, slug: e.target.value })}
            />
          </Field>
          <Field label="ลำดับ">
            <input
              type="number"
              required
              value={form.sort_order}
              onChange={(e) =>
                setForm({ ...form, sort_order: Number(e.target.value) })
              }
            />
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
          <Field label="คำอธิบาย" wide>
            <textarea
              value={form.description || ""}
              onChange={(e) =>
                setForm({ ...form, description: e.target.value })
              }
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

