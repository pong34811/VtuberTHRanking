import { useState } from 'react'

export function Notice({ type = 'error', children }) {
  return children ? <div className={`admin-notice ${type}`} role={type === 'error' ? 'alert' : 'status'}>{children}</div> : null
}
export function Loading() { return <div className="admin-state">กำลังโหลดข้อมูล…</div> }
export function Empty({ children = 'ยังไม่มีข้อมูล' }) { return <div className="admin-state">{children}</div> }
export function Field({ label, children, wide = false }) { return <label className={wide ? 'wide' : ''}><span>{label}</span>{children}</label> }
export function Button({ busy, children, ...props }) { return <button {...props} disabled={busy || props.disabled}>{busy ? 'กำลังบันทึก…' : children}</button> }
export function Card({ title, actions, children }) { return <section className="admin-card"><header><h2>{title}</h2>{actions}</header>{children}</section> }
export function Modal({ title, onClose, children }) { return <div className="admin-modal" role="dialog" aria-modal="true"><div className="admin-modal-panel"><header><h2>{title}</h2><button className="ghost" onClick={onClose} aria-label="ปิด">×</button></header>{children}</div></div> }

export function useSubmit(action, onSuccess) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const submit = async event => {
    event?.preventDefault()
    setBusy(true); setError('')
    try { const result = await action(); await onSuccess?.(result) }
    catch (err) { setError(err.message || 'บันทึกไม่สำเร็จ'); if (err.status === 401) window.dispatchEvent(new Event('admin:unauthorized')) }
    finally { setBusy(false) }
  }
  return { busy, error, setError, submit }
}

// ponytail: D1 เก็บ datetime('now') เป็น UTC แบบไม่มีโซน ต้องเติม Z ก่อน parse แล้วแสดงเป็น Asia/Bangkok เสมอ
export const fmtDate = value => {
  if (!value) return '—'
  const iso = typeof value === 'string' && /^\d{4}-\d{2}-\d{2} /.test(value) ? value.replace(' ', 'T') + 'Z' : value
  return new Intl.DateTimeFormat('th-TH', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Bangkok' }).format(new Date(iso))
}
export const fmtNumber = value => new Intl.NumberFormat('th-TH').format(Number(value || 0))
