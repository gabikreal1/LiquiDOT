"use client";

import type { UseFormReturn } from "react-hook-form";
import type { UserPreference } from "@/lib/types/preferences";
import { FormField } from "./form-field";

interface Props {
  form: UseFormReturn<UserPreference>;
}

export function RangesSection({ form }: Props) {
  const { register, watch, formState: { errors } } = form;

  const sl = watch("defaultLowerRangePercent");
  const tp = watch("defaultUpperRangePercent");

  // Entry marker position as percentage
  const absSl = Math.abs(sl || 5);
  const absTP = tp || 10;
  const markerPos = (absSl / (absSl + absTP)) * 100;

  return (
    <div>
      <h3 className="mb-4 font-display text-[17px] font-semibold text-ld-ink">
        Position Ranges
      </h3>

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <FormField
          label="Default Stop-Loss"
          suffix="%"
          hint="Automatic exit below this price drop"
          error={errors.defaultLowerRangePercent?.message}
          registration={register("defaultLowerRangePercent", { valueAsNumber: true })}
        />
        <FormField
          label="Default Take-Profit"
          suffix="%"
          hint="Automatic exit above this price gain"
          error={errors.defaultUpperRangePercent?.message}
          registration={register("defaultUpperRangePercent", { valueAsNumber: true })}
        />
      </div>

      {/* Visual range indicator */}
      <div className="rounded-xl bg-ld-light-1 p-6">
        <div className="relative h-2 w-full rounded-full bg-ld-light-2">
          {/* SL zone (red) */}
          <div
            className="absolute left-0 top-0 h-full rounded-l-full"
            style={{
              width: `${markerPos}%`,
              background: "linear-gradient(90deg, rgba(229,57,53,0.25), rgba(229,57,53,0.08))",
            }}
          />
          {/* TP zone (green) */}
          <div
            className="absolute right-0 top-0 h-full rounded-r-full"
            style={{
              width: `${100 - markerPos}%`,
              background: "linear-gradient(90deg, rgba(0,200,83,0.04), rgba(0,200,83,0.2))",
            }}
          />
          {/* Entry marker */}
          <div
            className="absolute top-1/2 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-ld-ink bg-white transition-all duration-300"
            style={{ left: `${markerPos}%` }}
          />
        </div>

        {/* Labels */}
        <div className="mt-3 flex justify-between text-xs">
          <span className="font-mono font-medium text-[#E53935]">
            {sl ?? -5}%
          </span>
          <span className="text-ld-slate">Entry Price</span>
          <span className="font-mono font-medium text-[#00C853]">
            +{tp ?? 10}%
          </span>
        </div>
      </div>
    </div>
  );
}
