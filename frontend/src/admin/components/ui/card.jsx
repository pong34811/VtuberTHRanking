import { cn } from './cn'

export function Card({ className, ...props }) {
  return <section className={cn('rounded-xl border border-border bg-card shadow-xs', className)} {...props} />
}

export function CardHeader({ className, ...props }) {
  return <div className={cn('flex flex-col gap-1.5 p-6 pb-0 sm:flex-row sm:items-start sm:justify-between', className)} {...props} />
}

export function CardTitle({ className, ...props }) {
  return <h2 className={cn('text-lg font-semibold leading-none tracking-tight', className)} {...props} />
}

export function CardDescription({ className, ...props }) {
  return <p className={cn('text-sm text-muted', className)} {...props} />
}

export function CardContent({ className, ...props }) {
  return <div className={cn('p-6', className)} {...props} />
}

export function CardActions({ className, ...props }) {
  return <div className={cn('flex flex-wrap items-center gap-2', className)} {...props} />
}
