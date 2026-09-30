import { useState } from "react";
import { adminApi } from "./api";
import { useList } from "./tabs/useList";
import { useRankingCategories } from "./tabs/useRankingCategories";
import {
  Button,
  Card,
  Empty,
  Field,
  Loading,
  ListState,
  Notice,
  fmtNumber,
  useSubmit,
} from "./ui";


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
    category: "",
  });
  const configuration = useRankingCategories();
  const metric = configuration.choices.find(item => item.id === filters.category) || configuration.choices[0];
  const selection = { ...filters, category: metric?.id || "" };
  const list = useList(metric ? `/rankings?${new URLSearchParams(selection)}` : null);
  const rows = list.rows;

  const calc = useSubmit(
    async () => adminApi("/rankings/calculate", {
      method: "POST",
      body: selection,
      csrfToken,
    }),
    list.load,
    JSON.stringify(selection),
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
              onChange={(e) => setFilters({ ...filters, month: e.target.value })}
            />
          </Field>
        )}
        <div className="ranking-metric-control" role="group" aria-label="ตัวชี้วัด">
          <span>ตัวชี้วัด</span>
          <div>
            {configuration.choices.map((item) => (
              <button
                key={item.id}
                type="button"
                aria-pressed={selection.category === item.id}
                onClick={() => setFilters({ ...filters, category: item.id })}
              >
                {item.name}
              </button>
            ))}
          </div>
        </div>
        {isManager && (
          <Button className="primary" busy={calc.busy} disabled={!metric} onClick={calc.submit}>
            คำนวณอันดับใหม่
          </Button>
        )}
      </div>
      <Notice>{calc.error}</Notice>
      {configuration.loading ? <Loading /> : configuration.error ? (
        <Notice>{configuration.error} <Button onClick={configuration.load}>ลองอีกครั้ง</Button></Notice>
      ) : !metric ? <Empty>ไม่มีตัวชี้วัดที่เปิดใช้งาน</Empty> : (
      <ListState list={list} empty={<Empty>ยังไม่มีอันดับ{metric.name}ในช่วงเวลาที่เลือก</Empty>}>
        <div className="admin-table-wrap">
          <table>
            <thead>
              <tr>
                <th>อันดับ</th>
                <th>ช่อง</th>
                <th>{metric.name}</th>
                <th>เปลี่ยนแปลง</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, index) => (
                <tr key={row.id || `${row.vtuber_id}-${index}`}>
                  <td><strong>#{row.rank}</strong></td>
                  <td>{row.name || row.vtuber_name}</td>
                  <td>{fmtNumber(
                    selection.category === "followers"
                      ? (row.subscriber_count ?? row.followers)
                      : selection.category === "videos"
                        ? (row.video_count ?? 0)
                        : row.total_views,
                  )}</td>
                  <td>{rankChangeLabel(row.rank_change)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </ListState>
      )}
    </Card>
  );
}
