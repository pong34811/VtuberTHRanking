import { useState, useEffect } from "react";
import { rankingsAPI, summaryAPI } from "../api/client";
import PeriodSelector from "../components/PeriodSelector";
import CategorySelector from "../components/CategorySelector";
import LoadingSpinner from "../components/LoadingSpinner";
import LeaderboardTable from "../components/LeaderboardTable";
import Feedback from "../components/Feedback";
export default function HomePage() {
  const [rankings, setRankings] = useState([]),
    [summary, setSummary] = useState(null),
    [period, setPeriod] = useState("monthly"),
    [category, setCategory] = useState("followers"),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [retry, setRetry] = useState(0);
  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    Promise.all([
      rankingsAPI.getList({ period, category, limit: 50 }),
      summaryAPI.get(),
    ])
      .then(([r, s]) => {
        if (active) {
          setRankings(r.data.results);
          setSummary(s.data);
        }
      })
      .catch(() => {
        if (active) setError("โหลดอันดับไม่สำเร็จ กรุณาลองอีกครั้ง");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [period, category, retry]);
  return (
    <div>
      <p className="eyebrow">THAI VTUBER DIRECTORY</p>
      <h1 className="text-3xl font-semibold">อันดับ VTuber ไทย</h1>
      <p className="page-intro">ติดตามช่องที่คุณชอบ ผ่านสถิติจาก YouTube</p>
      <div className="ranking-toolbar">
        <div role="group" aria-label="ช่วงเวลา">
          <label>ช่วงเวลา</label>
          <PeriodSelector
            value={period}
            onChange={setPeriod}
            choices={
              summary?.period_choices || [
                { value: "monthly", label: "รายเดือน" },
                { value: "alltime", label: "ทั้งหมด" },
              ]
            }
          />
        </div>
        <div role="group" aria-label="จัดอันดับตาม">
          <label>จัดอันดับตาม</label>
          <CategorySelector
            value={category}
            onChange={setCategory}
            choices={
              summary?.category_choices || [
                { value: "followers", label: "ผู้ติดตาม" },
                { value: "views", label: "ยอดวิว" },
                { value: "videos", label: "จำนวนคลิป" },
              ]
            }
          />
        </div>
        <div className="ranking-meta">
          {summary && (
            <>
              <p>
                {summary.total_vtubers?.toLocaleString("th-TH")} ช่องในรายการ
              </p>
              <p>
                อัปเดต{" "}
                {new Date(summary.latest_update).toLocaleDateString("th-TH")}
              </p>
            </>
          )}
        </div>
      </div>
      {loading ? (
        <LoadingSpinner />
      ) : error ? (
        <Feedback error={error} retry={() => setRetry((x) => x + 1)} />
      ) : (
        <>
          <div className="flex justify-between text-xs text-[var(--color-muted)] px-5 mb-3">
            <span>อันดับ / ช่อง</span>
            <span>
              {category === "followers" ? "ผู้ติดตาม" : "ยอดวิว"} ·
              การเปลี่ยนอันดับ
            </span>
          </div>
          <LeaderboardTable rankings={rankings} />
        </>
      )}
    </div>
  );
}
