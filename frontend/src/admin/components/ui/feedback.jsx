import { useState } from 'react'
import { cn } from './cn'

export function Avatar({ src, name, className }) {
  const [failed, setFailed] = useState(false)
  const initial = (name || '?').charAt(0).toUpperCase()
  if (src && !failed) {
    return (
      <img
        src={src}
        alt=""
        loading="lazy"
        onError={() => setFailed(true)}
        className={cn('h-10 w-10 shrink-0 rounded-full border border-border bg-card-hover object-cover', className)}
      />
    )
  }
  return (
    <span
      aria-hidden
      className={cn('grid h-10 w-10 shrink-0 place-items-center rounded-full border border-border bg-card-hover text-sm font-bold', className)}
    >
      {initial}
    </span>
  )
}

export function SkeletonRows({ rows = 4, cols = 4 }) {
  return (
    <div className="grid gap-2.5 p-1" aria-label="กำลังโหลดข้อมูล" role="status">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-3">
          <div className="h-10 w-10 animate-pulse rounded-full bg-card-hover" />
          <div className="grid flex-1 gap-1.5">
            <div className="h-3.5 w-2/5 animate-pulse rounded bg-card-hover" />
            <div className="h-3 w-1/4 animate-pulse rounded bg-card-hover" />
          </div>
          {Array.from({ length: Math.max(cols - 2, 0) }).map((_, j) => (
            <div key={j} className="hidden h-3.5 w-20 animate-pulse rounded bg-card-hover sm:block" />
          ))}
        </div>
      ))}
    </div>
  )
}

export function EmptyState({ title = 'ยังไม่มีข้อมูล', hint, action }) {
  return (
    <div className="grid place-items-center gap-2 px-6 py-12 text-center">
      <div className="grid h-12 w-12 place-items-center rounded-full border border-dashed border-border text-xl text-muted" aria-hidden>
        ○
      </div>
      <p className="font-medium">{title}</p>
      {hint && <p className="max-w-sm text-sm text-muted">{hint}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  )
}
