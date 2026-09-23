import { useState, useEffect } from "react";
import { Link, useParams } from "react-router-dom";
import { vtubersAPI } from "../api/client";
import Feedback from "../components/Feedback";
import LoadingSpinner from "../components/LoadingSpinner";
import TrendChart from "../components/TrendChart";
import { affiliationLabel, categoryLabel } from "../components/channelLabels";

export default function ProfilePage() {
  const { slug } = useParams();
  const [vtuber, setVtuber] = useState(null);
  const [history, setHistory] = useState([]);
  const [profileLoading, setProfileLoading] = useState(true);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [profileError, setProfileError] = useState("");
  const [historyError, setHistoryError] = useState("");
  const [profileRetry, setProfileRetry] = useState(0);
  const [historyRetry, setHistoryRetry] = useState(0);
  const [failedAvatar, setFailedAvatar] = useState("");

  useEffect(() => {
    let active = true;
    setProfileLoading(true);
    setProfileError("");
    setVtuber(null);
    vtubersAPI.getBySlug(slug)
      .then((response) => { if (active) setVtuber(response.data); })
      .catch((err) => {
        if (!active) return;
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

  if (profileLoading) return <LoadingSpinner />;
  if (profileError)
    return <Feedback error={profileError} retry={() => setProfileRetry((x) => x + 1)} />;
  if (!vtuber) return <p className="text-center py-8">ไม่พบข้อมูล</p>;

  return (
    <div className="space-y-6">
      <Link to="/search" className="inline-flex min-h-11 items-center text-sm text-[var(--primary)]">← กลับไปสำรวจ VTuber</Link>
      <div className="flex items-start gap-4 p-6 bg-[var(--color-card)] rounded-xl border border-[var(--color-border)]">
        {vtuber.avatar && failedAvatar !== vtuber.avatar ? (
          <img src={vtuber.avatar} alt="" className="w-16 h-16 shrink-0 rounded-full object-cover" onError={() => setFailedAvatar(vtuber.avatar)} />
        ) : (
          <div className="w-16 h-16 shrink-0 rounded-full bg-[var(--primary)]/20 flex items-center justify-center text-2xl font-bold text-[var(--primary)]">{vtuber.name.charAt(0)}</div>
        )}
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
        </div>
      </div>

      <section className="p-4 bg-[var(--color-card)] rounded-xl border border-[var(--color-border)]" aria-labelledby="profile-rankings">
        <h2 id="profile-rankings" className="font-medium mb-4">อันดับปัจจุบัน</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {[["monthly", "เดือนนี้"], ["alltime", "ทั้งหมด"]].map(([period, label]) => (
            <div key={period}>
              <h3 className="text-sm font-medium mb-2">{label}</h3>
              <dl className="space-y-2 text-sm">
                {[["followers", "ผู้ติดตาม"], ["views", "ยอดวิว"], ["videos", "จำนวนคลิป"]].map(([category, name]) => (
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
      </section>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
