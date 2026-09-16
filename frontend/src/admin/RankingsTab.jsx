import { useEffect, useState } from "react";
import { adminApi } from "./api";
import {
  Button,
  Card,
  Empty,
  Field,
  Loading,
  Notice,
  fmtNumber,
  useSubmit,
} from "./ui";

const metrics = [
  { value: "followers", label: "ผู้ติดตาม" },
  { value: "views", label: "ยอดดู" },
  { value: "videos", label: "จำนวนคลิป" },
];

export default function RankingsTab({ csrfToken, isManager }) {
  const now = new Date(),
    [filters, setFilters] = useState({
      period: "monthly",
      month: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`,
      category: "all",
    }),
    [rows, setRows] = useState({}),
    [loading, setLoading] = useState(false),
    [error, setError] = useState("");
  const load = () => {
    setLoading(true);
    setError("");
    const selected = filters.category === "all" ? metrics : metrics.filter((metric) => metric.value === filters.category);
    Promise.all(selected.map(async (metric) => {
      const params = new URLSearchParams({ ...filters, category: metric.value });
      const data = await adminApi(`/rankings?${params}`);
      return [metric.value, data.results || []];
    }))
      .then((results) => setRows(Object.fromEntries(results)))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  };
  useEffect(load, [filters.period, filters.month, filters.category]);
  const calc = useSubmit(
    async () => {
      const selected = filters.category === "all" ? metrics : metrics.filter((metric) => metric.value === filters.category);
      for (const metric of selected) {
        await adminApi("/rankings/calculate", {
          method: "POST",
          body: { ...filters, category: metric.value },
          csrfToken,
        });
      }
    },
    load,
  );
  return (
    <Card title="อันดับ">
      <div className="toolbar">
        <Field label="ช่วงเวลา">
          <select
            value={filters.period}
            onChange={(e) => setFilters({ ...filters, period: e.target.value })}
          >
            <option value="monthly">รายเดือน</option>
            <option value="alltime">ตลอดกาล</option>
          </select>
        </Field>
        {filters.period === "monthly" && (
          <Field label="เดือน">
            <input
              type="month"
              value={filters.month}
              onChange={(e) =>
                setFilters({ ...filters, month: e.target.value })
              }
            />
          </Field>
        )}
        <Field label="ตัวชี้วัด">
          <select
            value={filters.category}
            onChange={(e) =>
              setFilters({ ...filters, category: e.target.value })
            }
          >
            <option value="all">ทั้งหมด</option>
            {metrics.map((metric) => <option key={metric.value} value={metric.value}>{metric.label}</option>)}
          </select>
        </Field>
        {isManager && (
          <Button className="primary" busy={calc.busy} onClick={calc.submit}>
            คำนวณอันดับใหม่
          </Button>
        )}
      </div>
      <Notice>{error || calc.error}</Notice>
      {loading ? <Loading /> : metrics.filter((metric) => filters.category === "all" || metric.value === filters.category).map((metric) => (
        <section className="ranking-metric-section" key={metric.value} aria-label={`อันดับตาม${metric.label}`}>
          {filters.category === "all" && <h3>{metric.label}</h3>}
          {rows[metric.value]?.length ? (
        <div className="admin-table-wrap">
          <table>
            <thead>
              <tr>
                <th>อันดับ</th>
                <th>ช่อง</th>
                <th>คะแนน</th>
                <th>เปลี่ยนแปลง</th>
              </tr>
            </thead>
            <tbody>
              {rows[metric.value].map((r, i) => (
                <tr key={r.id || `${r.vtuber_id}-${i}`}>
                  <td>
                    <strong>#{r.rank}</strong>
                  </td>
                  <td>{r.name || r.vtuber_name}</td>
                  <td>
                    {fmtNumber(
                      metric.value === "followers"
                        ? (r.subscriber_count ?? r.followers)
                        : metric.value === "videos"
                          ? (r.video_count ?? 0)
                          : r.total_views,
                    )}
                  </td>
                  <td>
                    {r.rank_change > 0
                      ? `+${r.rank_change}`
                      : (r.rank_change ?? "—")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
          ) : <Empty>ยังไม่มีอันดับสำหรับตัวชี้วัดนี้ในช่วงเวลาที่เลือก</Empty>}
        </section>
      ))}
    </Card>
  );
}
