import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowUpRight } from "lucide-react";
import "./stats.css";
import { rankingsAPI, summaryAPI } from "../api/client";
import PeriodSelector from "../components/PeriodSelector";
import CategorySelector from "../components/CategorySelector";
import LoadingSpinner from "../components/LoadingSpinner";
import LeaderboardTable from "../components/LeaderboardTable";
import Feedback from "../components/Feedback";

const periods = [
  { value: "monthly", label: "รายเดือน" },
  { value: "alltime", label: "ทั้งหมด" },
];

const categories = [
  { value: "followers", label: "ผู้ติดตาม" },
  { value: "views", label: "ยอดวิว" },
  { value: "videos", label: "จำนวนคลิป" },
];

export default function StatsPage() {
  const [rankings, setRankings] = useState([]);
  const [totalRankings, setTotalRankings] = useState(0);
  const [summary, setSummary] = useState(null);
  const [period, setPeriod] = useState("monthly");
  const [category, setCategory] = useState("followers");
  const [rankingLoading, setRankingLoading] = useState(true);
  const [summaryLoading, setSummaryLoading] = useState(true);
  const [rankingError, setRankingError] = useState("");
  const [summaryError, setSummaryError] = useState("");
  const [rankingRetry, setRankingRetry] = useState(0);
  const [summaryRetry, setSummaryRetry] = useState(0);

  useEffect(() => {
    let active = true;
    setRankingLoading(true);
    setRankingError("");

    rankingsAPI
      .getList({ period, category, limit: 50 })
      .then((response) => {
        if (!active) return;
        setRankings(response.data.results || []);
        setTotalRankings(response.data.total ?? response.data.results?.length ?? 0);
      })
      .catch(() => {
        if (active) setRankingError("โหลดอันดับไม่สำเร็จ กรุณาลองอีกครั้ง");
      })
      .finally(() => {
        if (active) setRankingLoading(false);
      });

    return () => {
      active = false;
    };
  }, [period, category, rankingRetry]);

  useEffect(() => {
    let active = true;
    setSummaryLoading(true);
    setSummaryError("");

    summaryAPI
      .get()
      .then((response) => {
        if (active) setSummary(response.data);
      })
      .catch(() => {
        if (active) setSummaryError("โหลดข้อมูลภาพรวมไม่สำเร็จ");
      })
      .finally(() => {
        if (active) setSummaryLoading(false);
      });

    return () => {
      active = false;
    };
  }, [summaryRetry]);

  const metric = categories.find((item) => item.value === category)?.label || "อันดับ";
  const updated = summary?.latest_update ? new Date(summary.latest_update) : null;
  const updateLabel = updated && !Number.isNaN(updated.getTime())
    ? updated.toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "numeric" })
    : "ยังไม่มีข้อมูล";
  const summarySection = (
    <section className="home-summary" aria-label="ข้อมูลของรายการ VTuber" aria-busy={summaryLoading}>
      <article className="home-fact">
        <span className="home-fact-label">ช่องที่ร่วมจัดอันดับ</span>
        <strong>{summary?.total_vtubers?.toLocaleString("th-TH") ?? "—"}</strong>
        <span className="home-fact-note">ช่อง VTuber ไทย</span>
      </article>
      <article className="home-fact">
        <span className="home-fact-label">แหล่งข้อมูล</span>
        <strong>YouTube</strong>
        <span className="home-fact-note">สถิติของช่อง</span>
      </article>
      <article className="home-fact">
        <span className="home-fact-label">ข้อมูลล่าสุด ณ</span>
        <strong className="home-fact-date">{summaryLoading ? "กำลังโหลด…" : updateLabel}</strong>
        <span className="home-fact-note">วันที่บันทึก snapshot ล่าสุด</span>
      </article>
      {summaryError && (
        <div className="home-summary-error" role="status">
          <span>{summaryError}</span>
          <button type="button" onClick={() => setSummaryRetry((value) => value + 1)}>ลองอีกครั้ง</button>
        </div>
      )}
    </section>
  );

  const methodSection = (
    <details className="home-method">
      <summary><span>วิธีจัดอันดับ</span><span className="home-method-hint">ข้อมูลและตัวชี้วัด</span></summary>
      <div className="home-method-content">
        <p>จัดอันดับช่อง VTuber ไทยจากสถิติ YouTube ที่บันทึกไว้ในระบบ</p>
        <ul>
          <li><strong>รายเดือน:</strong> ใช้ยอดสะสมจาก snapshot ของรอบเดือนนั้น ไม่ใช่จำนวนที่เพิ่มขึ้นระหว่างเดือน</li>
          <li><strong>ทั้งหมด:</strong> ใช้ยอดสะสมจาก snapshot ล่าสุดที่มี</li>
          <li><strong>ตัวชี้วัด:</strong> จำนวนผู้ติดตาม ยอดวิวรวม และจำนวนคลิป</li>
        </ul>
      </div>
    </details>
  );

  const rankingsSection = (
    <section id="rankings" className="home-rankings" aria-label="ตารางอันดับ VTuber" aria-busy={rankingLoading}>
      <div className="home-section-heading">
        <div>
          <p className="home-section-kicker">LEADERBOARD</p>
          <h2>อันดับที่กำลังจับตา</h2>
          <p>เลือกช่วงเวลาและสถิติ เพื่อสำรวจช่องที่คุณสนใจ</p>
        </div>
        <Link className="home-text-link" to="/search">ดูรายชื่อทั้งหมด <ArrowUpRight aria-hidden="true" /></Link>
      </div>

      <div className="ranking-toolbar">
        <div role="group" aria-label="ช่วงเวลา">
          <span className="home-control-label">ช่วงเวลา</span>
          <PeriodSelector value={period} onChange={setPeriod} choices={summary?.period_choices || periods} />
        </div>
        <div role="group" aria-label="จัดอันดับตาม">
          <span className="home-control-label">จัดอันดับตาม</span>
          <CategorySelector value={category} onChange={setCategory} choices={summary?.category_choices || categories} />
        </div>
      </div>

      <div className="home-table-heading">
        <h3>{metric} <span>/ {period === "monthly" ? "อันดับประจำเดือน" : "ยอดสะสมทั้งหมด"}</span></h3>
        <span aria-live="polite">
          {rankingLoading ? "กำลังโหลด…" : rankingError ? "โหลดไม่สำเร็จ" : `แสดง ${rankings.length.toLocaleString("th-TH")} จาก ${totalRankings.toLocaleString("th-TH")} ช่อง`}
        </span>
      </div>
      {rankingLoading ? (
        <LoadingSpinner />
      ) : rankingError ? (
        <Feedback error={rankingError} retry={() => setRankingRetry((value) => value + 1)} />
      ) : (
        <LeaderboardTable rankings={rankings} metric={metric} />
      )}
      <p className="home-endnote">↑ ขึ้นอันดับ · ↓ ลดอันดับ · — อันดับเท่าเดิม · NEW ไม่มีอันดับในรอบก่อน</p>
    </section>
  );

  return (
    <div className="homepage stats-page">
      <header className="home-section-heading">
        <div>
          <p className="home-section-kicker">VTUBER THAILAND</p>
          <h1>สถิติ VTuber ไทย</h1>
          <p>สำรวจอันดับจากข้อมูล YouTube ที่บันทึกไว้ในระบบ</p>
        </div>
        <Link className="home-text-link" to="/">ค้นพบ VTuber <ArrowUpRight aria-hidden="true" /></Link>
      </header>
      {summarySection}
      {methodSection}
      {rankingsSection}
    </div>
  );
}
