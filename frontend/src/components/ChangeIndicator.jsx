export default function ChangeIndicator({ change, isNew }) {
  if (isNew || change === 'NEW' || change === null || change === undefined) {
    return <span aria-label="ไม่มีอันดับในรอบก่อน" className="text-[var(--color-yellow)] text-xs font-bold px-1.5 py-0.5 rounded bg-yellow-500/10">NEW</span>
  }
  if (change === 0) {
    return <span aria-label="อันดับไม่เปลี่ยน" className="text-[var(--muted-foreground)] text-sm">—</span>
  }
  if (change > 0) {
    return (
      <span aria-label={`ขึ้นมา ${change} อันดับ`} className="text-[var(--color-green)] text-sm font-medium">
        ↑{change}
      </span>
    )
  }
  return (
    <span aria-label={`ลงไป ${Math.abs(change)} อันดับ`} className="text-[var(--color-red)] text-sm font-medium">
      ↓{Math.abs(change)}
    </span>
  )
}
