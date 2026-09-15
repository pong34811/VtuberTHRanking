import { cn } from './cn'

const variants = {
  primary: 'bg-accent text-white hover:bg-accent-hover border border-transparent shadow-sm',
  secondary: 'bg-card text-text border border-border hover:bg-card-hover shadow-xs',
  ghost: 'text-muted hover:text-text hover:bg-card-hover border border-transparent',
  danger: 'text-red hover:bg-card-hover border border-transparent',
}

const sizes = {
  sm: 'h-8 px-3 text-[13px] rounded-lg gap-1.5',
  default: 'h-10 px-4 text-sm rounded-lg gap-2',
  icon: 'h-9 w-9 rounded-lg',
}

export function Button({ variant = 'secondary', size = 'default', className, ...props }) {
  return (
    <button
      className={cn(
        'inline-flex items-center justify-center font-medium whitespace-nowrap transition-colors',
        'disabled:pointer-events-none disabled:opacity-50 disabled:shadow-none',
        'focus-visible:outline-3 focus-visible:outline-accent focus-visible:outline-offset-2',
        variants[variant] || variants.secondary,
        sizes[size] || sizes.default,
        className,
      )}
      {...props}
    />
  )
}
