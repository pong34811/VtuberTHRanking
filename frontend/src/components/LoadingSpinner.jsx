export default function LoadingSpinner() {
  return (
    <div role="status" aria-label="กำลังโหลดข้อมูล" className="flex justify-center items-center py-12">
      <div className="w-8 h-8 border-2 border-[var(--color-border)] border-t-[var(--color-accent)] rounded-full animate-spin" />
    </div>
  )
}
