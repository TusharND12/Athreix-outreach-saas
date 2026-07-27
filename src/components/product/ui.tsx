import type {
  ButtonHTMLAttributes,
  HTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
} from "react";
import { LoaderCircle } from "lucide-react";

export function cx(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "sm" | "md" | "icon";
  loading?: boolean;
};

export function Button({
  className,
  variant = "primary",
  size = "md",
  loading = false,
  disabled,
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      className={cx(
        "inline-flex shrink-0 items-center justify-center gap-2 rounded-xl font-semibold shadow-sm transition-[background-color,color,border-color,box-shadow,opacity,transform] duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-45 active:translate-y-px dark:focus-visible:ring-blue-400 dark:focus-visible:ring-offset-slate-950",
        size === "sm" && "min-h-9 px-3 text-xs",
        size === "md" && "min-h-11 px-4 text-sm",
        size === "icon" && "size-11 p-0",
        variant === "primary" &&
          "bg-blue-600 text-white shadow-[0_10px_28px_oklch(0.6_0.24_281/0.2)] hover:-translate-y-0.5 hover:bg-blue-700 hover:shadow-[0_14px_34px_oklch(0.6_0.24_281/0.25)] dark:bg-blue-500 dark:hover:bg-blue-400",
        variant === "secondary" &&
          "border border-slate-300 bg-white text-slate-700 hover:border-blue-300 hover:bg-blue-50/70 hover:text-blue-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:border-blue-600 dark:hover:bg-blue-950/40",
        variant === "ghost" &&
          "shadow-none text-slate-600 hover:bg-slate-100 hover:text-slate-950 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white",
        variant === "danger" && "bg-red-700 text-white hover:bg-red-800",
        className,
      )}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {loading ? (
        <LoaderCircle
          aria-hidden="true"
          className="size-4 animate-spin motion-reduce:animate-none"
        />
      ) : null}
      {children}
    </button>
  );
}

export function IconButton({
  "aria-label": ariaLabel,
  ...props
}: ButtonProps & { "aria-label": string }) {
  return (
    <Button aria-label={ariaLabel} size="icon" variant="ghost" {...props} />
  );
}

export function PageHeader({
  title,
  description,
  action,
  meta,
  align = "left",
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  meta?: ReactNode;
  align?: "left" | "center";
}) {
  return (
    <header
      className={cx(
        "relative flex flex-col gap-5 pb-3",
        align === "center"
          ? "items-center text-center"
          : "sm:flex-row sm:items-end sm:justify-between",
      )}
    >
      <div
        className={cx(
          "min-w-0",
          align === "center" && "flex flex-col items-center",
        )}
      >
        {meta ? (
          <div className="mb-3 flex flex-wrap items-center gap-2 text-[11px] font-medium text-slate-500 dark:text-slate-400">
            {meta}
          </div>
        ) : null}
        <h1 className="display-serif text-balance text-4xl leading-none text-slate-950 dark:text-white sm:text-[2.85rem]">
          {title}
        </h1>
        {description ? (
          <p
            className={cx(
              "mt-3 text-sm leading-6 text-slate-600 dark:text-slate-400",
              align === "center"
                ? "max-w-none lg:whitespace-nowrap"
                : "max-w-[70ch]",
            )}
          >
            {description}
          </p>
        ) : null}
      </div>
      {action ? (
        <div className="flex shrink-0 flex-wrap gap-2">{action}</div>
      ) : null}
    </header>
  );
}

export function SectionHeading({
  title,
  description,
  action,
  className,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cx("flex items-start justify-between gap-4", className)}>
      <div>
        <h2 className="display-serif text-xl leading-tight text-slate-950 dark:text-white">
          {title}
        </h2>
        {description ? (
          <p className="mt-1 max-w-[70ch] text-sm leading-5 text-slate-600 dark:text-slate-400">
            {description}
          </p>
        ) : null}
      </div>
      {action}
    </div>
  );
}

export function StatusBadge({
  children,
  tone = "neutral",
  className,
}: {
  children: ReactNode;
  tone?: "neutral" | "success" | "warning" | "danger" | "info";
  className?: string;
}) {
  return (
    <span
      className={cx(
        "inline-flex min-h-7 items-center gap-1.5 rounded-full border px-2.5 text-[10px] font-bold uppercase tracking-[0.06em]",
        tone === "neutral" &&
          "border-slate-200 bg-white/65 text-slate-600 shadow-sm dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300",
        tone === "success" &&
          "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-300",
        tone === "warning" &&
          "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-300",
        tone === "danger" &&
          "border-red-200 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-300",
        tone === "info" &&
          "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-800 dark:bg-blue-950 dark:text-blue-300",
        className,
      )}
    >
      {children}
    </span>
  );
}

