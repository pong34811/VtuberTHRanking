export default function RankBadge({ rank }) {
  let bg = 'bg-[var(--color-card)]'
  if (rank === 1) bg = 'bg-yellow-500/20 text-yellow-400'
  else if (rank === 2) bg = 'bg-gray-400/20 text-gray-300'
  else if (rank === 3) bg = 'bg-amber-600/20 text-amber-500'

  return (
    <span className={`inline-flex items-center justify-center w-8 h-8 rounded-full text-sm font-bold ${bg}`}>
      {rank}
    </span>
  )
}
