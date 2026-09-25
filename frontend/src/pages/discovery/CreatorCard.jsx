import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowUpRight } from 'lucide-react';
import { affiliationLabel, categoryLabel } from '../../components/channelLabels';

export function directoryAddedDate(raw) {
  if (typeof raw !== 'string' || !raw.trim()) return null;
  const value = raw.trim();
  const sqliteTimestamp = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(value);
  const isoTimestamp = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(value);
  if (!sqliteTimestamp && !isoTimestamp) return null;

  const dayText = value.slice(0, 10);
  const day = new Date(`${dayText}T00:00:00Z`);
  const hour = Number(value.slice(11, 13));
  const minute = Number(value.slice(14, 16));
  const second = Number(value.slice(17, 19));
  if (Number.isNaN(day.getTime()) || day.toISOString().slice(0, 10) !== dayText || hour > 23 || minute > 59 || second > 59) return null;

  const date = new Date(sqliteTimestamp ? `${value.replace(' ', 'T')}Z` : value);
  if (Number.isNaN(date.getTime())) return null;
  return {
    iso: date.toISOString(),
    label: date.toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Bangkok' }),
  };
}

export function CreatorCard({ creator, showAddedDate = false }) {
  const [failed, setFailed] = useState(false);
  const added = showAddedDate ? directoryAddedDate(creator.created_at) : null;
  const agencyName = typeof creator.agency_name === 'string' ? creator.agency_name.trim() : '';
  const affiliation = creator.affiliation === 'agency' && agencyName
    ? `${affiliationLabel(creator.affiliation)} ${agencyName}`
    : affiliationLabel(creator.affiliation);

  useEffect(() => setFailed(false), [creator.avatar]);

  return (
    <Link className="discovery-card" to={`/profile/${encodeURIComponent(creator.slug)}`} aria-label={`${creator.name} · ${categoryLabel(creator.category)} · ${affiliation}`}>
      <div className="discovery-card-media">
        {creator.avatar && !failed
          ? <img src={creator.avatar} alt="" loading="lazy" onError={() => setFailed(true)} />
          : <span className="discovery-avatar-fallback" aria-hidden="true">{(creator.name || '?').slice(0, 1)}</span>}
        <span className="discovery-card-open" aria-hidden="true"><ArrowUpRight /></span>
      </div>
      <div className="discovery-card-body">
        <h3>{creator.name}</h3>
        <p className="discovery-card-meta">
          <span>{categoryLabel(creator.category)}</span><span className="discovery-card-separator" aria-hidden="true">·</span><span className="discovery-card-affiliation">{affiliation}</span>
        </p>
        {added && <p className="discovery-card-meta">เพิ่มเข้าทำเนียบ <time dateTime={added.iso}>{added.label}</time></p>}
      </div>
    </Link>
  );
}

export default CreatorCard;
