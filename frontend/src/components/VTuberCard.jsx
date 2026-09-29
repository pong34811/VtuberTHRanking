import { Link } from "react-router-dom";
import ChangeIndicator from "./ChangeIndicator";
import { affiliationLabel, categoryLabel } from "./channelLabels";
import RetryAvatar from "./RetryAvatar";
export default function VTuberCard({ vtuber, rank, score, rankChange, isNew, videoCount, followers }) {
  return (
    <Link to={`/profile/${vtuber.slug}`} className="ranking-row">
      {typeof rank === "number" && (
        <span className="w-8 shrink-0 text-sm text-[var(--muted-foreground)] font-semibold">
          {String(rank).padStart(2, "0")}
        </span>
      )}
      <RetryAvatar src={vtuber.avatar} className="avatar" alt="" loading="lazy" fallback={<span className="avatar" aria-hidden="true">{vtuber.name.charAt(0)}</span>} />
      <div className="flex-1 min-w-0">
        <p className="font-medium truncate">{vtuber.name}</p>
        <p className="text-xs text-[var(--muted-foreground)] truncate">
          {categoryLabel(vtuber.category)} · {affiliationLabel(vtuber.affiliation)}
        </p>
        {videoCount != null && (
          <p className="text-xs text-[var(--muted-foreground)]">
            {videoCount.toLocaleString("th-TH")} คลิป
          </p>
        )}
        {followers !== undefined && (
          <p className="text-xs text-[var(--muted-foreground)]">
            {followers == null ? "ยังไม่มีข้อมูลผู้ติดตาม" : `${followers.toLocaleString("th-TH")} ผู้ติดตาม`}
          </p>
        )}
      </div>
      {score != null && (
        <div className="ranking-score">
          <p className="font-semibold">{score.toLocaleString("th-TH")}</p>
          <ChangeIndicator change={rankChange} isNew={isNew} />
        </div>
      )}
    </Link>
  );
}
