import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppE2eModule } from './app-e2e.module';

describe('App (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppE2eModule],
    }).compile();

    app = moduleRef.createNestApplication();
    // Mirror main.ts global prefix so routes match production.
    app.setGlobalPrefix('api');
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /api/health returns ok', async () => {
    const res = await request(app.getHttpServer()).get('/api/health');

    expect(res.status).toBe(200);
    expect(res.body).toEqual(
      expect.objectContaining({
        status: 'ok',
        service: 'liquidot-backend',
      }),
    );
    expect(typeof res.body.timestamp).toBe('string');
  });

  it('GET /api/pools returns pool list', async () => {
    const res = await request(app.getHttpServer()).get('/api/pools');

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThanOrEqual(2);
    expect(res.body[0]).toEqual(expect.objectContaining({ id: expect.any(String), poolAddress: expect.any(String) }));
  });

  it('GET /api/pools/:id returns pool by id', async () => {
    const res = await request(app.getHttpServer()).get('/api/pools/pool-1');

    expect(res.status).toBe(200);
    expect(res.body).toEqual(expect.objectContaining({ id: 'pool-1', poolAddress: '0xpool1' }));
  });

  it('GET /api/pools/sync/status returns configuration info', async () => {
    const res = await request(app.getHttpServer()).get('/api/pools/sync/status');

    expect(res.status).toBe(200);
    expect(res.body).toEqual(
      expect.objectContaining({
        configured: expect.any(Boolean),
        subgraphUrl: expect.anything(),
      }),
    );
  });

  it('POST /api/pools/sync triggers sync', async () => {
    const res = await request(app.getHttpServer()).post('/api/pools/sync');

    expect(res.status).toBe(201);
    expect(res.body).toEqual({ ok: true });
  });

  it('GET /api/users/:userId/preferences returns preferences', async () => {
    const res = await request(app.getHttpServer()).get('/api/users/user-1/preferences');

    expect(res.status).toBe(200);
    expect(res.body).toEqual(
      expect.objectContaining({
        userId: 'user-1',
        minApr: expect.any(Number),
        minTvl: expect.any(String),
      }),
    );
  });

  it('PUT /api/users/:userId/preferences updates preferences', async () => {
    const res = await request(app.getHttpServer())
      .put('/api/users/user-1/preferences')
      .send({ minApr: 900, minTvl: '2000000', autoInvestEnabled: false });

    expect(res.status).toBe(200);
    expect(res.body).toEqual(
      expect.objectContaining({
        userId: 'user-1',
        minApr: 900,
        minTvl: '2000000',
        autoInvestEnabled: false,
      }),
    );
  });

  it('GET /api/users/:userId/positions returns positions', async () => {
    const res = await request(app.getHttpServer()).get('/api/users/user-1/positions');

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThanOrEqual(1);
    expect(res.body[0]).toEqual(expect.objectContaining({ id: 'pos-1', status: 'ACTIVE', pool: expect.any(Object) }));
  });

  it('GET /api/users/:userId/positions?status=ACTIVE filters by status', async () => {
    const res = await request(app.getHttpServer()).get('/api/users/user-1/positions?status=ACTIVE');

    expect(res.status).toBe(200);
    expect(res.body.every((p: any) => p.status === 'ACTIVE')).toBe(true);
  });

  it('POST /api/users/:userId/decision/run returns a decision object', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/users/user-1/decision/run')
      .send({
        totalCapitalUsd: 10_000,
        rebalancesToday: 0,
        baseAssetAddress: '0xbase',
      });

    expect(res.status).toBe(201);
    expect(res.body).toEqual(
      expect.objectContaining({
        decisionId: expect.any(String),
        shouldExecute: expect.any(Boolean),
        reasons: expect.any(Array),
        idealPositions: expect.any(Array),
        actions: expect.any(Object),
        metrics: expect.any(Object),
      }),
    );
  });

  it('POST /api/users/:userId/decision/execute is gated by env (skips by default)', async () => {
    const fakeDecision = {
      decisionId: 'd1',
      createdAt: new Date().toISOString(),
      eligibleCandidates: [],
      idealPositions: [],
      actions: { toWithdraw: [], toAdd: [], toAdjust: [] },
      metrics: {
        currentWeightedApyPct: 0,
        idealWeightedApyPct: 0,
        estimatedGasTotalUsd: 0,
        profit30dUsd: 0,
        netProfit30dUsd: 0,
      },
      shouldExecute: true,
      reasons: [],
    };

    const res = await request(app.getHttpServer())
      .post('/api/users/user-1/decision/execute')
      .send({
        decision: fakeDecision,
        userWalletAddress: '0x1111111111111111111111111111111111111111',
        baseAssetAddress: '0xbase',
        amountWei: '1000',
        lowerRangePercent: -5,
        upperRangePercent: 10,
      });

    expect(res.status).toBe(201);
    expect(res.body).toEqual(
      expect.objectContaining({
        dispatchedPositionIds: [],
        skipped: true,
      }),
    );
  });
});
