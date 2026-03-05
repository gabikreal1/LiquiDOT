"use client";

import type { UseFormReturn } from "react-hook-form";
import type { UserPreference } from "@/lib/types/preferences";
import { FormField } from "./form-field";

interface Props {
  form: UseFormReturn<UserPreference>;
}

export function SafetySection({ form }: Props) {
  const { register, formState: { errors } } = form;

  return (
    <div>
      <h3 className="mb-4 font-display text-[17px] font-semibold text-ld-ink">
        Safety & Risk
      </h3>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <FormField
          label="Max IL Loss Before Exit"
          suffix="%"
          hint="Avoid locking in impermanent loss"
          error={errors.maxIlLossPercent?.message}
          registration={register("maxIlLossPercent", { valueAsNumber: true })}
        />
        <FormField
          label="Daily Rebalance Limit"
          hint="Prevents excessive trading"
          error={errors.dailyRebalanceLimit?.message}
          registration={register("dailyRebalanceLimit", { valueAsNumber: true })}
        />
        <FormField
          label="Expected Gas Cost"
          suffix="USD"
          hint="Estimated gas per transaction"
          error={errors.expectedGasUsd?.message}
          registration={register("expectedGasUsd", { valueAsNumber: true })}
        />
      </div>
    </div>
  );
}
