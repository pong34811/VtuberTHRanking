import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, ArrowDown, ArrowUpRight } from "lucide-react";
import CreatorSpotlight from "../components/CreatorSpotlight";
import "./home.css";
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
    return () => { active = false; };
  }, [period, category, retry]);
  const metric = { followers: "ผู้ติดตาม", views: "ยอดวิว", videos: "จำนวนคลิป" }[category] || "คะแนน";
  const updated = summary?.latest_update ? new Date(summary.latest_update) : null;
  return (
    <div className="homepage">
      <section className="home-hero" aria-labelledby="home-title">
        <div className="home-hero-copy">
          <p className="eyebrow">A LITTLE CLOSER TO YOUR OSHI</p>
          <h1 id="home-title">ค้นพบโลกของ<br /><em>VTuber ไทย</em></h1>
          <p>หลากหลายคาแรกเตอร์ ทุกความเป็นตัวเอง<br />ทำความรู้จักช่องใหม่ ๆ แล้วค้นพบโอชิคนถัดไปของคุณ</p>
          <div className="home-actions">
            <Link to="/search" className="home-discover">สำรวจ VTuber <ArrowUpRight size={17} aria-hidden="true" /></Link>
            <a href="#rankings" className="home-ranking-link">ดูอันดับล่าสุด <ArrowDown size={15} aria-hidden="true" /></a>
          </div>
        </div>
        <div className="home-art" aria-hidden="true">
          <span className="home-art-star">✳</span>
          <div className="home-art-type">VTuber<span>TH.</span></div>
          <span className="home-art-caption">VIRTUAL TALENT. REAL CONNECTION.</span>
          <span className="home-art-dot" />
        </div>
      </section>
      <div className="home-summary" aria-label="สรุปข้อมูล">
        <p><strong>{summary?.total_vtubers?.toLocaleString("th-TH") ?? "—"}</strong>ช่อง VTuber ในรายการ</p>
        {updated && !Number.isNaN(updated.getTime()) && <p>อัปเดต {updated.toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "numeric" })}</p>}
        <span className="home-summary-source">สำรวจผ่านสถิติ YouTube</span>
      </div>
      {!loading && !error && rankings.length > 0 && (
        <section aria-labelledby="spotlight-title">
          <div className="home-section-title">
            <div><p className="eyebrow">CREATOR SPOTLIGHT</p><h2 id="spotlight-title">ทำความรู้จักช่องเด่น</h2><p>3 อันดับแรกตาม{metric} ในช่วงเวลาที่เลือก</p></div>
            <Link to="/search">สำรวจทุกช่อง <ArrowRight size={15} aria-hidden="true" /></Link>
          </div>
          <CreatorSpotlight rankings={rankings} metric={metric} />
        </section>
      )}
      <section id="rankings" className="home-rankings" aria-labelledby="rankings-title" aria-busy={loading}>
        <div className="home-section-title">
          <div><p className="eyebrow">THE RANKINGS</p><h2 id="rankings-title">อันดับ VTuber ไทย</h2><p>ติดตามการเติบโตของครีเอเตอร์ที่คุณชื่นชอบ</p></div>
          <Link to="/compare">เปรียบเทียบช่อง <ArrowUpRight size={15} aria-hidden="true" /></Link>
        </div>
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
      </div>
      {loading ? (
        <LoadingSpinner />
      ) : error ? (
        <Feedback error={error} retry={() => setRetry((x) => x + 1)} />
      ) : (
        <>
          <div className="list-heading">
            <span>อันดับ / ช่อง</span>
            <span>
              {metric} ·
              การเปลี่ยนอันดับ
            </span>
          </div>
          <LeaderboardTable rankings={rankings} />
        </>
      )}
      <p className="home-endnote">อันดับอ้างอิงจากสถิติ YouTube · ทุกครีเอเตอร์มีเสน่ห์ในแบบของตัวเอง</p>
      </section>
    </div>
  );
}
