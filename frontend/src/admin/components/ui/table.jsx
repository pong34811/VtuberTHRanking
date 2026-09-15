import { cn } from './cn'

export function TableWrap({ className, ...props }) {
  return <div className={cn('overflow-x-auto rounded-lg border border-border', className)} {...props} />
}

export function Table({ className, ...props }) {
  return <table className={cn('w-full text-sm', className)} {...props} />
}

export function THead({ className, ...props }) {
  return <thead className={cn('bg-card-hover/60', className)} {...props} />
}

export function TH({ className, ...props }) {
  return (
    <th
      className={cn('whitespace-nowrap px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted', className)}
      {...props}
    />
  )
}

export function TR({ className, ...props }) {
  return <tr className={cn('border-t border-border first:border-t-0 hover:bg-card-hover/50', className)} {...props} />
}

export function TD({ className, ...props }) {
  return <td className={cn('px-4 py-3 align-middle', className)} {...props} />
}
