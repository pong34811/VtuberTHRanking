import { cn } from './cn'

const variants = {
  default: 'bg-card-hover text-text border-border',
  active: 'bg-card text-green border-green/30',
  inactive: 'bg-card text-muted border-border',
  accent: 'bg-card text-accent border-accent/30',
}

export function Badge({ variant = 'default', className, ...props }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium whitespace-nowrap',
        variants[variant] || variants.default,
        className,
      )}
      {...props}
    />
  )
}
