"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { ChevronDown, Info } from "lucide-react";
import type { UseFormReturn } from "react-hook-form";
import type { UserPreference } from "@/lib/types/preferences";
import { FormField } from "./form-field";

interface Props {
  form: UseFormReturn<UserPreference>;
}

export function AdvancedSection({ form }: Props) {
  const [open, setOpen] = useState(false);
  const { register, watch, setValue, formState: { errors } } = form;

  const lambda = watch("lambdaRiskAversion");

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between"
      >
        <h3 className="font-display text-[17px] font-semibold text-ld-ink">
          Advanced Parameters
        </h3>
        <motion.div
          animate={{ rotate: open ? 180 : 0 }}
          transition={{ duration: 0.2 }}
        >
          <ChevronDown className="h-5 w-5 text-ld-slate" />
        </motion.div>
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{
              duration: 0.3,
              ease: [0.19, 1, 0.22, 1] as [number, number, number, number],
            }}
            className="overflow-hidden"
          >
            <div className="pt-4">
              <div className="mb-4 flex items-start gap-2 rounded-lg bg-ld-light-1 px-4 py-3">
                <Info className="mt-0.5 h-4 w-4 shrink-0 text-ld-slate" />
                <p className="text-xs text-ld-slate">
                  These parameters tune the investment optimization algorithm.
                  Defaults work well for most users.
                </p>
              </div>

              <div className="space-y-5">
                {/* Risk Aversion Slider */}
                <div>
                  <label className="mb-1.5 block text-[11px] uppercase tracking-[0.8px] text-ld-slate">
                    Risk Aversion (&lambda;)
                  </label>
                  <div className="flex items-center gap-4">
                    <div className="relative flex-1">
                      <input
                        type="range"
                        min={0}
                        max={1}
                        step={0.01}
                        value={lambda ?? 0.5}
                        onChange={(e) =>
                          setValue("lambdaRiskAversion", parseFloat(e.target.value), {
                            shouldDirty: true,
                          })
                        }
                        className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-ld-light-2 accent-ld-primary [&::-webkit-slider-thumb]:h-[18px] [&::-webkit-slider-thumb]:w-[18px] [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-ld-primary [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:shadow"
                      />
                      <div className="mt-1 flex justify-between text-[11px] text-ld-slate">
                        <span>Risk-neutral</span>
                        <span>Risk-averse</span>
                      </div>
                    </div>
                    <span className="w-12 text-right font-mono text-sm text-ld-ink">
                      {(lambda ?? 0.5).toFixed(2)}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <FormField
                    label="Min Benefit Threshold (&theta;)"
                    hint="Minimum net utility gain to trigger rebalance"
                    error={errors.thetaMinBenefit?.message}
                    registration={register("thetaMinBenefit", {
                      valueAsNumber: true,
                    })}
                  />
                  <FormField
                    label="Planning Horizon"
                    suffix="days"
                    hint="Time horizon for rebalancing calculations"
                    error={errors.planningHorizonDays?.message}
                    registration={register("planningHorizonDays", {
                      valueAsNumber: true,
                    })}
                  />
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
