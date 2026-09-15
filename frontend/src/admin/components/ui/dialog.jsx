import { useEffect, useRef } from 'react'
import { cn } from './cn'

// shadcn-style dialog without Radix: overlay click + Escape to close,
// initial focus, focus return, body scroll lock, proper dialog semantics.
export function Dialog({ open, onClose, title, description, children, wide = false }) {
  const panelRef = useRef(null)
  const prevFocus = useRef(null)

  useEffect(() => {
    if (!open) return
    prevFocus.current = document.activeElement
    const panel = panelRef.current
    panel?.querySelector('input, select, textarea, button:not([aria-label="ปิด"])')?.focus()
    document.body.style.overflow = 'hidden'
    const onKey = e => { if (e.key === 'Escape') onClose?.() }
    document.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = ''
      document.removeEventListener('keydown', onKey)
      prevFocus.current?.focus?.()
    }
  }, [open, onClose])

  if (!open) return null
  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-6"
      onMouseDown={e => { if (e.target === e.currentTarget) onClose?.() }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={cn(
          'flex max-h-[92vh] w-full flex-col rounded-t-2xl border border-border bg-card shadow-lg',
          'sm:rounded-2xl',
          wide ? 'sm:max-w-3xl' : 'sm:max-w-lg',
        )}
      >
        <div className="flex items-start justify-between gap-4 border-b border-border p-5 sm:px-6">
          <div>
            <h2 className="text-base font-semibold leading-tight">{title}</h2>
            {description && <p className="mt-1 text-sm text-muted">{description}</p>}
          </div>
          <button
            type="button"
            aria-label="ปิด"
            onClick={onClose}
            className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-xl leading-none text-muted hover:bg-card-hover hover:text-text"
          >
            ×
          </button>
        </div>
        <div className="overflow-y-auto p-5 sm:px-6">{children}</div>
      </div>
    </div>
  )
}