export function Field({
  label,
  hint,
  error,
  className,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  hint?: string;
  error?: string;
}) {
  const id = props.id ?? props.name ?? label.toLowerCase().replaceAll(" ", "-");
  return (
    <div className={cx("block", className)}>
      <label
        className="mb-1.5 block text-xs font-medium text-zinc-800 dark:text-zinc-200"
        htmlFor={id}
      >
        {label}
      </label>
      <input
        id={id}
        aria-describedby={hint || error ? `${id}-help` : undefined}
        aria-invalid={error ? true : undefined}
        className={cx(
          "min-h-11 w-full rounded-xl border bg-white/80 px-3.5 text-sm text-slate-950 shadow-[0_1px_0_oklch(1_0_0/0.8)_inset] outline-none transition-all placeholder:text-slate-400 hover:border-slate-400 hover:bg-white focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-500/10 dark:bg-slate-950/80 dark:text-white dark:placeholder:text-slate-500 dark:focus:border-blue-400",
          error ? "border-red-600" : "border-zinc-300 dark:border-zinc-700",
        )}
        {...props}
      />
      {hint || error ? (
        <span
          id={`${id}-help`}
          className={cx(
            "mt-1.5 block text-xs",
            error
              ? "text-red-700 dark:text-red-400"
              : "text-zinc-600 dark:text-zinc-400",
          )}
        >
          {error ?? hint}
        </span>
      ) : null}
    </div>
  );
}

export function TextAreaField({
  label,
  hint,
  className,
  ...props
}: React.TextareaHTMLAttributes<HTMLTextAreaElement> & {
  label: string;
  hint?: string;
}) {
  const id = props.id ?? props.name ?? label.toLowerCase().replaceAll(" ", "-");
  return (
    <div className={cx("block", className)}>
      <label
        className="mb-1.5 block text-xs font-medium text-zinc-800 dark:text-zinc-200"
        htmlFor={id}
      >
        {label}
      </label>
      <textarea
        id={id}
        aria-describedby={hint ? `${id}-help` : undefined}
        className="w-full resize-y rounded-xl border border-slate-300 bg-white/80 px-3.5 py-3 text-sm leading-6 text-slate-950 shadow-[0_1px_0_oklch(1_0_0/0.8)_inset] outline-none transition-all placeholder:text-slate-400 hover:border-slate-400 hover:bg-white focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-500/10 dark:border-slate-700 dark:bg-slate-950/80 dark:text-white dark:placeholder:text-slate-500 dark:focus:border-blue-400"
        {...props}
      />
      {hint ? (
        <span
          id={`${id}-help`}
          className="mt-1.5 block text-xs text-zinc-600 dark:text-zinc-400"
        >
          {hint}
        </span>
      ) : null}
    </div>
  );
}

export function SelectField({
  label,
  children,
  className,
  hint,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement> & {
  label: string;
  children: ReactNode;
  hint?: string;
}) {
  const id = props.id ?? props.name ?? label.toLowerCase().replaceAll(" ", "-");
  return (
    <div className={cx("block", className)}>
      <label
        className="mb-1.5 block text-xs font-medium text-zinc-800 dark:text-zinc-200"
        htmlFor={id}
      >
        {label}
      </label>
      <select
        id={id}
        aria-describedby={hint ? `${id}-help` : props["aria-describedby"]}
        className="min-h-11 w-full rounded-xl border border-slate-300 bg-white/80 px-3.5 text-sm text-slate-950 shadow-[0_1px_0_oklch(1_0_0/0.8)_inset] outline-none transition-all hover:border-slate-400 hover:bg-white focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-500/10 dark:border-slate-700 dark:bg-slate-950/80 dark:text-white dark:focus:border-blue-400"
        {...props}
      >
        {children}
      </select>
      {hint ? (
        <span
          id={`${id}-help`}
          className="mt-1.5 block text-xs text-zinc-600 dark:text-zinc-400"
        >
          {hint}
        </span>
      ) : null}
    </div>
  );
}

export function Divider({ className }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={cx("h-px bg-zinc-200 dark:bg-zinc-800", className)}
    />
  );
}

export function InlineNotice({
  title,
  children,
  tone = "neutral",
  icon,
}: {
  title: string;
  children: ReactNode;
  tone?: "neutral" | "warning" | "danger";
  icon?: ReactNode;
}) {
  return (
    <div
      className={cx(
        "rounded-2xl border p-4 shadow-sm",
        tone === "neutral" &&
          "border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900",
        tone === "warning" &&
          "border-amber-300 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/40",
        tone === "danger" &&
          "border-red-300 bg-red-50 dark:border-red-900 dark:bg-red-950/40",
      )}
    >
      <div className="flex gap-3">
        {icon ? <div className="mt-0.5 shrink-0">{icon}</div> : null}
        <div>
          <p className="text-sm font-semibold text-zinc-950 dark:text-white">
            {title}
          </p>
          <div className="mt-1 text-xs leading-5 text-zinc-700 dark:text-zinc-300">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}

export function Surface({
  className,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cx(
        "enterprise-card rounded-2xl dark:border-slate-800 dark:bg-slate-900",
        className,
      )}
      {...props}
    />
  );
}

export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon?: ReactNode;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex min-h-64 flex-col items-center justify-center px-6 py-12 text-center">
      {icon ? (
        <div className="mb-5 flex size-12 items-center justify-center rounded-2xl border bg-zinc-100 text-primary shadow-sm dark:bg-zinc-800 dark:text-zinc-300">
          {icon}
        </div>
      ) : null}
      <h3 className="display-serif text-xl text-zinc-950 dark:text-white">
        {title}
      </h3>
      <p className="mt-2 max-w-md text-sm leading-6 text-zinc-600 dark:text-zinc-400">
        {description}
      </p>
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}
