import { Link } from "react-router-dom";
import { ArrowUpRight } from "lucide-react";
import { useState } from "react";

function SpotlightCard({ item, metric }) {
  const { vtuber } = item;
  const [failed, setFailed] = useState(false);
  return (
    <Link to={`/profile/${vtuber.slug}`} className="spotlight-card">
      <div className="spotlight-art">
        <span className="spotlight-rank">อันดับ {String(item.rank).padStart(2, "0")}</span>
        <span className="spotlight-orbit" aria-hidden="true" />
        {vtuber.avatar && !failed ? (
          <img src={vtuber.avatar} alt="" onError={() => setFailed(true)} />
        ) : (
          <span className="spotlight-initial" aria-hidden="true">{vtuber.name.charAt(0)}</span>
        )}
        <span className="spotlight-open" aria-hidden="true"><ArrowUpRight size={20} /></span>
      </div>
      <div className="spotlight-info">
        <p className="spotlight-affiliation">{vtuber.affiliation || "VTuber ไทย"}</p>
        <h3>{vtuber.name}</h3>
        <div className="spotlight-stat"><strong>{item.score?.toLocaleString("th-TH") ?? "—"}</strong><span>{metric}</span></div>
      </div>
    </Link>
  );
}

export default function CreatorSpotlight({ rankings, metric }) {
  if (!rankings.length) return null;
  return <div className="spotlight-grid">{rankings.slice(0, 3).map(item => <SpotlightCard key={item.vtuber.id} item={item} metric={metric} />)}</div>;
}
