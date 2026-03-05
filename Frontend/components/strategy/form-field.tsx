"use client";

import type { UseFormRegisterReturn } from "react-hook-form";

interface FormFieldProps {
  label: string;
  suffix?: string;
  hint?: string;
  error?: string;
  registration: UseFormRegisterReturn;
  type?: "number" | "text";
}

export function FormField({
  label,
  suffix,
  hint,
  error,
  registration,
  type = "number",
}: FormFieldProps) {
  return (
    <div>
      <label className="mb-1.5 block text-[11px] uppercase tracking-[0.8px] text-ld-slate">
        {label}
      </label>
      <div className="relative">
        <input
          type={type}
          step="any"
          {...registration}
          className={`h-[42px] w-full rounded-lg border bg-white px-3 font-mono text-sm text-ld-ink outline-none transition-all duration-150 placeholder:text-ld-slate/40 focus:border-ld-primary focus:shadow-[0_0_0_3px_rgba(13,107,88,0.1)] ${
            suffix ? "pr-12" : "pr-3"
          } ${error ? "border-red-400" : "border-black/10"}`}
        />
        {suffix && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2 font-body text-xs text-ld-slate">
            {suffix}
          </span>
        )}
      </div>
      {hint && !error && (
        <p className="mt-1 text-[11px] text-ld-slate">{hint}</p>
      )}
      {error && <p className="mt-1 text-[11px] text-red-500">{error}</p>}
    </div>
  );
}
