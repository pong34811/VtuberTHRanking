import { useState, useEffect } from "react";
import { Link, useLocation, useParams } from "react-router-dom";
import { vtubersAPI } from "../api/client";
import Feedback from "../components/Feedback";
import LoadingSpinner from "../components/LoadingSpinner";
import TrendChart from "../components/TrendChart";
import { affiliationLabel, categoryLabel } from "../components/channelLabels";
import RetryAvatar from "../components/RetryAvatar";

function getInternalReturnLocation(state) {
  const returnTo = state?.returnTo;
  const { pathname, search } = returnTo || {};
  const isInternalPath = typeof pathname === "string"
    && pathname.startsWith("/")
    && !pathname.startsWith("//")
    && !pathname.includes("\\")
    && !/[\u0000-\u001f]/.test(pathname);
  const isValidSearch = typeof search === "string" && (!search || search.startsWith("?"));
  return isInternalPath && isValidSearch ? { pathname, search } : "/discover";
}

export default function ProfilePage() {
  const { slug } = useParams();
  const location = useLocation();
  const returnLocation = getInternalReturnLocation(location.state);
  const [vtuber, setVtuber] = useState(null);
  const [history, setHistory] = useState([]);
  const [profileLoading, setProfileLoading] = useState(true);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [profileError, setProfileError] = useState("");
  const [profileNotFound, setProfileNotFound] = useState(false);
  const [historyError, setHistoryError] = useState("");
  const [profileRetry, setProfileRetry] = useState(0);
  const [historyRetry, setHistoryRetry] = useState(0);

  useEffect(() => {
    let active = true;
    setProfileLoading(true);
    setProfileError("");
    setProfileNotFound(false);
    setVtuber(null);
    vtubersAPI.getBySlug(slug)
      .then((response) => { if (active) setVtuber(response.data); })
      .catch((err) => {
        if (!active) return;
        setProfileNotFound(err.response?.status === 404);
        setProfileError(err.response?.status === 404 ? "ไม่พบช่องนี้" : "โหลดโปรไฟล์ไม่สำเร็จ");
      })
      .finally(() => { if (active) setProfileLoading(false); });
    return () => {
      active = false;
    };
  }, [slug, profileRetry]);

  useEffect(() => {
    let active = true;
    setHistoryLoading(true);
    setHistoryError("");
    vtubersAPI.getHistory(slug, 6)
      .then((response) => { if (active) setHistory(response.data.history || []); })
      .catch(() => { if (active) setHistoryError("โหลดประวัติสถิติไม่สำเร็จ"); })
      .finally(() => { if (active) setHistoryLoading(false); });
    return () => {
      active = false;
    };
  }, [slug, historyRetry]);

  let youtubeUrl = null;
  for (const value of [vtuber?.youtube_url, vtuber?.channel_url]) {
    try {
      const url = new URL(value);
      if (url.protocol === "https:" && ["youtube.com", "www.youtube.com", "m.youtube.com", "youtu.be"].includes(url.hostname) && !url.username && !url.password) {
        youtubeUrl = url.href;
        break;
      }
    } catch {}
  }
  const recordedAt = vtuber?.latest_stats?.recorded_at;
  const snapshotDate = recordedAt ? new Date(recordedAt) : null;
  const validSnapshotDate = snapshotDate && !Number.isNaN(snapshotDate.getTime());

  if (profileLoading) return <LoadingSpinner />;
  if (profileNotFound) return (
    <section className="empty-state">
      <h1 className="text-2xl font-semibold">ไม่พบช่องนี้</h1>
      <p>ช่องอาจถูกย้ายหรือยังไม่อยู่ในทำเนียบ ลองค้นหาจากชื่อช่อง</p>
      <Link className="secondary-button" to="/discover">ค้นหาช่องในค้นพบ</Link>
    </section>
  );
  if (profileError)
    return <Feedback error={profileError} retry={() => setProfileRetry((x) => x + 1)} />;
  if (!vtuber) return <p className="text-center py-8">ไม่พบข้อมูล</p>;
  const rankingMonth = /^(20\d{2}|21\d{2})-(0[1-9]|1[0-2])$/.test(vtuber.ranking_month || "")
    ? new Intl.DateTimeFormat("th-TH", { month: "long", year: "numeric", timeZone: "Asia/Bangkok" })
      .format(new Date(`${vtuber.ranking_month}-01T00:00:00+07:00`))
    : "ไม่ระบุเดือน";
  const rankingCategories = vtuber.category_choices ?? [
    { value: "followers", label: "ผู้ติดตาม" },
    { value: "views", label: "ยอดวิว" },
    { value: "videos", label: "จำนวนคลิป" },
  ];

  return (
    <div className="space-y-6">
      <Link to={returnLocation} className="inline-flex min-h-11 items-center text-sm text-[var(--primary)]">← กลับไปสำรวจ VTuber</Link>
      <div className="flex items-start gap-4 p-6 bg-[var(--color-card)] rounded-xl border border-[var(--color-border)]">
        <RetryAvatar src={vtuber.avatar} alt="" className="w-16 h-16 shrink-0 rounded-full object-cover" fallback={<div className="w-16 h-16 shrink-0 rounded-full bg-[var(--primary)]/20 flex items-center justify-center text-2xl font-bold text-[var(--primary)]" aria-hidden="true">{vtuber.name.charAt(0)}</div>} />
        <div className="flex-1 min-w-0 break-words">
          <h1 className="text-xl font-bold">{vtuber.name}</h1>
          <p className="text-sm whitespace-pre-line text-[var(--muted-foreground)]">{vtuber.bio}</p>
          <div className="flex flex-wrap gap-2 mt-2">
            <span className="text-xs px-2 py-0.5 rounded bg-[var(--primary)]/10 text-[var(--primary)]">
              {categoryLabel(vtuber.category)}
            </span>
            <span className="text-xs px-2 py-0.5 rounded bg-[var(--color-card)] text-[var(--muted-foreground)]">
              {affiliationLabel(vtuber.affiliation)}
            </span>
          </div>
          {youtubeUrl && <a className="secondary-button inline-flex mt-3" href={youtubeUrl} target="_blank" rel="noopener noreferrer">ดูช่องบน YouTube</a>}
          <p className="text-xs mt-3 text-[var(--muted-foreground)]">
            สถิติล่าสุด: {validSnapshotDate
              ? <time dateTime={recordedAt}>{snapshotDate.toLocaleString("th-TH", { timeZone: "Asia/Bangkok", dateStyle: "medium", timeStyle: "short" })} (เวลาไทย)</time>
              : "ยังไม่มีข้อมูลที่บันทึก"}
          </p>
        </div>

      </div>

      <section className="p-4 bg-[var(--color-card)] rounded-xl border border-[var(--color-border)]" aria-labelledby="profile-rankings">
        <h2 id="profile-rankings" className="font-medium mb-4">อันดับปัจจุบัน</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {[["monthly", `รายเดือน · ${rankingMonth}`], ["alltime", "ทั้งหมด"]].map(([period, label]) => (
            <div key={period}>
              <h3 className="text-sm font-medium mb-2">{label}</h3>
              <dl className="space-y-2 text-sm">
                {rankingCategories.map(({ value: category, label: name }) => (
                  <div key={category} className="flex justify-between gap-4">
                    <dt>{name}</dt>
                    <dd>{vtuber.current_rank?.[`${period}_${category}`] != null
                      ? `#${vtuber.current_rank[`${period}_${category}`].toLocaleString("th-TH")}`
                      : "ยังไม่มีอันดับ"}</dd>
                  </div>
                ))}
              </dl>
            </div>
          ))}
        </div>
        {!rankingCategories.length && <p role="status">ยังไม่มีหมวดอันดับที่เปิดใช้งาน</p>}
      </section>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="p-4 bg-[var(--color-card)] rounded-xl border border-[var(--color-border)]">
          <h2 className="text-sm text-[var(--muted-foreground)] mb-1">ผู้ติดตาม</h2>
          <p className="text-2xl font-bold">
            {vtuber.latest_stats?.followers?.toLocaleString() ?? "—"}
          </p>
        </div>
        <div className="p-4 bg-[var(--color-card)] rounded-xl border border-[var(--color-border)]">
          <h2 className="text-sm text-[var(--muted-foreground)] mb-1">ยอดวิวรวม</h2>
          <p className="text-2xl font-bold">
            {vtuber.latest_stats?.total_views?.toLocaleString() ?? "—"}
          </p>
        </div>
        <div className="p-4 bg-[var(--color-card)] rounded-xl border border-[var(--color-border)]">
          <h2 className="text-sm text-[var(--muted-foreground)] mb-1">จำนวนคลิป</h2>
          <p className="text-2xl font-bold">{vtuber.latest_stats?.video_count?.toLocaleString("th-TH") ?? "—"}</p>
        </div>
      </div>

      {historyLoading ? (
        <div className="p-4 bg-[var(--color-card)] rounded-xl border border-[var(--color-border)]"><LoadingSpinner /></div>
      ) : historyError ? (
        <Feedback error={historyError} retry={() => setHistoryRetry((x) => x + 1)} />
      ) : (
        <>
          <section className="p-4 bg-[var(--color-card)] rounded-xl border border-[var(--color-border)]" aria-labelledby="profile-followers-trend">
            <h2 id="profile-followers-trend" className="font-medium mb-4">แนวโน้มผู้ติดตาม</h2>
            <TrendChart data={history} dataKey="followers" color="var(--primary)" periodLabel="6 เดือน" />
          </section>
          <section className="p-4 bg-[var(--color-card)] rounded-xl border border-[var(--color-border)]" aria-labelledby="profile-views-trend">
            <h2 id="profile-views-trend" className="font-medium mb-4">แนวโน้มยอดวิว</h2>
            <TrendChart data={history} dataKey="total_views" color="var(--color-green)" periodLabel="6 เดือน" />
          </section>
        </>
      )}
    </div>
  );
}
