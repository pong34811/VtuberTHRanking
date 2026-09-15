import VTuberCard from './VTuberCard'

export default function LeaderboardTable({ rankings, loading }) {
  if (loading) return null
  if (!rankings?.length) {
    return <p className="text-center text-[var(--color-muted)] py-8">ไม่มีข้อมูล</p>
  }

  return (
    <div className="ranking-list">
      {rankings.map((item) => (
        <VTuberCard
          key={item.vtuber.id}
          vtuber={item.vtuber}
          rank={item.rank}
          score={item.score}
          rankChange={item.rank_change}
          isNew={item.rank_change === 'NEW'}
          videoCount={item.vtuber.video_count}
        />
      ))}
    </div>
  )
}
