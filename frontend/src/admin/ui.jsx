import { useEffect, useRef, useState } from "react";
import { Dialog as DialogPrimitive } from "radix-ui";
import { useDialogFocus } from "./useDialogFocus";
import { Field as AccessibleField } from "./components/ui/field";

export function Notice({ type = "error", children }) {
  return children ? (
    <div
      className={`admin-notice ${type}`}
      role={type === "error" ? "alert" : "status"}
    >
      {children}
    </div>
  ) : null;
}
export function Loading() {
  return <div className="admin-state">กำลังโหลดข้อมูล…</div>;
}
export function Empty({ children = "ยังไม่มีข้อมูล" }) {
  return <div className="admin-state">{children}</div>;
}
export function ListState({ list, children, loading = <Loading />, empty = <Empty /> }) {
  if (list.loading) return loading;
  if (list.error) return <Notice>{list.error} <Button type="button" onClick={list.load}>ลองอีกครั้ง</Button></Notice>;
  return list.rows.length ? children : empty;
}
export function Field({ wide = false, ...props }) {
  return <AccessibleField {...props} wide={wide} className={wide ? "wide" : ""} />;
}
export function Button({ busy, children, ...props }) {
  return (
    <button {...props} disabled={busy || props.disabled}>
      {busy ? "กำลังบันทึก…" : children}
    </button>
  );
}
export function Card({ title, actions, children }) {
  return (
    <section className="admin-card">
      <header>
        <h2>{title}</h2>
        {actions}
      </header>
      {children}
    </section>
  );
}
export function Modal({ title, onClose, children }) {
  const restoreFocus = useDialogFocus(true);
  return (
    <DialogPrimitive.Root open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogPrimitive.Overlay className="admin-modal">
        <DialogPrimitive.Content className="admin-modal-panel" aria-describedby={undefined} onCloseAutoFocus={restoreFocus}>
          <header>
            <DialogPrimitive.Title asChild><h2>{title}</h2></DialogPrimitive.Title>
            <DialogPrimitive.Close className="ghost" aria-label="ปิด">×</DialogPrimitive.Close>
          </header>
          {children}
        </DialogPrimitive.Content>
      </DialogPrimitive.Overlay>
    </DialogPrimitive.Root>
  );
}

export function useSubmit(action, onSuccess, identity) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const active = useRef(false);
  const operation = useRef(0);
  const pending = useRef(false);
  const owner = useRef(identity);
  if (owner.current !== identity) {
    owner.current = identity;
    operation.current += 1;
    pending.current = false;
  }
  useEffect(() => {
    active.current = true;
    setBusy(false);
    setError("");
    return () => { active.current = false; operation.current += 1; pending.current = false; };
  }, [identity]);
  const submit = async (event) => {
    event?.preventDefault();
    if (pending.current || !active.current) return;
    const id = ++operation.current;
    const current = () => active.current && operation.current === id;
    pending.current = true;
    setBusy(true);
    setError("");
    try {
      const result = await action();
      if (current()) await onSuccess?.(result);
    } catch (err) {
      if (current() && err.name !== "AbortError") setError(err.message || "บันทึกไม่สำเร็จ");
    } finally {
      if (current()) { pending.current = false; setBusy(false); }
    }
  };
  return { busy, error, setError, submit };
}

// ponytail: D1 เก็บ datetime('now') เป็น UTC แบบไม่มีโซน ต้องเติม Z ก่อน parse แล้วแสดงเป็น Asia/Bangkok เสมอ
export const fmtDate = (value) => {
  if (!value) return "—";
  const iso =
    typeof value === "string" && /^\d{4}-\d{2}-\d{2} /.test(value)
      ? value.replace(" ", "T") + "Z"
      : value;
  return new Intl.DateTimeFormat("th-TH", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Bangkok",
  }).format(new Date(iso));
};
export const fmtNumber = (value) =>
  new Intl.NumberFormat("th-TH").format(Number(value || 0));
