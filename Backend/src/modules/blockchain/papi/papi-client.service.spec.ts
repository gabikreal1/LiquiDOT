import { Test } from '@nestjs/testing';
import { ConfigModule } from '@nestjs/config';

import { PapiClientService } from './papi-client.service';

describe('PapiClientService', () => {
  it('should be defined', async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [ConfigModule.forRoot({ isGlobal: true })],
      providers: [PapiClientService],
    }).compile();

    const service = moduleRef.get(PapiClientService);
    expect(service).toBeDefined();
  });

  it('health should be false when endpoint missing', async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [ConfigModule.forRoot({ isGlobal: true })],
      providers: [PapiClientService],
    }).compile();

    const service = moduleRef.get(PapiClientService);
    const health = await service.health();

    expect(health.connected).toBe(false);
    expect(health.error).toContain('ASSET_HUB_PAPI_ENDPOINT');
  });

  it('can attempt live connect when endpoint provided (optional)', async () => {
    const endpoint = process.env.ASSET_HUB_PAPI_ENDPOINT;
    if (!endpoint) {
      // Skip in CI/local unless explicitly configured.
      return;
    }

    const moduleRef = await Test.createTestingModule({
      imports: [ConfigModule.forRoot({ isGlobal: true })],
      providers: [PapiClientService],
    }).compile();

    const service = moduleRef.get(PapiClientService);
    const health = await service.health();

    expect(health.endpoint).toBe(endpoint);
    // We only assert that we *tried*; network flakiness shouldn't fail the suite.
    // If you want strictness later, change this to expect(true).
    expect(typeof health.connected).toBe('boolean');
  });
});
