import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ActivityLog, ActivityType, ActivityStatus } from './entities/activity-log.entity';

@Injectable()
export class ActivityLogsService {
    constructor(
        @InjectRepository(ActivityLog)
        private repo: Repository<ActivityLog>,
    ) { }

    async createLog(data: {
        userId: string;
        type: ActivityType;
        status: ActivityStatus;
        details?: any;
        txHash?: string;
        positionId?: string;
    }) {
        const log = this.repo.create(data);
        return this.repo.save(log);
    }

    async updateStatus(id: string, status: ActivityStatus, updates?: Partial<ActivityLog>) {
        await this.repo.update(id, { status, ...updates });
    }

    async findByUser(userId: string, limit = 20, offset = 0) {
        return this.repo.findAndCount({
            where: { userId },
            order: { createdAt: 'DESC' },
            take: limit,
            skip: offset,
        });
    }
}
