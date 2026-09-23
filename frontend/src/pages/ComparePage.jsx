import { useState, useEffect } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { vtubersAPI, compareAPI } from "../api/client";
import Feedback from "../components/Feedback";
import LoadingSpinner from "../components/LoadingSpinner";

export default function ComparePage() {
  const [vtubers, setVtubers] = useState([]);
  const [selected, setSelected] = useState([]);
  const [category, setCategory] = useState("followers");
  const [compareData, setCompareData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [listError, setListError] = useState("");
  const [listLoading, setListLoading] = useState(true);
  const [retry, setRetry] = useState(0);
  const [query, setQuery] = useState("");

  useEffect(() => {
    let active = true;
    setListError("");
    setListLoading(true);
    vtubersAPI
      .getList()
      .then((res) => {
        if (active) setVtubers(res.data.results);
      })
      .catch(() => {
        if (active) setListError("โหลดรายชื่อไม่สำเร็จ");
      })
      .finally(() => { if (active) setListLoading(false); });
    return () => {
      active = false;
    };
  }, [retry]);
  const toggle = (id) => {
    setCompareData(null);
    setError("");
    setSelected((prev) =>
      prev.includes(id)
        ? prev.filter((x) => x !== id)
        : prev.length < 3
          ? [...prev, id]
          : prev,
    );
  };

  const handleCompare = async () => {
    if (selected.length < 2) return;
    setLoading(true);
    setError("");
    setCompareData(null);
    try {
      const res = await compareAPI.post({
        vtubers: selected,
        category,
        months: 6,
      });
      setCompareData(res.data);
    } catch (err) {
      setError("เปรียบเทียบไม่สำเร็จ กรุณาลองอีกครั้ง");
    } finally {
      setLoading(false);
    }
  };

  const points = new Map();
  compareData?.vtubers?.forEach((v) =>
    (v.history || []).filter((point) => point.date).forEach((h) => {
      if (!points.has(h.date)) points.set(h.date, { date: h.date });
      points.get(h.date)[`channel_${v.id}`] = h.value;
    }),
  );
  const chartData = [...points.values()].sort((a, b) =>
    a.date.localeCompare(b.date),
  );
  const historyCoverage = (compareData?.vtubers || []).map((vtuber) => ({
    ...vtuber,
    pointCount: new Set((vtuber.history || []).map((point) => point.date).filter(Boolean)).size,
  }));
  const missingTrendCoverage = historyCoverage.filter((vtuber) => vtuber.pointCount < 2);
  const visibleVtubers = vtubers.filter((v) => v.name.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()));
  const selectedVtubers = selected.map((id) => vtubers.find((v) => v.id === id)).filter(Boolean);
  const representedIds = new Set(historyCoverage.map((vtuber) => vtuber.id));
  const omittedSelectedVtubers = selectedVtubers.filter((vtuber) => !representedIds.has(vtuber.id));
  const canCompareTrend = selectedVtubers.length === selected.length
    && historyCoverage.length === selected.length
    && historyCoverage.length >= 2
    && missingTrendCoverage.length === 0;

  return (
    <div>
      <p className="eyebrow">COMPARE PERFORMANCE</p>
      <h1 className="text-3xl font-semibold">เปรียบเทียบ VTuber</h1>
      <p className="page-intro">
        เลือก 2–3 ช่อง เพื่อเปรียบเทียบข้อมูลย้อนหลังสูงสุด 6 เดือนตามข้อมูลที่มี
      </p>
      <section className="compare-workspace" aria-label="เลือกช่องสำหรับเปรียบเทียบ">
        <div className="compare-step"><span>1</span><div><strong>เลือกช่อง</strong><small>เลือกได้สูงสุด 3 ช่อง</small></div></div>
        <label className="search-field" htmlFor="compare-search"><span>ค้นหารายชื่อ</span><input id="compare-search" type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="พิมพ์ชื่อ VTuber..." className="control-input" /></label>
        <div className="selected-summary" aria-live="polite">
          <span className="selection-count">เลือกแล้ว {selected.length}/3</span>
          {selectedVtubers.map((v) => <button key={v.id} disabled={loading} onClick={() => toggle(v.id)} aria-label={`นำ ${v.name} ออกจากรายการ`}>{v.name}<span aria-hidden="true">×</span></button>)}
          {!selected.length && <small>ยังไม่ได้เลือกช่อง</small>}
        </div>
        <div className="channel-picker">
          {visibleVtubers.map((v) => (
            <button key={v.id} aria-pressed={selected.includes(v.id)} disabled={loading || (selected.length === 3 && !selected.includes(v.id))} onClick={() => toggle(v.id)}>
              <span className="picker-avatar" aria-hidden="true">{v.name.charAt(0)}</span><span>{v.name}</span><span className="picker-check" aria-hidden="true">{selected.includes(v.id) ? "✓" : "+"}</span>
            </button>
          ))}
          {listLoading && <LoadingSpinner />}
          {!listLoading && !listError && !visibleVtubers.length && <p className="empty-inline">ไม่พบรายชื่อที่ค้นหา</p>}
        </div>
        <div className="compare-action">
          <div className="compare-step"><span>2</span><div><strong>เลือกสถิติแล้วดูผล</strong><small>กราฟจะแสดงข้อมูลย้อนหลัง 6 เดือน</small></div></div>
        <select
          aria-label="เลือกสถิติที่เปรียบเทียบ"
          disabled={loading}
          value={category}
          onChange={(e) => {
            setCategory(e.target.value);
            setCompareData(null);
          }}
          className="control-input"
        >
          <option value="followers">ผู้ติดตาม</option>
          <option value="views">ยอดวิว</option>
          <option value="videos">จำนวนคลิป</option>
        </select>
        <button
          onClick={handleCompare}
          disabled={selected.length < 2 || loading}
          className="primary-button"
        >
          {selected.length < 2 ? `เลือกอีก ${2 - selected.length} ช่อง` : "แสดงกราฟเปรียบเทียบ"}
        </button>
        </div>
      </section>

      {listError && (
        <Feedback error={listError} retry={() => setRetry((x) => x + 1)} />
      )}
      {error && <Feedback error={error} retry={handleCompare} />}
      {loading && <LoadingSpinner />}
      {compareData && !canCompareTrend && (
        <p className="compare-coverage" role="status">
          {!chartData.length
            ? "ยังไม่มีข้อมูลย้อนหลังสำหรับช่องที่เลือกในช่วงสูงสุด 6 เดือน"
            : omittedSelectedVtubers.length
              ? "ข้อมูลเปรียบเทียบมีไม่ครบทุกช่องที่เลือก"
              : "แสดงกราฟเมื่อแต่ละช่องมีข้อมูลอย่างน้อย 2 จุด ภายในช่วงสูงสุด 6 เดือน"}
        </p>
      )}
      {compareData && !canCompareTrend && (missingTrendCoverage.length > 0 || omittedSelectedVtubers.length > 0) && (
        <ul className="compare-coverage-list" aria-label="จำนวนข้อมูลย้อนหลังแยกตามช่อง">
          {missingTrendCoverage.map((vtuber) => (
            <li key={vtuber.id}>{vtuber.name}: มีข้อมูลย้อนหลัง {vtuber.pointCount} จุด</li>
          ))}
          {omittedSelectedVtubers.map((vtuber) => (
            <li key={vtuber.id}>{vtuber.name}: ไม่มีข้อมูลเปรียบเทียบในผลลัพธ์</li>
          ))}
        </ul>
      )}
      {compareData && canCompareTrend && (
        <section className="chart-panel" aria-label="กราฟเปรียบเทียบ">
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="var(--color-border)"
                />
                <XAxis
                  dataKey="date"
                  stroke="var(--muted-foreground)"
                  fontSize={12}
                />
                <YAxis stroke="var(--muted-foreground)" fontSize={12} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "var(--color-card)",
                    border: "1px solid var(--color-border)",
                    borderRadius: "8px",
                    color: "var(--color-text)",
                  }}
                />
                <Legend />
                {compareData.vtubers.map((v) => (
                  <Line
                    key={v.id}
                    type="monotone"
                    dataKey={`channel_${v.id}`}
                    name={v.name}
                    stroke={v.color}
                    strokeWidth={2}
                    dot={{ r: 3 }}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
        </section>
      )}
    </div>
  );
}
