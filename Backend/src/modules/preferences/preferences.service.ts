/**
 * Preferences Service
 * 
 * CRUD operations for UserPreference entity.
 * Manages investment strategy configuration per user.
 */

import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserPreference } from './entities/user-preference.entity';

/**
 * DTO for creating user preferences
 */
export interface CreatePreferenceDto {
  // Investment Strategy Parameters
  minApy?: number;
  maxPositions?: number;
  maxAllocPerPositionUsd?: number;
  dailyRebalanceLimit?: number;
  expectedGasUsd?: number;
  lambdaRiskAversion?: number;
  thetaMinBenefit?: number;
  planningHorizonDays?: number;

  // Pool Filtering
  minTvlUsd?: number;
  minPoolAgeDays?: number;
  allowedTokens?: string[];
  preferredDexes?: string[];

  // Position Range
  defaultLowerRangePercent?: number;
  defaultUpperRangePercent?: number;

  // Safety
  maxIlLossPercent?: number;
  minPositionSizeUsd?: number;

  // Automation
  autoInvestEnabled?: boolean;
  investmentCheckIntervalSeconds?: number;
}

/**
 * Update DTO (same as create, all optional)
 */
export type UpdatePreferenceDto = Partial<CreatePreferenceDto>;

/**
 * Effective preferences with defaults applied
 */
export interface EffectivePreferences {
  // Investment Strategy
  minApy: number;
  maxPositions: number;
  maxAllocPerPositionUsd: number;
  dailyRebalanceLimit: number;
  expectedGasUsd: number;
  lambdaRiskAversion: number;
  thetaMinBenefit: number;
  planningHorizonDays: number;

  // Pool Filtering
  minTvlUsd: number;
  minPoolAgeDays: number;
  allowedTokens: string[];
  preferredDexes: string[];

  // Position Range
  defaultLowerRangePercent: number;
  defaultUpperRangePercent: number;

  // Safety
  maxIlLossPercent: number;
  minPositionSizeUsd: number;

  // Automation
  autoInvestEnabled: boolean;
  investmentCheckIntervalSeconds: number;
}

/**
 * Default preference values from defi_investment_bot_spec.md
 */
const DEFAULT_PREFERENCES: EffectivePreferences = {
  minApy: 8.0,
  maxPositions: 6,
  maxAllocPerPositionUsd: 25000,
  dailyRebalanceLimit: 8,
  expectedGasUsd: 1.0,
  lambdaRiskAversion: 0.5,
  thetaMinBenefit: 0.0,
  planningHorizonDays: 7,
  minTvlUsd: 1000000,
  minPoolAgeDays: 14,
  allowedTokens: ['USDC', 'USDT', 'WETH', 'WGLMR', 'xcDOT'],
  preferredDexes: [],
  defaultLowerRangePercent: -5,
  defaultUpperRangePercent: 10,
  maxIlLossPercent: 6.0,
  minPositionSizeUsd: 3000,
  autoInvestEnabled: true,
  investmentCheckIntervalSeconds: 14400, // 4 hours
};

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

@Injectable()
export class PreferencesService {
  private readonly logger = new Logger(PreferencesService.name);

  constructor(
    @InjectRepository(UserPreference)
    private preferenceRepository: Repository<UserPreference>,
  ) {}

  /**
   * Create preferences for a user
   */
  async create(userId: string, data: CreatePreferenceDto): Promise<UserPreference> {
    // Validate
    const validation = this.validatePreferences(data);
    if (!validation.valid) {
      throw new BadRequestException(validation.errors.join(', '));
    }

    // Check if already exists
    const existing = await this.findByUser(userId);
    if (existing) {
      throw new BadRequestException(`Preferences already exist for user ${userId}. Use update instead.`);
    }

    const preference = this.preferenceRepository.create({
      userId,
      minApy: data.minApy?.toString() || DEFAULT_PREFERENCES.minApy.toString(),
      maxPositions: data.maxPositions ?? DEFAULT_PREFERENCES.maxPositions,
      maxAllocPerPositionUsd: data.maxAllocPerPositionUsd?.toString() || DEFAULT_PREFERENCES.maxAllocPerPositionUsd.toString(),
      dailyRebalanceLimit: data.dailyRebalanceLimit ?? DEFAULT_PREFERENCES.dailyRebalanceLimit,
      expectedGasUsd: data.expectedGasUsd?.toString() || DEFAULT_PREFERENCES.expectedGasUsd.toString(),
      lambdaRiskAversion: data.lambdaRiskAversion?.toString() || DEFAULT_PREFERENCES.lambdaRiskAversion.toString(),
      thetaMinBenefit: data.thetaMinBenefit?.toString() || DEFAULT_PREFERENCES.thetaMinBenefit.toString(),
      planningHorizonDays: data.planningHorizonDays ?? DEFAULT_PREFERENCES.planningHorizonDays,
      minTvlUsd: data.minTvlUsd?.toString() || DEFAULT_PREFERENCES.minTvlUsd.toString(),
      minPoolAgeDays: data.minPoolAgeDays ?? DEFAULT_PREFERENCES.minPoolAgeDays,
      allowedTokens: data.allowedTokens ?? DEFAULT_PREFERENCES.allowedTokens,
      preferredDexes: data.preferredDexes ?? DEFAULT_PREFERENCES.preferredDexes,
      defaultLowerRangePercent: data.defaultLowerRangePercent ?? DEFAULT_PREFERENCES.defaultLowerRangePercent,
      defaultUpperRangePercent: data.defaultUpperRangePercent ?? DEFAULT_PREFERENCES.defaultUpperRangePercent,
      maxIlLossPercent: data.maxIlLossPercent?.toString() || DEFAULT_PREFERENCES.maxIlLossPercent.toString(),
      minPositionSizeUsd: data.minPositionSizeUsd?.toString() || DEFAULT_PREFERENCES.minPositionSizeUsd.toString(),
      autoInvestEnabled: data.autoInvestEnabled ?? DEFAULT_PREFERENCES.autoInvestEnabled,
      investmentCheckIntervalSeconds: data.investmentCheckIntervalSeconds ?? DEFAULT_PREFERENCES.investmentCheckIntervalSeconds,
    });

    const saved = await this.preferenceRepository.save(preference);
    this.logger.log(`Created preferences for user ${userId}`);
    return saved;
  }

