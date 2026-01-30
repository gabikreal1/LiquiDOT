import { Controller, Get } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { TestModeService, TestModeStatus } from './modules/blockchain/services/test-mode.service';

interface HealthStatus {
  status: 'ok' | 'degraded' | 'down';
  timestamp: string;
  service: string;
  version: string;
}

interface DetailedHealthStatus extends HealthStatus {
  checks: {
    database: { status: 'ok' | 'error'; latencyMs?: number; error?: string };
    uptime: number;
    memoryUsage: {
      heapUsed: number;
      heapTotal: number;
      rss: number;
    };
  };
}

@Controller('health')
export class HealthController {
  private readonly startTime = Date.now();

  constructor(
    @InjectDataSource()
    private dataSource: DataSource,
    private testModeService: TestModeService,
  ) {}

  /**
   * Basic health check
   * GET /health
   */
  @Get()
  check(): HealthStatus {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      service: 'liquidot-backend',
      version: '1.0.0',
    };
  }

  /**
   * Detailed health status
   * GET /health/detailed
   */
  @Get('detailed')
  async detailed(): Promise<DetailedHealthStatus> {
    const dbCheck = await this.checkDatabase();
    const memoryUsage = process.memoryUsage();

    const status = dbCheck.status === 'ok' ? 'ok' : 'degraded';

    return {
      status,
      timestamp: new Date().toISOString(),
      service: 'liquidot-backend',
      version: '1.0.0',
      checks: {
        database: dbCheck,
        uptime: Math.floor((Date.now() - this.startTime) / 1000),
        memoryUsage: {
          heapUsed: Math.floor(memoryUsage.heapUsed / 1024 / 1024),
          heapTotal: Math.floor(memoryUsage.heapTotal / 1024 / 1024),
          rss: Math.floor(memoryUsage.rss / 1024 / 1024),
        },
      },
    };
  }

  private async checkDatabase(): Promise<{ status: 'ok' | 'error'; latencyMs?: number; error?: string }> {
    try {
      const start = Date.now();
      await this.dataSource.query('SELECT 1');
      const latencyMs = Date.now() - start;
      return { status: 'ok', latencyMs };
    } catch (error) {
      return { 
        status: 'error', 
        error: error instanceof Error ? error.message : 'Unknown database error' 
      };
    }
  }

  /**
   * Test mode status
   * GET /health/test-mode
   */
  @Get('test-mode')
  async testModeStatus(): Promise<TestModeStatus> {
    return this.testModeService.getStatus();
  }
}
