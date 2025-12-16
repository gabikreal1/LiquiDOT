import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserPreference } from './entities/user-preference.entity';

@Injectable()
export class PreferencesService {
  constructor(
    @InjectRepository(UserPreference)
    private readonly prefRepo: Repository<UserPreference>,
  ) {}

  async getByUserId(userId: string): Promise<UserPreference | null> {
    return this.prefRepo.findOne({ where: { userId } });
  }

  async upsertForUser(
    userId: string,
    dto: Partial<
      Pick<
        UserPreference,
        | 'minApr'
        | 'minTvl'
        | 'defaultLowerRangePercent'
        | 'defaultUpperRangePercent'
        | 'investmentCheckIntervalSeconds'
        | 'preferredDexes'
        | 'preferredTokens'
        | 'autoInvestEnabled'
      >
    >,
  ): Promise<UserPreference> {
    const existing = await this.prefRepo.findOne({ where: { userId } });

    if (!existing) {
      const created = this.prefRepo.create({
        userId,
        minApr: dto.minApr ?? 0,
        minTvl: dto.minTvl ?? '0',
        defaultLowerRangePercent: dto.defaultLowerRangePercent ?? -5,
        defaultUpperRangePercent: dto.defaultUpperRangePercent ?? 10,
        investmentCheckIntervalSeconds: dto.investmentCheckIntervalSeconds ?? 3600,
        preferredDexes: dto.preferredDexes ?? [],
        preferredTokens: dto.preferredTokens ?? [],
        autoInvestEnabled: dto.autoInvestEnabled ?? true,
      });
      return this.prefRepo.save(created);
    }

    this.prefRepo.merge(existing, {
      ...dto,
      userId,
    });
    return this.prefRepo.save(existing);
  }
}
