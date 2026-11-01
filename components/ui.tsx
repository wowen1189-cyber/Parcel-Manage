import type { ComponentProps, ReactNode } from "react";

// Small in-house components built on the Parcel tokens (docs/06-design-system.md).

function cx(...classes: (string | false | null | undefined)[]) {
  return classes.filter(Boolean).join(" ");
}

type ButtonVariant = "primary" | "secondary" | "danger" | "ghost";

const buttonStyles: Record<ButtonVariant, string> = {
  primary: "bg-accent text-white hover:bg-accent-hover",
  secondary: "bg-surface text-ink border border-line-strong hover:bg-surface-sunk",
  danger: "bg-danger text-white hover:opacity-90",
  ghost: "text-ink hover:bg-surface-sunk",
};

export function buttonClass(variant: ButtonVariant = "primary", small = false) {
  return cx(
    "inline-flex items-center justify-center gap-2 rounded-[var(--radius-control)] font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed",
    small ? "min-h-9 px-3 text-[13px]" : "min-h-11 px-4 text-sm",
    buttonStyles[variant],
  );
}

export function Button({
  variant = "primary",
  small = false,
  className,
  type = "button",
  ...props
}: ComponentProps<"button"> & { variant?: ButtonVariant; small?: boolean }) {
  return <button type={type} className={cx(buttonClass(variant, small), className)} {...props} />;
}

export function Card({ className, ...props }: ComponentProps<"section">) {
  return (
    <section className={cx("rounded-[var(--radius-card)] border border-line bg-surface", className)} {...props} />
  );
}

export function CardHeader({ title, description, action }: { title: string; description?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3 border-b border-line px-5 py-4">
      <div>
        <h2 className="text-base font-bold">{title}</h2>
        {description && <p className="mt-0.5 text-muted">{description}</p>}
      </div>
      {action}
    </div>
  );
}

export function PageHeader({ title, subtitle, action }: { title: string; subtitle?: string; action?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-[30px] font-extrabold leading-tight tracking-[-0.015em]">{title}</h1>
        {subtitle && <p className="mt-1 text-muted">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

type PillTone = "success" | "warn" | "danger" | "info" | "neutral";

const pillStyles: Record<PillTone, string> = {
  success: "bg-accent-soft text-accent-deep",
  warn: "bg-warn-bg text-warn",
  danger: "bg-danger-bg text-danger",
  info: "bg-info-bg text-info",
  neutral: "bg-surface-sunk text-ink-2",
};

export function Pill({ tone = "neutral", children }: { tone?: PillTone; children: ReactNode }) {
  return (
    <span className={cx("inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold", pillStyles[tone])}>
      {children}
    </span>
  );
}

export function StatTile({ label, value, note }: { label: string; value: ReactNode; note?: string }) {
  return (
    <Card className="p-5">
      <p className="text-[13px] font-medium text-muted">{label}</p>
      <p className="tabular mt-1 text-[30px] font-bold leading-tight">{value}</p>
      {note && <p className="mt-1 text-[13px] text-subtle">{note}</p>}
    </Card>
  );
}

const controlClass =
  "w-full min-h-11 rounded-[var(--radius-control)] border border-line-strong bg-surface px-3 text-sm text-ink placeholder:text-subtle disabled:bg-surface-muted disabled:text-subtle";

export function Field({
  label,
  hint,
  error,
  children,
}: {
  label: string;
  hint?: string;
  error?: string;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[13px] font-semibold text-ink-2">{label}</span>
      {children}
      {hint && !error && <span className="mt-1 block text-[13px] text-subtle">{hint}</span>}
      {error && <span className="mt-1 block text-[13px] font-medium text-danger">{error}</span>}
    </label>
  );
}

export function Input({ className, ...props }: ComponentProps<"input">) {
  return <input className={cx(controlClass, className)} {...props} />;
}

export function Select({ className, ...props }: ComponentProps<"select">) {
  return <select className={cx(controlClass, "pr-8", className)} {...props} />;
}

export function Textarea({ className, ...props }: ComponentProps<"textarea">) {
  return <textarea className={cx(controlClass, "min-h-24 py-2.5", className)} {...props} />;
}

export function Notice({ tone = "info", children }: { tone?: "info" | "warn" | "danger" | "success"; children: ReactNode }) {
  const styles = {
    info: "bg-info-bg text-info",
    warn: "bg-warn-bg text-warn",
    danger: "bg-danger-bg text-danger",
    success: "bg-accent-softer text-accent-deep",
  }[tone];
  return <div className={cx("rounded-[var(--radius-control)] px-4 py-3 text-sm font-medium", styles)}>{children}</div>;
}

export function EmptyState({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="px-6 py-12 text-center">
      <p className="font-semibold">{title}</p>
      {children && <div className="mx-auto mt-1 max-w-md text-muted">{children}</div>}
    </div>
  );
}
