import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { ArrowUpRight, Search } from "lucide-react";
import { Button } from "../components/ui/button";
import "./home.css";
import { rankingsAPI, summaryAPI } from "../api/client";
import PeriodSelector from "../components/PeriodSelector";
import CategorySelector from "../components/CategorySelector";
import LoadingSpinner from "../components/LoadingSpinner";
import LeaderboardTable from "../components/LeaderboardTable";
import Feedback from "../components/Feedback";

export default function HomePage() {
  const [rankings, setRankings] = useState([]);
  const [summary, setSummary] = useState(null);
  const [period, setPeriod] = useState("monthly");
  const [category, setCategory] = useState("followers");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    Promise.all([
      rankingsAPI.getList({ period, category, limit: 50 }),
      summaryAPI.get(),
    ]).then(([r, s]) => {
      if (active) { setRankings(r.data.results); setSummary(s.data); }
    }).catch(() => {
      if (active) setError("โหลดอันดับไม่สำเร็จ กรุณาลองอีกครั้ง");
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [period, category, retry]);
  const metric = { followers: "ผู้ติดตาม", views: "ยอดวิว", videos: "จำนวนคลิป" }[category];
  const updated = summary?.latest_update ? new Date(summary.latest_update) : null;
  return (
    <div className="homepage">
      <header className="home-heading">
        <div>
          <p className="home-kicker">YOUTUBE RANKINGS</p>
          <h1>อันดับ VTuber ไทย</h1>
          <p className="home-description">ติดตามสถิติและเปรียบเทียบช่อง VTuber ไทย</p>
        </div>
        <div className="home-actions">
          <Button asChild variant="outline"><Link to="/search"><Search aria-hidden="true" />ค้นหาช่อง</Link></Button>
          <Button asChild variant="outline"><Link to="/compare">เปรียบเทียบ<ArrowUpRight aria-hidden="true" /></Link></Button>
        </div>
      </header>
      <div className="home-summary" aria-label="สรุปข้อมูล">
        <p><strong>{summary?.total_vtubers?.toLocaleString("th-TH") ?? "—"}</strong> ช่อง VTuber ในรายการ</p>
        <p>แหล่งข้อมูล <strong>YouTube</strong></p>
        <p className="home-updated">อัปเดตล่าสุด <strong>{updated && !Number.isNaN(updated.getTime()) ? updated.toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "numeric" }) : "—"}</strong></p>
      </div>
      <section id="rankings" className="home-rankings" aria-label="ตารางอันดับ VTuber" aria-busy={loading}>
        <div className="ranking-toolbar">
          <div role="group" aria-label="ช่วงเวลา">
            <span className="home-control-label">ช่วงเวลา</span>
            <PeriodSelector value={period} onChange={setPeriod} choices={summary?.period_choices || [{ value: "monthly", label: "รายเดือน" }, { value: "alltime", label: "ทั้งหมด" }]} />
          </div>
          <div role="group" aria-label="จัดอันดับตาม">
            <span className="home-control-label">จัดอันดับตาม</span>
            <CategorySelector value={category} onChange={setCategory} choices={summary?.category_choices || [{ value: "followers", label: "ผู้ติดตาม" }, { value: "views", label: "ยอดวิว" }, { value: "videos", label: "จำนวนคลิป" }]} />
          </div>
        </div>
        <div className="home-table-heading">
          <h2>{metric} <span>/ {period === "monthly" ? "เดือนนี้" : "ทั้งหมด"}</span></h2>
          <span aria-live="polite">{loading ? "กำลังโหลด…" : error ? "โหลดไม่สำเร็จ" : `${rankings.length.toLocaleString("th-TH")} รายการ`}</span>
        </div>
        {loading ? <LoadingSpinner /> : error ? <Feedback error={error} retry={() => setRetry(x => x + 1)} /> : <LeaderboardTable rankings={rankings} metric={metric} />}
        <p className="home-endnote">แสดงสูงสุด 50 รายการ · การเปลี่ยนอันดับ: ↑ ขึ้น · ↓ ลง · — ไม่เปลี่ยนหรือไม่มีข้อมูลเดิม</p>
      </section>
    </div>
  );
}
