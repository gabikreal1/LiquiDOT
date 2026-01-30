import { ConfigService } from '@nestjs/config';
import { ethers } from 'ethers';

import { MoonbeamService } from './moonbeam.service';

describe('MoonbeamService.getSupportedTokensWithNames', () => {
  // Use 40-hex addresses; we'll checksum them via ethers.getAddress.
  const tokenA = ethers.getAddress('0x00000000000000000000000000000000000000aa');
  const tokenB = ethers.getAddress('0x00000000000000000000000000000000000000bb');

  function makeServiceWithMocks() {
    const configService = {
      get: jest.fn(() => undefined),
    } as unknown as ConfigService;

    const svc = new MoonbeamService(configService);

    // Bypass init; we only need provider + readOnlyContract for the method.
    (svc as any).provider = {};
    (svc as any).readOnlyContract = {
      supportedTokens: jest.fn(async (addr: string) => ethers.getAddress(addr) === tokenA),
    };

    return svc;
  }

  beforeEach(() => {
    jest.restoreAllMocks();
  });

  it('filters candidates by supportedTokens and resolves ERC20 metadata', async () => {
    const svc = makeServiceWithMocks();

    const contractSpy = jest.spyOn(ethers, 'Contract' as any).mockImplementation((address: string) => {
      return {
        name: async () => (ethers.getAddress(address) === ethers.getAddress(tokenA) ? 'Token A' : 'Token B'),
        symbol: async () => (ethers.getAddress(address) === ethers.getAddress(tokenA) ? 'TKA' : 'TKB'),
        decimals: async () => 18,
      } as any;
    });

    const res = await svc.getSupportedTokensWithNames({
      candidateTokenAddresses: [tokenA, tokenB],
      cacheTtlMs: 0,
    });

    expect(res).toEqual([
      {
        address: tokenA,
        name: 'Token A',
        symbol: 'TKA',
        decimals: 18,
      },
    ]);

    expect((svc as any).readOnlyContract.supportedTokens).toHaveBeenCalledTimes(2);
    expect(contractSpy).toHaveBeenCalledTimes(1);
  });

  it('deduplicates candidates and caches result', async () => {
    const svc = makeServiceWithMocks();

    const contractSpy = jest.spyOn(ethers, 'Contract' as any).mockImplementation(() => {
      return {
        name: async () => 'Token A',
        symbol: async () => 'TKA',
        decimals: async () => 18,
      } as any;
    });

    const first = await svc.getSupportedTokensWithNames({
      candidateTokenAddresses: [tokenA, tokenA.toLowerCase()],
      cacheTtlMs: 60_000,
    });
    const second = await svc.getSupportedTokensWithNames({
      candidateTokenAddresses: [tokenA],
      cacheTtlMs: 60_000,
    });

    expect(first).toHaveLength(1);
    expect(second).toHaveLength(1);
    // Only one ERC20 contract resolution thanks to caching.
    expect(contractSpy).toHaveBeenCalledTimes(1);
  });
});
