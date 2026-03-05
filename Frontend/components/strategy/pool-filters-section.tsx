"use client";

import { motion, AnimatePresence } from "motion/react";
import type { UseFormReturn } from "react-hook-form";
import type { UserPreference } from "@/lib/types/preferences";
import { FormField } from "./form-field";
import { X, Plus } from "lucide-react";

const TOKEN_OPTIONS = [
  { symbol: "xcDOT", color: "#E6007A" },
  { symbol: "WGLMR", color: "#627EEA" },
  { symbol: "USDC", color: "#2775CA" },
  { symbol: "USDT", color: "#26A17B" },
  { symbol: "WETH", color: "#627EEA" },
  { symbol: "WBTC", color: "#F7931A" },
  { symbol: "DAI", color: "#F5AC37" },
  { symbol: "GLMR", color: "#627EEA" },
];

const DEX_OPTIONS = ["Algebra", "StellaSwap"];

interface Props {
  form: UseFormReturn<UserPreference>;
}

export function PoolFiltersSection({ form }: Props) {
  const { register, watch, setValue, formState: { errors } } = form;

  const allowedTokens = watch("allowedTokens");
  const preferredDexes = watch("preferredDexes");

  const toggleToken = (symbol: string) => {
    if (!allowedTokens) {
      setValue("allowedTokens", [symbol], { shouldDirty: true });
    } else if (allowedTokens.includes(symbol)) {
      const next = allowedTokens.filter((t) => t !== symbol);
      setValue("allowedTokens", next.length === 0 ? null : next, { shouldDirty: true });
    } else {
      setValue("allowedTokens", [...allowedTokens, symbol], { shouldDirty: true });
    }
  };

  const toggleDex = (dex: string) => {
    if (!preferredDexes) {
      setValue("preferredDexes", [dex], { shouldDirty: true });
    } else if (preferredDexes.includes(dex)) {
      const next = preferredDexes.filter((d) => d !== dex);
      setValue("preferredDexes", next.length === 0 ? null : next, { shouldDirty: true });
    } else {
      setValue("preferredDexes", [...preferredDexes, dex], { shouldDirty: true });
    }
  };

  return (
    <div>
      <h3 className="mb-4 font-display text-[17px] font-semibold text-ld-ink">
        Pool Filters
      </h3>

      <div className="mb-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <FormField
          label="Minimum TVL"
          suffix="USD"
          hint="Only consider pools with this TVL or higher"
          error={errors.minTvlUsd?.message}
          registration={register("minTvlUsd", { valueAsNumber: true })}
        />
        <FormField
          label="Minimum Pool Age"
          suffix="days"
          hint="Filters out brand-new, unproven pools"
          error={errors.minPoolAgeDays?.message}
          registration={register("minPoolAgeDays", { valueAsNumber: true })}
        />
      </div>

      {/* Token chips */}
      <div className="mb-4">
        <label className="mb-2 block text-[11px] uppercase tracking-[0.8px] text-ld-slate">
          Allowed Tokens {!allowedTokens && "(All)"}
        </label>
        <div className="flex flex-wrap gap-2">
          {TOKEN_OPTIONS.map((token) => {
            const isSelected =
              !allowedTokens || allowedTokens.includes(token.symbol);
            return (
              <motion.button
                key={token.symbol}
                type="button"
                layout
                onClick={() => toggleToken(token.symbol)}
                whileTap={{ scale: 0.95 }}
                className={`inline-flex items-center gap-1.5 rounded-lg border px-3.5 py-1.5 text-xs font-medium transition-colors duration-200 ${
                  isSelected
                    ? "border-ld-primary/40 bg-[rgba(13,107,88,0.06)] text-ld-primary"
                    : "border-black/10 bg-white text-ld-slate hover:border-ld-primary/20"
                }`}
              >
                <span
                  className="inline-block h-2 w-2 rounded-full"
                  style={{ backgroundColor: token.color }}
                />
                {token.symbol}
              </motion.button>
            );
          })}
        </div>
      </div>

      {/* DEX chips */}
      <div>
        <label className="mb-2 block text-[11px] uppercase tracking-[0.8px] text-ld-slate">
          Preferred DEXes {!preferredDexes && "(All)"}
        </label>
        <div className="flex flex-wrap gap-2">
          {DEX_OPTIONS.map((dex) => {
            const isSelected =
              !preferredDexes || preferredDexes.includes(dex);
            return (
              <motion.button
                key={dex}
                type="button"
                layout
                onClick={() => toggleDex(dex)}
                whileTap={{ scale: 0.95 }}
                className={`inline-flex items-center gap-1.5 rounded-lg border px-3.5 py-1.5 text-xs font-medium transition-colors duration-200 ${
                  isSelected
                    ? "border-ld-primary/40 bg-[rgba(13,107,88,0.06)] text-ld-primary"
                    : "border-black/10 bg-white text-ld-slate hover:border-ld-primary/20"
                }`}
              >
                {dex}
              </motion.button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
