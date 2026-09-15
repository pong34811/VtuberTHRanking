import { Link } from 'react-router-dom'

const PODIUM_STYLES = [
  { container: 'order-2', badge: 'bg-yellow-500', size: 'w-16 h-16', text: 'text-2xl' },
  { container: 'order-1', badge: 'bg-gray-400', size: 'w-14 h-14', text: 'text-xl' },
  { container: 'order-3', badge: 'bg-amber-600', size: 'w-12 h-12', text: 'text-lg' },
]

export default function TopThree({ rankings }) {
  if (!rankings || rankings.length < 3) return null

  return (
    <div className="flex items-end justify-center gap-3 mb-8">
      {rankings.slice(0, 3).map((item, idx) => {
        const style = PODIUM_STYLES[idx]
        return (
          <Link
            key={item.vtuber.id}
            to={`/profile/${item.vtuber.slug}`}
            className={`flex flex-col items-center ${style.container}`}
          >
            <div className={`${style.size} rounded-full ${style.badge} flex items-center justify-center font-bold text-white mb-2`}>
              {item.vtuber.name.charAt(0)}
            </div>
            <p className="text-sm font-medium text-center max-w-[100px] truncate">
              {item.vtuber.name}
            </p>
            <p className="text-xs text-[var(--muted-foreground)]">
              {item.score?.toLocaleString()}
            </p>
            <div className="mt-2 w-full bg-[var(--color-card)] rounded-t-lg h-16 flex items-center justify-center">
              <span className="text-2xl font-bold">#{item.rank}</span>
            </div>
          </Link>
        )
      })}
    </div>
  )
}
