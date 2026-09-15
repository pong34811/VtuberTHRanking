import { cn } from "./cn";

const controlClass =
  "flex h-10 w-full rounded-lg border border-border bg-card px-3 text-sm text-text shadow-xs transition-colors " +
  "placeholder:text-muted-foreground focus-visible:outline-3 focus-visible:outline-ring focus-visible:outline-offset-0 " +
  "disabled:cursor-not-allowed disabled:opacity-50";

export function Field({
  label,
  hint,
  error,
  wide = false,
  children,
  className,
}) {
  return (
    <label
      className={cn("grid gap-1.5 text-sm", wide && "sm:col-span-2", className)}
    >
      <span className="font-medium">{label}</span>
      {children}
      {hint && !error && (
        <span className="text-xs text-muted-foreground">{hint}</span>
      )}
      {error && <span className="text-xs text-red">{error}</span>}
    </label>
  );
}

export function Input({ className, ...props }) {
  return <input className={cn(controlClass, className)} {...props} />;
}

export function Select({ className, children, ...props }) {
  return (
    <select className={cn(controlClass, "pr-8", className)} {...props}>
      {children}
    </select>
  );
}

export function Textarea({ className, ...props }) {
  return (
    <textarea
      className={cn(controlClass, "min-h-20 py-2", className)}
      {...props}
    />
  );
}

export function Check({ label, className, ...props }) {
  return (
    <label
      className={cn(
        "flex cursor-pointer items-center gap-2.5 rounded-lg border border-border bg-card px-3 py-2.5 text-sm sm:col-span-2",
        className,
      )}
    >
      <input type="checkbox" className="h-4 w-4 accent-[#245dcc]" {...props} />
      <span>{label}</span>
    </label>
  );
}

export function FormActions({ className, ...props }) {
  return (
    <div
      className={cn("flex justify-end gap-2 pt-2 sm:col-span-2", className)}
      {...props}
    />
  );
}

export function Alert({ tone = "error", children }) {
  if (!children) return null;
  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      className={cn(
        "rounded-lg border px-3.5 py-2.5 text-sm sm:col-span-2",
        tone === "error"
          ? "border-red/30 bg-card text-red"
          : "border-green/30 bg-card text-green",
      )}
    >
      {children}
    </div>
  );
}
