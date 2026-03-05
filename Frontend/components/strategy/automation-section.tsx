"use client";

import type { UseFormReturn } from "react-hook-form";
import type { UserPreference } from "@/lib/types/preferences";

const INTERVAL_OPTIONS = [
  { label: "Every 1 hour", value: 3600 },
  { label: "Every 2 hours", value: 7200 },
  { label: "Every 4 hours", value: 14400 },
  { label: "Every 8 hours", value: 28800 },
  { label: "Every 12 hours", value: 43200 },
  { label: "Every 24 hours", value: 86400 },
];

interface Props {
  form: UseFormReturn<UserPreference>;
}

export function AutomationSection({ form }: Props) {
  const { register, watch, setValue } = form;
  const autoInvest = watch("autoInvestEnabled");

  return (
    <div>
      <h3 className="mb-4 font-display text-[17px] font-semibold text-ld-ink">
        Automation
      </h3>

      <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:gap-8">
        {/* Toggle */}
        <div>
          <label className="mb-1.5 block text-[11px] uppercase tracking-[0.8px] text-ld-slate">
            Auto-Invest
          </label>
          <button
            type="button"
            onClick={() =>
              setValue("autoInvestEnabled", !autoInvest, { shouldDirty: true })
            }
            className={`relative h-6 w-11 rounded-full transition-colors duration-200 ${
              autoInvest ? "bg-ld-accent" : "bg-black/12"
            }`}
          >
            <span
              className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform duration-200 ${
                autoInvest ? "translate-x-[22px]" : "translate-x-0.5"
              }`}
            />
          </button>
          <p className="mt-1 text-[11px] text-ld-slate">
            {autoInvest
              ? "System actively manages positions"
              : "Only monitors existing positions"}
          </p>
        </div>

        {/* Check Interval */}
        <div className="flex-1 sm:max-w-[240px]">
          <label className="mb-1.5 block text-[11px] uppercase tracking-[0.8px] text-ld-slate">
            Check Interval
          </label>
          <select
            {...register("investmentCheckIntervalSeconds", {
              valueAsNumber: true,
            })}
            className="h-[42px] w-full cursor-pointer rounded-lg border border-black/10 bg-white px-3 font-mono text-sm text-ld-ink outline-none transition-all duration-150 focus:border-ld-primary focus:shadow-[0_0_0_3px_rgba(13,107,88,0.1)]"
          >
            {INTERVAL_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );
}
