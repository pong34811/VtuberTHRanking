import { Link } from "react-router-dom";
import ChangeIndicator from "./ChangeIndicator";
import { useState } from "react";
import { affiliationLabel, categoryLabel } from "./channelLabels";
export default function VTuberCard({ vtuber, rank, score, rankChange, isNew, videoCount }) {
  const [failed, setFailed] = useState(false);
  return (
    <Link to={`/profile/${vtuber.slug}`} className="ranking-row">
      {typeof rank === "number" && (
        <span className="w-8 shrink-0 text-sm text-[var(--muted-foreground)] font-semibold">
          {String(rank).padStart(2, "0")}
        </span>
      )}
      {vtuber.avatar && !failed ? (
        <img
          className="avatar"
          src={vtuber.avatar}
          alt=""
          loading="lazy"
          onError={() => setFailed(true)}
        />
      ) : (
        <span className="avatar">{vtuber.name.charAt(0)}</span>
      )}
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
