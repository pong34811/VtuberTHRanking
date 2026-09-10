export default function ChangeIndicator({ change, isNew }) {
  if (isNew || change === 'NEW') {
    return <span className="text-[var(--color-yellow)] text-xs font-bold px-1.5 py-0.5 rounded bg-yellow-500/10">NEW</span>
  }
  if (change === null || change === undefined || change === 0) {
    return <span className="text-[var(--color-muted)] text-sm">—</span>
  }
  if (change > 0) {
    return (
      <span className="text-[var(--color-green)] text-sm font-medium">
        ↑{change}
      </span>
    )
  }
  return (
    <span className="text-[var(--color-red)] text-sm font-medium">
      ↓{Math.abs(change)}
    </span>
  )
}