  /**
   * Find preferences by user ID
   */
  async findByUser(userId: string): Promise<UserPreference | null> {
    return this.preferenceRepository.findOne({
      where: { userId },
    });
  }

  /**
   * Update preferences
   */
  async update(userId: string, data: UpdatePreferenceDto): Promise<UserPreference> {
    const existing = await this.findByUser(userId);
    if (!existing) {
      // Auto-create with provided data
      return this.create(userId, data);
    }

    // Validate
    const validation = this.validatePreferences(data);
    if (!validation.valid) {
      throw new BadRequestException(validation.errors.join(', '));
    }

    // Build update object
    const updateData: Partial<UserPreference> = {};

    if (data.minApy !== undefined) updateData.minApy = data.minApy.toString();
    if (data.maxPositions !== undefined) updateData.maxPositions = data.maxPositions;
    if (data.maxAllocPerPositionUsd !== undefined) updateData.maxAllocPerPositionUsd = data.maxAllocPerPositionUsd.toString();
    if (data.dailyRebalanceLimit !== undefined) updateData.dailyRebalanceLimit = data.dailyRebalanceLimit;
    if (data.expectedGasUsd !== undefined) updateData.expectedGasUsd = data.expectedGasUsd.toString();
    if (data.lambdaRiskAversion !== undefined) updateData.lambdaRiskAversion = data.lambdaRiskAversion.toString();
    if (data.thetaMinBenefit !== undefined) updateData.thetaMinBenefit = data.thetaMinBenefit.toString();
    if (data.planningHorizonDays !== undefined) updateData.planningHorizonDays = data.planningHorizonDays;
    if (data.minTvlUsd !== undefined) updateData.minTvlUsd = data.minTvlUsd.toString();
    if (data.minPoolAgeDays !== undefined) updateData.minPoolAgeDays = data.minPoolAgeDays;
    if (data.allowedTokens !== undefined) updateData.allowedTokens = data.allowedTokens;
    if (data.preferredDexes !== undefined) updateData.preferredDexes = data.preferredDexes;
    if (data.defaultLowerRangePercent !== undefined) updateData.defaultLowerRangePercent = data.defaultLowerRangePercent;
    if (data.defaultUpperRangePercent !== undefined) updateData.defaultUpperRangePercent = data.defaultUpperRangePercent;
    if (data.maxIlLossPercent !== undefined) updateData.maxIlLossPercent = data.maxIlLossPercent.toString();
    if (data.minPositionSizeUsd !== undefined) updateData.minPositionSizeUsd = data.minPositionSizeUsd.toString();
    if (data.autoInvestEnabled !== undefined) updateData.autoInvestEnabled = data.autoInvestEnabled;
    if (data.investmentCheckIntervalSeconds !== undefined) updateData.investmentCheckIntervalSeconds = data.investmentCheckIntervalSeconds;

    await this.preferenceRepository.update({ userId }, updateData);
    this.logger.log(`Updated preferences for user ${userId}`);
    
    return this.findByUser(userId) as Promise<UserPreference>;
  }

  /**
   * Delete preferences
   */
  async delete(userId: string): Promise<void> {
    const result = await this.preferenceRepository.delete({ userId });
    if (result.affected === 0) {
      throw new NotFoundException(`Preferences not found for user ${userId}`);
    }
    this.logger.log(`Deleted preferences for user ${userId}`);
  }

