"use client";

import type { UseFormReturn } from "react-hook-form";
import type { UserPreference } from "@/lib/types/preferences";
import { FormField } from "./form-field";

interface Props {
  form: UseFormReturn<UserPreference>;
}

export function InvestmentSection({ form }: Props) {
  const { register, formState: { errors } } = form;

  return (
    <div>
      <h3 className="mb-4 font-display text-[17px] font-semibold text-ld-ink">
        Investment Strategy
      </h3>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <FormField
          label="Minimum APY Target"
          suffix="%"
          hint="Pools below this threshold are filtered out"
          error={errors.minApy?.message}
          registration={register("minApy", { valueAsNumber: true })}
        />
        <FormField
          label="Max Concurrent Positions"
          hint="How many pools to invest in simultaneously"
          error={errors.maxPositions?.message}
          registration={register("maxPositions", { valueAsNumber: true })}
        />
        <FormField
          label="Max Allocation Per Position"
          suffix="USD"
          hint="Caps single-pool exposure"
          error={errors.maxAllocPerPositionUsd?.message}
          registration={register("maxAllocPerPositionUsd", { valueAsNumber: true })}
        />
        <FormField
          label="Min Position Size"
          suffix="USD"
          hint="Positions below this are skipped"
          error={errors.minPositionSizeUsd?.message}
          registration={register("minPositionSizeUsd", { valueAsNumber: true })}
        />
      </div>
    </div>
  );
}
