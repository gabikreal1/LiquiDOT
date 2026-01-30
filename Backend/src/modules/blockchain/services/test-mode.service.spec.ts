import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { TestModeService, TestModeStatus } from './test-mode.service';

describe('TestModeService', () => {
  let service: TestModeService;
  let configService: jest.Mocked<ConfigService>;

  describe('when TEST_MODE is true', () => {
    beforeEach(async () => {
      const mockConfigService = {
        get: jest.fn((key: string, defaultValue?: string) => {
          const config: Record<string, string> = {
            TEST_MODE: 'true',
            NODE_ENV: 'development',
            MOONBEAM_RPC_URL: '',
            ASSET_HUB_RPC_URL: '',
            MOONBEAM_XCM_PROXY_ADDRESS: '',
            ASSET_HUB_VAULT_ADDRESS: '',
            RELAYER_PRIVATE_KEY: '',
          };
          return config[key] ?? defaultValue;
        }),
      };

      const module: TestingModule = await Test.createTestingModule({
        providers: [
          TestModeService,
          {
            provide: ConfigService,
            useValue: mockConfigService,
          },
        ],
      }).compile();

      service = module.get<TestModeService>(TestModeService);
      configService = module.get(ConfigService);
    });

    it('should be defined', () => {
      expect(service).toBeDefined();
    });

    it('should return true for isTestMode()', () => {
      expect(service.isTestMode()).toBe(true);
    });

    it('should return status with backendTestMode true', async () => {
      const status = await service.getStatus();
      expect(status.backendTestMode).toBe(true);
    });
  });

  describe('when TEST_MODE is false', () => {
    beforeEach(async () => {
      const mockConfigService = {
        get: jest.fn((key: string, defaultValue?: string) => {
          const config: Record<string, string> = {
            TEST_MODE: 'false',
            NODE_ENV: 'production',
            MOONBEAM_RPC_URL: '',
            ASSET_HUB_RPC_URL: '',
            MOONBEAM_XCM_PROXY_ADDRESS: '',
            ASSET_HUB_VAULT_ADDRESS: '',
            RELAYER_PRIVATE_KEY: '',
          };
          return config[key] ?? defaultValue;
        }),
      };

      const module: TestingModule = await Test.createTestingModule({
        providers: [
          TestModeService,
          {
            provide: ConfigService,
            useValue: mockConfigService,
          },
        ],
      }).compile();

      service = module.get<TestModeService>(TestModeService);
    });

    it('should return false for isTestMode()', () => {
      expect(service.isTestMode()).toBe(false);
    });
  });

  describe('when NODE_ENV is development', () => {
    beforeEach(async () => {
      const mockConfigService = {
        get: jest.fn((key: string, defaultValue?: string) => {
          const config: Record<string, string> = {
            TEST_MODE: 'false',
            NODE_ENV: 'development',
            MOONBEAM_RPC_URL: '',
            ASSET_HUB_RPC_URL: '',
            MOONBEAM_XCM_PROXY_ADDRESS: '',
            ASSET_HUB_VAULT_ADDRESS: '',
            RELAYER_PRIVATE_KEY: '',
          };
          return config[key] ?? defaultValue;
        }),
      };

      const module: TestingModule = await Test.createTestingModule({
        providers: [
          TestModeService,
          {
            provide: ConfigService,
            useValue: mockConfigService,
          },
        ],
      }).compile();

      service = module.get<TestModeService>(TestModeService);
    });

    it('should enable test mode automatically in development', () => {
      expect(service.isTestMode()).toBe(true);
    });
  });

  describe('getStatus()', () => {
    beforeEach(async () => {
      const mockConfigService = {
        get: jest.fn((key: string, defaultValue?: string) => {
          const config: Record<string, string> = {
            TEST_MODE: 'true',
            NODE_ENV: 'test',
            MOONBEAM_RPC_URL: '',
            ASSET_HUB_RPC_URL: '',
          };
          return config[key] ?? defaultValue;
        }),
      };

      const module: TestingModule = await Test.createTestingModule({
        providers: [
          TestModeService,
          {
            provide: ConfigService,
            useValue: mockConfigService,
          },
        ],
      }).compile();

      service = module.get<TestModeService>(TestModeService);
    });

    it('should return TestModeStatus object', async () => {
      const status = await service.getStatus();
      
      expect(status).toHaveProperty('backendTestMode');
      expect(status).toHaveProperty('xcmProxyTestMode');
      expect(status).toHaveProperty('assetHubTestMode');
      expect(status).toHaveProperty('synchronized');
      expect(status).toHaveProperty('lastSyncTime');
    });

    it('should mark as synchronized when contracts are not connected', async () => {
      const status = await service.getStatus();
      
      // When contracts are not connected (null), it's considered synchronized
      expect(status.xcmProxyTestMode).toBeNull();
      expect(status.assetHubTestMode).toBeNull();
      expect(status.synchronized).toBe(true);
    });
  });
});
