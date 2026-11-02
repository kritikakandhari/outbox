import type { ButtonHTMLAttributes } from "react";

type Variant = "primary" | "ghost" | "outline";
const styles: Record<Variant, string> = {
  primary: "bg-brand text-white hover:bg-brand-dark",
  outline: "border border-line bg-white text-ink hover:bg-surface",
  ghost: "text-ink-soft hover:bg-white",
};

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> { variant?: Variant; loading?: boolean }

export function Button({ variant = "primary", loading, className = "", children, disabled, ...rest }: Props) {
  return (
    <button
      disabled={disabled || loading}
      className={`inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold transition-colors disabled:opacity-50 ${styles[variant]} ${className}`}
      {...rest}
    >
      {loading && <span className="size-4 animate-spin rounded-full border-2 border-current border-t-transparent" />}
      {children}
    </button>
  );
}
