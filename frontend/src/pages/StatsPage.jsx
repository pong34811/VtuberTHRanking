import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
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

export default function StatsPage({ defaultPeriod = "alltime" }) {
  const [params, setParams] = useSearchParams();
  const requestedAffiliation = params.get("affiliation");
  const affiliation = ["indie", "agency"].includes(requestedAffiliation) ? requestedAffiliation : "";
  const groupLabel = affiliation === "indie" ? "วีทูปเบอร์อิสระ" : affiliation === "agency" ? "วีทูปเบอร์สังกัด" : "วีทูปเบอร์ไทยทั้งหมด";
  const [rankings, setRankings] = useState([]);
  const [totalRankings, setTotalRankings] = useState(null);
  const [summary, setSummary] = useState(null);
  const period = ["monthly", "alltime"].includes(params.get("period")) ? params.get("period") : defaultPeriod;
  const category = ["followers", "views", "videos"].includes(params.get("category")) ? params.get("category") : "followers";
  const month = period === "monthly" && /^\d{4}-(0[1-9]|1[0-2])$/.test(params.get("month") || "") ? params.get("month") : "";
  const [rankingLoading, setRankingLoading] = useState(true);
  const [summaryLoading, setSummaryLoading] = useState(true);
  const [rankingError, setRankingError] = useState("");
  const [summaryError, setSummaryError] = useState("");
  const [rankingRetry, setRankingRetry] = useState(0);
  const [summaryRetry, setSummaryRetry] = useState(0);

  const updateFilter = (key, value) => {
    const next = new URLSearchParams(params);
    next.set(key, value);
    next.delete("offset");
    setParams(next);
  };

  useEffect(() => {
    let active = true;
    setRankingLoading(true);
    setRankingError("");
    setRankings([]);
    setTotalRankings(null);

    async function loadRankings() {
      const results = [];
      let total = 0;
      while (true) {
        const response = await rankingsAPI.getList({ period, category, ...(month && { month }), ...(affiliation && { affiliation }), limit: 100, offset: results.length });
        const page = response.data.results || [];
        results.push(...page);
        total = response.data.total ?? results.length;
        if (!page.length || results.length >= total) break;
      }
      return { results, total };
    }

    loadRankings()
      .then(({ results, total }) => {
        if (!active) return;
        setRankings(results);
        setTotalRankings(total);
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
  }, [period, category, month, affiliation, rankingRetry]);

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

  const metricChoices = summary?.category_choices || categories;
  const metric = metricChoices.find((item) => item.value === category)?.label || "อันดับ";
  const calendarMonth = new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Bangkok", year: "numeric", month: "2-digit" }).format(new Date());
  const selectedMonth = month || summary?.ranking_month || calendarMonth;
  const monthChoices = [...new Set([selectedMonth, ...(summary?.available_months || [])])]
    .filter(value => /^\d{4}-(0[1-9]|1[0-2])$/.test(value)).sort().reverse();
  const updated = summary?.latest_update ? new Date(summary.latest_update) : null;
  const updateLabel = updated && !Number.isNaN(updated.getTime())
    ? updated.toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "numeric" })
    : "ยังไม่มีข้อมูล";
  const summarySection = (
    <section className="home-summary" aria-label="ข้อมูลของรายการ VTuber" aria-busy={summaryLoading}>
      <article className="home-fact">
        <span className="home-fact-label">ช่องในอันดับที่เลือก</span>
        <strong>{totalRankings?.toLocaleString("th-TH") ?? "—"}</strong>
        <span className="home-fact-note">{groupLabel}</span>
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
          <h2>ตารางอันดับ</h2>
          <p>เลือกช่วงเวลาและสถิติ เพื่อสำรวจอันดับที่คุณสนใจ</p>
        </div>
        <Link className="home-text-link" to="/discover">ค้นหาช่อง <ArrowUpRight aria-hidden="true" /></Link>
      </div>

      <div className="ranking-toolbar">
        <div role="group" aria-label="ช่วงเวลา">
          <span className="home-control-label">ช่วงเวลา</span>
          <PeriodSelector value={period} onChange={(value) => updateFilter("period", value)} choices={summary?.period_choices || periods} />
        </div>
        <div role="group" aria-label="จัดอันดับตาม">
          <span className="home-control-label">จัดอันดับตาม</span>
          <CategorySelector value={category} onChange={(value) => updateFilter("category", value)} choices={summary?.category_choices || categories} />
        </div>
        {period === "monthly" && <div>
          <label className="home-control-label" htmlFor="ranking-month">เดือนอันดับ</label>
          <select id="ranking-month" value={selectedMonth} onChange={(event) => updateFilter("month", event.target.value)}>
            {monthChoices.map(value => <option key={value} value={value}>{value}</option>)}
          </select>
        </div>}
      </div>

      <div className="home-table-heading">
        <h3>{metric} <span>/ {period === "monthly" ? `ยอดสะสม ณ เดือน ${selectedMonth}` : "ยอดสะสมทั้งหมด"}</span></h3>
        <span aria-live="polite">
          {rankingLoading ? "กำลังโหลด…" : rankingError ? "โหลดไม่สำเร็จ" : `แสดง ${rankings.length.toLocaleString("th-TH")} จาก ${totalRankings.toLocaleString("th-TH")} ช่อง`}
        </span>
      </div>
      {rankingLoading ? (
        <LoadingSpinner />
      ) : rankingError ? (
        <Feedback error={rankingError} retry={() => setRankingRetry((value) => value + 1)} />
      ) : (
        <LeaderboardTable rankings={rankings} metric={metric} showChange={!affiliation} />
      )}
      <p className="home-endnote">{affiliation
        ? "อันดับในตารางนับเฉพาะกลุ่ม · อันดับรวมแสดงใต้ชื่อช่อง"
        : "↑ ขึ้นอันดับ · ↓ ลดอันดับ · — อันดับเท่าเดิม · NEW ไม่มีอันดับในรอบก่อน"}</p>
    </section>
  );

  return (
    <div className="homepage stats-page">
      <header className="home-section-heading">
        <div>
          <h1>อันดับ{groupLabel}</h1>
          <p>สำรวจอันดับจากข้อมูล YouTube ที่บันทึกไว้ในระบบ</p>
        </div>
        <Link className="home-text-link" to="/discover">ค้นพบ VTuber <ArrowUpRight aria-hidden="true" /></Link>
      </header>
      {summarySection}
      {methodSection}
      {rankingsSection}
    </div>
  );
}
