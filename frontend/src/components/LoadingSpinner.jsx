export default function LoadingSpinner() {
  return (
    <div role="status" aria-live="polite" className="flex flex-col gap-3 justify-center items-center py-12 text-sm text-[var(--color-muted)]">
      <div aria-hidden="true" className="w-8 h-8 border-2 border-[var(--color-border)] border-t-[var(--color-accent)] rounded-full animate-spin" />
      <span>กำลังโหลดข้อมูล…</span>
    </div>
  )
}
