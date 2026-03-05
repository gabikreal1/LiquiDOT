import type { UserPreference } from "@/lib/types/preferences";

export const mockPreferences: UserPreference = {
  // Investment Strategy — Balanced preset
  minApy: 10,
  maxPositions: 6,
  maxAllocPerPositionUsd: 25000,
  minPositionSizeUsd: 45,

  // Position Ranges
  defaultLowerRangePercent: -5,
  defaultUpperRangePercent: 15,

  // Pool Filters
  minTvlUsd: 1000000,
  minPoolAgeDays: 14,
  allowedTokens: null,
  preferredDexes: null,

  // Safety
  maxIlLossPercent: 6.0,
  dailyRebalanceLimit: 8,
  expectedGasUsd: 1.0,

  // Automation
  autoInvestEnabled: true,
  investmentCheckIntervalSeconds: 14400,

  // Advanced
  lambdaRiskAversion: 0.5,
  thetaMinBenefit: 0.0,
  planningHorizonDays: 7,
};
