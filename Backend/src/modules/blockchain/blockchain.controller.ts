import { Controller, Get, Query } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MoonbeamService } from './services/moonbeam.service';

@Controller('api/blockchain')
export class BlockchainController {
  constructor(
    private readonly moonbeamService: MoonbeamService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Returns the set of supported tokens (allowlist) and their names/symbols.
   *
   * NOTE: the allowlist is a mapping and is not enumerable, so we filter a candidate
   * list provided either via query string (?candidates=0x..,0x..) or env (TOKEN_CANDIDATES).
   */
  @Get('supported-tokens')
  async getSupportedTokens(
    @Query('candidates') candidatesCsv?: string,
    @Query('cacheTtlMs') cacheTtlMs?: string,
  ) {
    const envCandidates = this.configService.get<string>('TOKEN_CANDIDATES', '') ?? '';
    const csv = (candidatesCsv ?? envCandidates).trim();
    const candidates = csv ? csv.split(',').map(s => s.trim()) : [];

    const ttl = cacheTtlMs ? Number(cacheTtlMs) : undefined;

    return {
      candidatesProvided: candidates.length,
      tokens: await this.moonbeamService.getSupportedTokensWithNames({
        candidateTokenAddresses: candidates,
        cacheTtlMs: ttl,
      }),
    };
  }
}
