import { useEffect, useRef, useState } from "react";
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

function rankChangeLabel(value) {
  if (value == null) return "ไม่มีอันดับก่อนหน้า";
  const change = Number(value);
  if (!Number.isFinite(change)) return "ไม่ระบุการเปลี่ยนแปลง";
  if (change === 0) return "ไม่เปลี่ยน";
  return change > 0 ? `ขึ้น ${change}` : `ลง ${Math.abs(change)}`;
}

export default function RankingsTab({ csrfToken, isManager }) {
  const bangkokNow = new Date(Date.now() + 7 * 60 * 60 * 1000);
  const [filters, setFilters] = useState({
    period: "monthly",
    month: `${bangkokNow.getUTCFullYear()}-${String(bangkokNow.getUTCMonth() + 1).padStart(2, "0")}`,
    category: "followers",
  });
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const requestId = useRef(0);

  const load = async () => {
    const id = ++requestId.current;
    setLoading(true);
    setError("");
    setRows([]);
    try {
      const params = new URLSearchParams(filters);
      const data = await adminApi(`/rankings?${params}`);
      if (id === requestId.current) setRows(data.results || []);
    } catch (loadError) {
      if (id === requestId.current) setError(loadError.message);
    } finally {
      if (id === requestId.current) setLoading(false);
    }
  };

  useEffect(() => {
    load();
    return () => { requestId.current += 1; };
  }, [filters.period, filters.month, filters.category]);

  const calc = useSubmit(
    async () => adminApi("/rankings/calculate", {
      method: "POST",
      body: filters,
      csrfToken,
    }),
    load,
  );

  const metric = metrics.find((item) => item.value === filters.category) || metrics[0];

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
              onChange={(e) => setFilters({ ...filters, month: e.target.value })}
            />
          </Field>
        )}
        <div className="ranking-metric-control" role="group" aria-label="ตัวชี้วัด">
          <span>ตัวชี้วัด</span>
          <div>
            {metrics.map((item) => (
              <button
                key={item.value}
                type="button"
                aria-pressed={filters.category === item.value}
                onClick={() => setFilters({ ...filters, category: item.value })}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>
        {isManager && (
          <Button className="primary" busy={calc.busy} onClick={calc.submit}>
            คำนวณอันดับใหม่
          </Button>
        )}
      </div>
      <Notice>{error || calc.error}</Notice>
      {loading ? <Loading /> : rows.length ? (
        <div className="admin-table-wrap">
          <table>
            <thead>
              <tr>
                <th>อันดับ</th>
                <th>ช่อง</th>
                <th>{metric.label}</th>
                <th>เปลี่ยนแปลง</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, index) => (
                <tr key={row.id || `${row.vtuber_id}-${index}`}>
                  <td><strong>#{row.rank}</strong></td>
                  <td>{row.name || row.vtuber_name}</td>
                  <td>{fmtNumber(
                    filters.category === "followers"
                      ? (row.subscriber_count ?? row.followers)
                      : filters.category === "videos"
                        ? (row.video_count ?? 0)
                        : row.total_views,
                  )}</td>
                  <td>{rankChangeLabel(row.rank_change)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <Empty>ยังไม่มีอันดับ{metric.label}ในช่วงเวลาที่เลือก</Empty>
      )}
    </Card>
  );
}
