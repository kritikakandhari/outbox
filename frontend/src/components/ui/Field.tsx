import type { InputHTMLAttributes, TextareaHTMLAttributes } from "react";

const base = "w-full rounded-lg border border-line bg-white px-3 py-2.5 text-sm placeholder:text-ink-soft/60 focus:border-brand";

export function Input({ label, hint, ...rest }: InputHTMLAttributes<HTMLInputElement> & { label: string; hint?: string }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-semibold">{label}</span>
      <input className={base} {...rest} />
      {hint && <span className="mt-1 block text-xs text-ink-soft">{hint}</span>}
    </label>
  );
}

export function Textarea({ label, ...rest }: TextareaHTMLAttributes<HTMLTextAreaElement> & { label: string }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-semibold">{label}</span>
      <textarea className={`${base} min-h-32 resize-y`} {...rest} />
    </label>
  );
}
