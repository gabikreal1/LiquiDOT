import { Test, TestingModule } from '@nestjs/testing';
import { HealthController } from './health.controller';
import { DataSource } from 'typeorm';
import { TestModeService, TestModeStatus } from './modules/blockchain/services/test-mode.service';

describe('HealthController', () => {
  let controller: HealthController;
  let dataSource: jest.Mocked<DataSource>;
  let testModeService: jest.Mocked<TestModeService>;

  beforeEach(async () => {
    const mockDataSource = {
      query: jest.fn().mockResolvedValue([{ 1: 1 }]),
    };

    const mockTestModeService = {
      getStatus: jest.fn().mockResolvedValue({
        backendTestMode: true,
        xcmProxyTestMode: null,
        assetHubTestMode: null,
        synchronized: true,
        lastSyncTime: null,
      } as TestModeStatus),
      isTestMode: jest.fn().mockReturnValue(true),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [
        {
          provide: DataSource,
          useValue: mockDataSource,
        },
        {
          provide: TestModeService,
          useValue: mockTestModeService,
        },
      ],
    }).compile();

    controller = module.get<HealthController>(HealthController);
    dataSource = module.get(DataSource);
    testModeService = module.get(TestModeService);
  });

  describe('GET /health', () => {
    it('should return ok status', () => {
      const result = controller.check();

      expect(result.status).toBe('ok');
      expect(result.service).toBe('liquidot-backend');
      expect(result.version).toBe('1.0.0');
      expect(result.timestamp).toBeDefined();
    });
  });

  describe('GET /health/detailed', () => {
    it('should return detailed health status with database check', async () => {
      const result = await controller.detailed();

      expect(result.status).toBe('ok');
      expect(result.checks.database.status).toBe('ok');
      expect(result.checks.database.latencyMs).toBeDefined();
      expect(result.checks.uptime).toBeGreaterThanOrEqual(0);
      expect(result.checks.memoryUsage).toBeDefined();
    });

    it('should return degraded status on database error', async () => {
      dataSource.query.mockRejectedValue(new Error('Connection failed'));

      const result = await controller.detailed();

      expect(result.status).toBe('degraded');
      expect(result.checks.database.status).toBe('error');
      expect(result.checks.database.error).toContain('Connection failed');
    });
  });

  describe('GET /health/test-mode', () => {
    it('should return test mode status', async () => {
      const result = await controller.testModeStatus();

      expect(result.backendTestMode).toBe(true);
      expect(result.synchronized).toBe(true);
      expect(testModeService.getStatus).toHaveBeenCalled();
    });
  });
});
