import { useEffect, useState } from "react";
import { adminApi } from "../api";
import { Button, Card, Field, Loading, Notice, useSubmit } from "../ui";

export function SettingsTab({ csrfToken }) {
  const [form, setForm] = useState({
      site_name: "",
      site_status: "active",
      current_ranking_period: "",
      ranking_update_frequency: "manual",
    }),
    [loading, setLoading] = useState(true),
    [loadError, setLoadError] = useState(""),
    [success, setSuccess] = useState(""),
    [retry, setRetry] = useState(0);
  useEffect(() => {
    let active = true;
    setLoading(true);
    setLoadError("");
    adminApi("/settings")
      .then((d) => {
        if (!active) return;
        const obj = {};
        for (const r of d.results || []) obj[r.setting_key] = r.setting_value;
        setForm((f) => ({ ...f, ...obj }));

      })
      .catch((error) => { if (active) setLoadError(error.message); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [retry]);
  const save = useSubmit(() => {
    setSuccess("");
    return adminApi("/settings", { method: "PUT", csrfToken, body: form });
  }, () => setSuccess("บันทึกการตั้งค่าแล้ว"));
  return (
    <Card title="ตั้งค่าเว็บไซต์">
      {loading ? (
        <Loading />
      ) : loadError ? (
        <><Notice>{loadError}</Notice><Button type="button" onClick={() => setRetry(value => value + 1)}>ลองอีกครั้ง</Button></>
      ) : (
        <form onSubmit={save.submit} onChange={() => setSuccess("")}>
          <Notice type={save.error ? "error" : "success"}>
            {save.error || success}
          </Notice>
          <div className="admin-grid">
            <Field label="ชื่อเว็บไซต์">
              <input
                required
                value={form.site_name || ""}
                onChange={(e) =>
                  setForm({ ...form, site_name: e.target.value })
                }
              />
            </Field>
            <Field label="สถานะเว็บไซต์">
              <select
                value={form.site_status}
                onChange={(e) =>
                  setForm({ ...form, site_status: e.target.value })
                }
              >
                <option value="active">เปิดใช้งาน</option>
                <option value="maintenance">ปิดปรับปรุง</option>
              </select>
            </Field>
            <Field label="เดือนอันดับปัจจุบัน">
              <input
                type="month"
                required
                value={form.current_ranking_period || ""}
                onChange={(e) =>
                  setForm({ ...form, current_ranking_period: e.target.value })
                }
              />
            </Field>
            <Field label="ความถี่การอัปเดต">
              <select
                value={form.ranking_update_frequency}
                onChange={(e) =>
                  setForm({ ...form, ranking_update_frequency: e.target.value })
                }
              >
                <option value="manual">ด้วยตนเอง</option>
                <option value="hourly">ทุกชั่วโมง</option>
                <option value="daily">รายวัน</option>
                <option value="weekly">รายสัปดาห์</option>
                <option value="monthly">รายเดือน</option>
              </select>
            </Field>
          </div>
          <Button className="primary" busy={save.busy}>
            บันทึกการตั้งค่า
          </Button>
        </form>
      )}
    </Card>
  );
}

