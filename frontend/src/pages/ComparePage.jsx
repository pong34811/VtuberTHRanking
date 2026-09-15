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
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    let active = true;
    setListError("");
    vtubersAPI
      .getList()
      .then((res) => {
        if (active) setVtubers(res.data.results);
      })
      .catch(() => {
        if (active) setListError("โหลดรายชื่อไม่สำเร็จ");
      });
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
    v.history.forEach((h) => {
      if (!points.has(h.date)) points.set(h.date, { date: h.date });
      points.get(h.date)[`channel_${v.id}`] = h.value;
    }),
  );
  const chartData = [...points.values()].sort((a, b) =>
    a.date.localeCompare(b.date),
  );

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">เปรียบเทียบ VTuber</h1>

      <p className="page-intro">
        เลือก 2–3 ช่อง เพื่อดูแนวโน้มย้อนหลัง 6 เดือน
      </p>
      <div className="flex gap-2 items-center">
        <select
          aria-label="สถิติที่เปรียบเทียบ"
          disabled={loading}
          value={category}
          onChange={(e) => {
            setCategory(e.target.value);
            setCompareData(null);
          }}
          className="bg-[var(--color-card)] border border-[var(--color-border)] rounded-lg px-3 py-2 text-sm"
        >
          <option value="followers">ผู้ติดตาม</option>
          <option value="views">ยอดวิว</option>
          <option value="videos">จำนวนคลิป</option>
        </select>
        <button
          onClick={handleCompare}
          disabled={selected.length < 2 || loading}
          className="px-4 py-2 bg-[var(--color-accent)] text-white rounded-lg text-sm font-medium disabled:opacity-50"
        >
          เปรียบเทียบ ({selected.length}/3)
        </button>
      </div>

      <div className="flex flex-wrap gap-2">
        {vtubers.map((v) => (
          <button
            key={v.id}
            aria-pressed={selected.includes(v.id)}
            disabled={
              loading || (selected.length === 3 && !selected.includes(v.id))
            }
            onClick={() => toggle(v.id)}
            className={`disabled:opacity-40 px-3 py-1.5 text-sm rounded-lg border transition-colors ${
              selected.includes(v.id)
                ? "bg-[var(--color-accent)] border-[var(--color-accent)] text-white"
                : "border-[var(--color-border)] text-[var(--color-muted)] hover:border-[var(--color-accent)]"
            }`}
          >
            {v.name}
          </button>
        ))}
      </div>

      {listError && (
        <Feedback error={listError} retry={() => setRetry((x) => x + 1)} />
      )}
      {error && <Feedback error={error} retry={handleCompare} />}
      {loading && <LoadingSpinner />}
      {compareData && !chartData.length && (
        <Feedback>ยังไม่มีข้อมูลย้อนหลังสำหรับช่องที่เลือก</Feedback>
      )}
      {compareData && chartData.length > 0 && (
        <div className="p-4 bg-[var(--color-card)] rounded-xl border border-[var(--color-border)]">
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="var(--color-border)"
                />
                <XAxis
                  dataKey="date"
                  stroke="var(--color-muted)"
                  fontSize={12}
                />
                <YAxis stroke="var(--color-muted)" fontSize={12} />
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
                    dot={false}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  );
}
