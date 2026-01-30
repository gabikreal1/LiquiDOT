import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { DataSource } from 'typeorm';

/**
 * End-to-End Tests for LiquiDOT Backend API
 * 
 * These tests verify the complete request/response cycle including:
 * - HTTP endpoints
 * - Request validation
 * - Database interactions
 * - Response formats
 * 
 * Prerequisites:
 * - PostgreSQL database running (or use TEST_DB_* env vars)
 * - Environment variables configured
 */
describe('LiquiDOT API (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;

  beforeAll(async () => {
    // Set test environment
    process.env.NODE_ENV = 'test';
    process.env.TEST_MODE = 'true';

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    await app.init();

    dataSource = moduleFixture.get<DataSource>(DataSource);
  });

  afterAll(async () => {
    await app.close();
  });

  // =========================================================
  // Health Endpoints
  // =========================================================
  describe('Health Check Endpoints', () => {
    describe('GET /api/health', () => {
      it('should return ok status', () => {
        return request(app.getHttpServer())
          .get('/api/health')
          .expect(200)
          .expect((res) => {
            expect(res.body.status).toBe('ok');
            expect(res.body.service).toBe('liquidot-backend');
            expect(res.body.timestamp).toBeDefined();
          });
      });
    });

    describe('GET /api/health/detailed', () => {
      it('should return detailed health status', () => {
        return request(app.getHttpServer())
          .get('/api/health/detailed')
          .expect(200)
          .expect((res) => {
            expect(res.body.status).toBeDefined();
            expect(res.body.checks).toBeDefined();
            expect(res.body.checks.database).toBeDefined();
            expect(res.body.checks.uptime).toBeDefined();
            expect(res.body.checks.memoryUsage).toBeDefined();
          });
      });
    });

    describe('GET /api/health/test-mode', () => {
      it('should return test mode status', () => {
        return request(app.getHttpServer())
          .get('/api/health/test-mode')
          .expect(200)
          .expect((res) => {
            expect(res.body.backendTestMode).toBeDefined();
            expect(res.body.synchronized).toBeDefined();
          });
      });
    });
  });

  // =========================================================
  // User Endpoints
  // =========================================================
  describe('User Endpoints', () => {
    const testWalletAddress = '0xe2e2e2e2e2e2e2e2e2e2e2e2e2e2e2e2e2e2e2e2';

    describe('POST /api/users', () => {
      it('should create a new user', () => {
        return request(app.getHttpServer())
          .post('/api/users')
          .send({ walletAddress: testWalletAddress })
          .expect(201)
          .expect((res) => {
            expect(res.body.walletAddress.toLowerCase()).toBe(testWalletAddress.toLowerCase());
            expect(res.body.isActive).toBe(true);
          });
      });

      it('should return existing user if already registered', () => {
        return request(app.getHttpServer())
          .post('/api/users')
          .send({ walletAddress: testWalletAddress })
          .expect(201)
          .expect((res) => {
            expect(res.body.walletAddress.toLowerCase()).toBe(testWalletAddress.toLowerCase());
          });
      });

      it('should return 400 for invalid wallet address', () => {
        return request(app.getHttpServer())
          .post('/api/users')
          .send({ walletAddress: 'invalid' })
          .expect(400);
      });

      it('should return 400 for missing wallet address', () => {
        return request(app.getHttpServer())
          .post('/api/users')
          .send({})
          .expect(400);
      });
    });

    describe('GET /api/users/:address', () => {
      it('should return user by wallet address', () => {
        return request(app.getHttpServer())
          .get(`/api/users/${testWalletAddress}`)
          .expect(200)
          .expect((res) => {
            expect(res.body.walletAddress.toLowerCase()).toBe(testWalletAddress.toLowerCase());
          });
      });

      it('should return 404 for non-existent user', () => {
        return request(app.getHttpServer())
          .get('/api/users/0x0000000000000000000000000000000000000000')
          .expect(404);
      });
    });
  });

  // =========================================================
  // Investment Decision Endpoints
  // =========================================================
  describe('Investment Decision Endpoints', () => {
    const testWalletAddress = '0xf3f3f3f3f3f3f3f3f3f3f3f3f3f3f3f3f3f3f3f3';

    // Create test user first
    beforeAll(async () => {
      await request(app.getHttpServer())
        .post('/api/users')
        .send({ walletAddress: testWalletAddress });
    });

    describe('POST /api/investmentDecisions', () => {
      it('should return investment decisions for valid request', () => {
        return request(app.getHttpServer())
          .post('/api/investmentDecisions')
          .send({
            walletAddress: testWalletAddress,
            depositAmount: 1000,
            selectedDepositCoin: 'USDC',
            preferences: {
              minApy: 8,
              maxAllocation: 25,
              riskStrategy: 'moderate',
            },
          })
          .expect(200)
          .expect((res) => {
            expect(res.body).toHaveProperty('success');
            expect(res.body).toHaveProperty('decisions');
            expect(Array.isArray(res.body.decisions)).toBe(true);
          });
      });

      it('should return 400 for missing walletAddress', () => {
        return request(app.getHttpServer())
          .post('/api/investmentDecisions')
          .send({
            depositAmount: 1000,
          })
          .expect(400);
      });

      it('should return error response for zero deposit amount', () => {
        return request(app.getHttpServer())
          .post('/api/investmentDecisions')
          .send({
            walletAddress: testWalletAddress,
            depositAmount: 0,
          })
          .expect(200)
          .expect((res) => {
            expect(res.body.success).toBe(false);
            expect(res.body.message).toContain('No deposit amount');
          });
      });

      it('should include metadata in successful response', () => {
        return request(app.getHttpServer())
          .post('/api/investmentDecisions')
          .send({
            walletAddress: testWalletAddress,
            depositAmount: 500,
            preferences: {
              riskStrategy: 'conservative',
            },
          })
          .expect(200)
          .expect((res) => {
            if (res.body.success && res.body.decisions.length > 0) {
              expect(res.body.metadata).toBeDefined();
              expect(res.body.metadata.totalCapitalUsd).toBeDefined();
              expect(res.body.metadata.shouldRebalance).toBeDefined();
            }
          });
      });

      it('should include pool details in decisions', () => {
        return request(app.getHttpServer())
          .post('/api/investmentDecisions')
          .send({
            walletAddress: testWalletAddress,
            depositAmount: 1000,
          })
          .expect(200)
          .expect((res) => {
            if (res.body.success && res.body.decisions.length > 0) {
              const decision = res.body.decisions[0];
              expect(decision).toHaveProperty('poolId');
              expect(decision).toHaveProperty('pairName');
              expect(decision).toHaveProperty('approximateAPR');
              expect(decision).toHaveProperty('proportion');
              expect(decision).toHaveProperty('stopLoss');
              expect(decision).toHaveProperty('takeProfit');
            }
          });
      });
    });

    describe('GET /api/investmentDecisions/wallet/:address', () => {
      it('should return decisions for valid wallet', () => {
        return request(app.getHttpServer())
          .get(`/api/investmentDecisions/wallet/${testWalletAddress}`)
          .expect(200)
          .expect((res) => {
            expect(res.body).toHaveProperty('success');
            expect(res.body).toHaveProperty('decisions');
          });
      });
    });
  });

  // =========================================================
  // Pool Endpoints
  // =========================================================
  describe('Pool Endpoints', () => {
    describe('GET /api/pools', () => {
      it('should return list of pools', () => {
        return request(app.getHttpServer())
          .get('/api/pools')
          .expect(200)
          .expect((res) => {
            expect(Array.isArray(res.body)).toBe(true);
          });
      });
    });

    describe('GET /api/pools/active', () => {
      it('should return active pools only', () => {
        return request(app.getHttpServer())
          .get('/api/pools/active')
          .expect(200)
          .expect((res) => {
            expect(Array.isArray(res.body)).toBe(true);
            res.body.forEach((pool: any) => {
              expect(pool.isActive).toBe(true);
            });
          });
      });
    });
  });

  // =========================================================
  // Position Endpoints
  // =========================================================
  describe('Position Endpoints', () => {
    const testWalletAddress = '0xf4f4f4f4f4f4f4f4f4f4f4f4f4f4f4f4f4f4f4f4';

    describe('GET /api/positions/user/:address', () => {
      it('should return empty array for user with no positions', () => {
        return request(app.getHttpServer())
          .get(`/api/positions/user/${testWalletAddress}`)
          .expect(200)
          .expect((res) => {
            expect(Array.isArray(res.body)).toBe(true);
          });
      });
    });

    describe('GET /api/positions/active/:address', () => {
      it('should return active positions for user', () => {
        return request(app.getHttpServer())
          .get(`/api/positions/active/${testWalletAddress}`)
          .expect(200)
          .expect((res) => {
            expect(Array.isArray(res.body)).toBe(true);
          });
      });
    });
  });

  // =========================================================
  // Preferences Endpoints
  // =========================================================
  describe('Preferences Endpoints', () => {
    const testWalletAddress = '0xf5f5f5f5f5f5f5f5f5f5f5f5f5f5f5f5f5f5f5f5';

    // Create test user first
    beforeAll(async () => {
      await request(app.getHttpServer())
        .post('/api/users')
        .send({ walletAddress: testWalletAddress });
    });

    describe('GET /api/preferences/:address', () => {
      it('should return default preferences for new user', () => {
        return request(app.getHttpServer())
          .get(`/api/preferences/${testWalletAddress}`)
          .expect(200)
          .expect((res) => {
            expect(res.body).toHaveProperty('minApy');
            expect(res.body).toHaveProperty('maxAllocation');
          });
      });
    });

    describe('PUT /api/preferences/:address', () => {
      it('should update user preferences', () => {
        return request(app.getHttpServer())
          .put(`/api/preferences/${testWalletAddress}`)
          .send({
            minApy: 10,
            maxAllocation: 30,
            riskTolerance: 'moderate',
          })
          .expect(200)
          .expect((res) => {
            expect(res.body.minApy).toBe(10);
            expect(res.body.maxAllocation).toBe(30);
          });
      });
    });
  });

  // =========================================================
  // Error Handling
  // =========================================================
  describe('Error Handling', () => {
    it('should return 404 for unknown routes', () => {
      return request(app.getHttpServer())
        .get('/api/unknown-endpoint')
        .expect(404);
    });

    it('should return 400 for malformed JSON', () => {
      return request(app.getHttpServer())
        .post('/api/investmentDecisions')
        .set('Content-Type', 'application/json')
        .send('{ invalid json }')
        .expect(400);
    });
  });
});