  /**
   * Get effective preferences with defaults applied
   */
  async getEffectivePreferences(userId: string): Promise<EffectivePreferences> {
    const pref = await this.findByUser(userId);

    if (!pref) {
      return { ...DEFAULT_PREFERENCES };
    }

    return {
      minApy: parseFloat(pref.minApy) || DEFAULT_PREFERENCES.minApy,
      maxPositions: pref.maxPositions || DEFAULT_PREFERENCES.maxPositions,
      maxAllocPerPositionUsd: parseFloat(pref.maxAllocPerPositionUsd) || DEFAULT_PREFERENCES.maxAllocPerPositionUsd,
      dailyRebalanceLimit: pref.dailyRebalanceLimit || DEFAULT_PREFERENCES.dailyRebalanceLimit,
      expectedGasUsd: parseFloat(pref.expectedGasUsd) || DEFAULT_PREFERENCES.expectedGasUsd,
      lambdaRiskAversion: parseFloat(pref.lambdaRiskAversion) || DEFAULT_PREFERENCES.lambdaRiskAversion,
      thetaMinBenefit: parseFloat(pref.thetaMinBenefit) || DEFAULT_PREFERENCES.thetaMinBenefit,
      planningHorizonDays: pref.planningHorizonDays || DEFAULT_PREFERENCES.planningHorizonDays,
      minTvlUsd: parseFloat(pref.minTvlUsd) || DEFAULT_PREFERENCES.minTvlUsd,
      minPoolAgeDays: pref.minPoolAgeDays || DEFAULT_PREFERENCES.minPoolAgeDays,
      allowedTokens: pref.allowedTokens || DEFAULT_PREFERENCES.allowedTokens,
      preferredDexes: pref.preferredDexes || DEFAULT_PREFERENCES.preferredDexes,
      defaultLowerRangePercent: pref.defaultLowerRangePercent ?? DEFAULT_PREFERENCES.defaultLowerRangePercent,
      defaultUpperRangePercent: pref.defaultUpperRangePercent ?? DEFAULT_PREFERENCES.defaultUpperRangePercent,
      maxIlLossPercent: parseFloat(pref.maxIlLossPercent) || DEFAULT_PREFERENCES.maxIlLossPercent,
      minPositionSizeUsd: parseFloat(pref.minPositionSizeUsd) || DEFAULT_PREFERENCES.minPositionSizeUsd,
      autoInvestEnabled: pref.autoInvestEnabled ?? DEFAULT_PREFERENCES.autoInvestEnabled,
      investmentCheckIntervalSeconds: pref.investmentCheckIntervalSeconds || DEFAULT_PREFERENCES.investmentCheckIntervalSeconds,
    };
  }

  /**
   * Validate preference values
   */
  validatePreferences(data: CreatePreferenceDto): ValidationResult {
    const errors: string[] = [];

    // APY validation
    if (data.minApy !== undefined && (data.minApy < 0 || data.minApy > 1000)) {
      errors.push('minApy must be between 0 and 1000');
    }

    // Max positions validation
    if (data.maxPositions !== undefined && (data.maxPositions < 1 || data.maxPositions > 50)) {
      errors.push('maxPositions must be between 1 and 50');
    }

    // Allocation validation
    if (data.maxAllocPerPositionUsd !== undefined && data.maxAllocPerPositionUsd < 100) {
      errors.push('maxAllocPerPositionUsd must be at least 100');
    }

    // Risk aversion validation (lambda)
    if (data.lambdaRiskAversion !== undefined && (data.lambdaRiskAversion < 0 || data.lambdaRiskAversion > 2)) {
      errors.push('lambdaRiskAversion must be between 0 and 2');
    }

    // Range percent validation
    if (data.defaultLowerRangePercent !== undefined && data.defaultLowerRangePercent > 0) {
      errors.push('defaultLowerRangePercent must be negative or zero');
    }

    if (data.defaultUpperRangePercent !== undefined && data.defaultUpperRangePercent < 0) {
      errors.push('defaultUpperRangePercent must be positive or zero');
    }

    // Interval validation
    if (data.investmentCheckIntervalSeconds !== undefined && data.investmentCheckIntervalSeconds < 60) {
      errors.push('investmentCheckIntervalSeconds must be at least 60 seconds');
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Toggle auto-invest setting
   */
  async setAutoInvest(userId: string, enabled: boolean): Promise<UserPreference> {
    const existing = await this.findByUser(userId);
    
    if (!existing) {
      return this.create(userId, { autoInvestEnabled: enabled });
    }

    await this.preferenceRepository.update({ userId }, { autoInvestEnabled: enabled });
    this.logger.log(`Set auto-invest to ${enabled} for user ${userId}`);
    
    return this.findByUser(userId) as Promise<UserPreference>;
  }

  /**
   * Get default preferences (for new users)
   */
  getDefaults(): EffectivePreferences {
    return { ...DEFAULT_PREFERENCES };
  }
}
