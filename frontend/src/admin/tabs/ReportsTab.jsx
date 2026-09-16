import { useState } from "react";
import { adminApi, downloadReport } from "../api";
import { useList } from "./useList";
import { Button, Card, Empty, Field, Loading, Notice, fmtDate, useSubmit } from "../ui";

export function ReportsTab({ csrfToken }) {
  const list = useList("/reports"),
    now = new Date(),
    [form, setForm] = useState({
      period: "monthly",
      month: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`,
      category: "followers",
    }),
    [downloadError, setDownloadError] = useState("");
  const save = useSubmit(
    () => adminApi("/reports", { method: "POST", body: form, csrfToken }),
    list.load,
  );
  const download = async (id) => {
    setDownloadError("");
    try {
      await downloadReport(id, csrfToken);
    } catch (e) {
      setDownloadError(e.message);
    }
  };
  return (
    <Card title="รายงาน">
      <form className="toolbar" onSubmit={save.submit}>
        <Field label="ช่วงเวลา">
          <select
            value={form.period}
            onChange={(e) => setForm({ ...form, period: e.target.value })}
          >
            <option value="monthly">รายเดือน</option>
            <option value="alltime">ตลอดกาล</option>
          </select>
        </Field>
        {form.period === "monthly" && (
          <Field label="เดือน">
            <input
              type="month"
              required
              value={form.month}
              onChange={(e) => setForm({ ...form, month: e.target.value })}
            />
          </Field>
        )}
        <Field label="ตัวชี้วัด">
          <select
            value={form.category}
            onChange={(e) => setForm({ ...form, category: e.target.value })}
          >
            <option value="followers">ผู้ติดตาม</option>
            <option value="views">ยอดดู</option>
            <option value="videos">จำนวนคลิป</option>
          </select>
        </Field>
        <Button className="primary" busy={save.busy}>
          สร้างรายงาน
        </Button>
      </form>
      <Notice>{list.error || save.error || downloadError}</Notice>
      {list.loading ? (
        <Loading />
      ) : list.rows.length ? (
        <div className="admin-table-wrap">
          <table>
            <thead>
              <tr>
                <th>รายงาน</th>
                <th>จำนวนช่อง</th>
                <th>สร้างเมื่อ</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {list.rows.map((r) => (
                <tr key={r.id}>
                  <td>
                    <strong>{r.report_type || r.category_id}</strong>
                    <small>{r.report_period}</small>
                  </td>
                  <td>{r.total_vtubers}</td>
                  <td>{fmtDate(r.generated_at)}</td>
                  <td>
                    <button onClick={() => download(r.id)}>
                      ดาวน์โหลด CSV
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <Empty />
      )}
    </Card>
  );
}

