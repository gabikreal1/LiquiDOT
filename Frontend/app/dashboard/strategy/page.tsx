"use client";

import { useState, useCallback } from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion } from "motion/react";
import { ArrowLeft, Loader2, Check } from "lucide-react";
import { useAuthStore } from "@/lib/store/auth-store";
import { getPreferences, savePreferences } from "@/lib/api/preferences";
import type { UserPreference } from "@/lib/types/preferences";
import { PresetButtons } from "@/components/strategy/preset-buttons";
import { InvestmentSection } from "@/components/strategy/investment-section";
import { RangesSection } from "@/components/strategy/ranges-section";
import { PoolFiltersSection } from "@/components/strategy/pool-filters-section";
import { SafetySection } from "@/components/strategy/safety-section";
import { AutomationSection } from "@/components/strategy/automation-section";
import { AdvancedSection } from "@/components/strategy/advanced-section";
import { StrategySidebar } from "@/components/strategy/strategy-sidebar";

const sectionVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      duration: 0.35,
      ease: "easeOut" as const,
    },
  },
};

const staggerContainer = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.06 } },
};

export default function StrategyPage() {
  const { userId } = useAuthStore();
  const queryClient = useQueryClient();
  const [selectedPreset, setSelectedPreset] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved">(
    "idle"
  );

  const { data: savedPrefs, isLoading } = useQuery({
    queryKey: ["preferences", userId],
    queryFn: () => getPreferences(userId!),
    enabled: !!userId,
  });

  const form = useForm<UserPreference>({
    values: savedPrefs,
  });

  const mutation = useMutation({
    mutationFn: (data: UserPreference) => savePreferences(userId!, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["preferences", userId] });
      setSaveState("saved");
      setTimeout(() => setSaveState("idle"), 1500);
    },
    onError: () => {
      setSaveState("idle");
    },
  });

  const handlePresetSelect = useCallback(
    (preset: { name: string; values: Partial<UserPreference> }) => {
      setSelectedPreset(preset.name);
      const entries = Object.entries(preset.values) as [
        keyof UserPreference,
        UserPreference[keyof UserPreference],
      ][];
      for (const [key, value] of entries) {
        form.setValue(key, value as never, { shouldDirty: true });
      }
    },
    [form]
  );

  const onSubmit = form.handleSubmit((data) => {
    setSaveState("saving");
    mutation.mutate(data);
  });

  const handleReset = useCallback(() => {
    if (savedPrefs) {
      form.reset(savedPrefs);
    }
    setSelectedPreset(null);
  }, [form, savedPrefs]);

  const currentValues = form.watch();

  if (isLoading) {
    return (
      <div className="mx-auto max-w-[1240px] px-6 py-10 sm:px-10">
        <div className="mb-8 h-8 w-64 animate-pulse rounded bg-ld-light-2" />
        <div className="space-y-6">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="h-32 animate-pulse rounded-xl bg-ld-light-2"
            />
          ))}
        </div>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.25, ease: "easeOut" }}
      className="mx-auto max-w-[1240px] px-6 py-10 sm:px-10"
    >
      {/* Header */}
      <div className="mb-8">
        <Link
          href="/dashboard"
          className="mb-3 inline-flex items-center gap-1 text-sm text-ld-slate transition-colors hover:text-ld-primary"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Dashboard
        </Link>
        <h1 className="font-display text-[32px] font-bold tracking-[-0.5px] text-ld-ink">
          Strategy Configuration
        </h1>
        <p className="mt-1 text-base text-ld-slate">
          Define how LiquiDOT manages your liquidity positions.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-[1fr_340px]">
        {/* Form column */}
        <form onSubmit={onSubmit}>
          <motion.div
            className="space-y-6"
            variants={staggerContainer}
            initial="hidden"
            animate="visible"
          >
            {/* Presets */}
            <motion.div variants={sectionVariants}>
              <PresetButtons
                selected={selectedPreset}
                onSelect={handlePresetSelect}
              />
            </motion.div>

            {/* Sections */}
            <motion.div
              variants={sectionVariants}
              className="rounded-xl bg-white p-6 shadow-[var(--shadow-card)]"
            >
              <InvestmentSection form={form} />
            </motion.div>

            <motion.div
              variants={sectionVariants}
              className="rounded-xl bg-white p-6 shadow-[var(--shadow-card)]"
            >
              <RangesSection form={form} />
            </motion.div>

            <motion.div
              variants={sectionVariants}
              className="rounded-xl bg-white p-6 shadow-[var(--shadow-card)]"
            >
              <PoolFiltersSection form={form} />
            </motion.div>

            <motion.div
              variants={sectionVariants}
              className="rounded-xl bg-white p-6 shadow-[var(--shadow-card)]"
            >
              <SafetySection form={form} />
            </motion.div>

            <motion.div
              variants={sectionVariants}
              className="rounded-xl bg-white p-6 shadow-[var(--shadow-card)]"
            >
              <AutomationSection form={form} />
            </motion.div>

            <motion.div
              variants={sectionVariants}
              className="rounded-xl bg-white p-6 shadow-[var(--shadow-card)]"
            >
              <AdvancedSection form={form} />
            </motion.div>

            {/* Save bar */}
            <motion.div
              variants={sectionVariants}
              className="flex flex-wrap items-center gap-4"
            >
              <motion.button
                type="submit"
                disabled={saveState === "saving"}
                whileTap={{ scale: 0.97 }}
                className={`inline-flex h-10 items-center gap-2 rounded-lg px-6 text-sm font-medium text-white transition-colors ${
                  saveState === "saved"
                    ? "bg-[#00C853]"
                    : "bg-ld-primary hover:bg-ld-primary/90"
                }`}
              >
                {saveState === "saving" && (
                  <Loader2 className="h-4 w-4 animate-spin" />
                )}
                {saveState === "saved" && <Check className="h-4 w-4" />}
                {saveState === "idle"
                  ? "Save Strategy"
                  : saveState === "saving"
                    ? "Saving..."
                    : "Saved"}
              </motion.button>

              <button
                type="button"
                onClick={handleReset}
                className="text-sm text-ld-slate transition-colors hover:text-ld-primary"
              >
                Reset to Defaults
              </button>
            </motion.div>
          </motion.div>
        </form>

        {/* Sidebar */}
        <div className="hidden lg:block">
          <StrategySidebar values={currentValues} />
        </div>

        {/* Mobile sidebar (below form) */}
        <div className="lg:hidden">
          <StrategySidebar values={currentValues} />
        </div>
      </div>
    </motion.div>
  );
}
