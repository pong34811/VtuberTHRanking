import { Link } from 'react-router-dom'
import RankBadge from './RankBadge'
import ChangeIndicator from './ChangeIndicator'

export default function VTuberCard({ vtuber, rank, score, rankChange, isNew }) {
  return (
    <Link
      to={`/profile/${vtuber.slug}`}
      className="flex items-center gap-4 p-4 bg-[var(--color-card)] rounded-xl border border-[var(--color-border)] hover:border-[var(--color-accent)]/50 transition-colors"
    >
      <RankBadge rank={rank} />
      <div className="w-10 h-10 rounded-full bg-[var(--color-accent)]/20 flex items-center justify-center text-lg font-bold text-[var(--color-accent)]">
        {vtuber.name.charAt(0)}
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-medium truncate">{vtuber.name}</p>
        <p className="text-xs text-[var(--color-muted)]">
          {vtuber.category} • {vtuber.affiliation}
        </p>
      </div>
      <div className="text-right">
        <p className="font-semibold">{score?.toLocaleString()}</p>
        <ChangeIndicator change={rankChange} isNew={isNew} />
      </div>
    </Link>
  )
}
