import { useState } from "react";
import { adminApi, downloadReport } from "../api";
import { useList } from "./useList";
import { useRankingCategories } from "./useRankingCategories";
import { Button, Card, Empty, Field, ListState, Loading, Notice, fmtDate, useSubmit } from "../ui";

export function ReportsTab({ csrfToken }) {
  const list = useList("/reports"),
    now = new Date(Date.now() + 7 * 60 * 60 * 1000),
    [form, setForm] = useState({
      period: "monthly",
      month: `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`,
      category: "",
    }),
    [downloadError, setDownloadError] = useState("");
  const configuration = useRankingCategories();
  const category = configuration.choices.find(item => item.id === form.category)?.id || configuration.choices[0]?.id || "";
  const selection = { ...form, category };
  const save = useSubmit(
    () => category && adminApi("/reports", { method: "POST", body: selection, csrfToken }),
    list.load,
    JSON.stringify(selection),
  );
  const download = async (id) => {
    setDownloadError("");
    try {
      await downloadReport(id, csrfToken);
    } catch (e) {
      setDownloadError(e.message);
    }
  };
  const periodLabel = report => report.report_type === "alltime" ? "ตลอดกาล" : "รายเดือน";
  const metricLabel = report => configuration.categories.find(item => item.id === report.category_id)?.name || report.category_id;
  const monthLabel = report => report.report_type === "alltime" ? "ทุกช่วงเวลา" : report.report_period;
  const reportLabel = report => `${periodLabel(report)} · ${metricLabel(report)} · ${monthLabel(report)}`;
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
            value={category}
            disabled={!category}
            onChange={(e) => setForm({ ...form, category: e.target.value })}
          >
            {configuration.choices.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
          </select>
        </Field>
        <Button className="primary" busy={save.busy} disabled={!category}>
          สร้างรายงาน
        </Button>
      </form>
      {configuration.loading ? <Loading /> : configuration.error ? <Notice>{configuration.error} <Button type="button" onClick={configuration.load}>ลองโหลดตัวชี้วัดอีกครั้ง</Button></Notice> : !category ? <Empty>ไม่มีตัวชี้วัดที่เปิดใช้งาน</Empty> : null}
      <Notice>{save.error || downloadError}</Notice>
      <ListState list={list}>
        <div className="admin-table-wrap">
          <table>
            <thead>
              <tr>
                <th>ช่วงเวลา</th>
                <th>ตัวชี้วัด</th>
                <th>เดือน</th>
                <th>จำนวนช่อง</th>
                <th>สร้างเมื่อ</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {list.rows.map((r) => (
                <tr key={r.id}>
                  <td>
                    <strong>{periodLabel(r)}</strong>
                  </td>
                  <td>{metricLabel(r)}</td>
                  <td>{monthLabel(r)}</td>
                  <td>{r.total_vtubers}</td>
                  <td>{fmtDate(r.generated_at)}</td>
                  <td>
                    <button type="button" aria-label={`ดาวน์โหลด CSV ${reportLabel(r)} (${r.id})`} onClick={() => download(r.id)}>
                      ดาวน์โหลด CSV
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </ListState>
    </Card>
  );
}

