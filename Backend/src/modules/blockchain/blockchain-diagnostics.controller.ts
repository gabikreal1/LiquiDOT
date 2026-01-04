import { Controller, Get } from '@nestjs/common';

import { BlockchainDiagnosticsService } from './blockchain-diagnostics.service';

@Controller('blockchain/diagnostics')
export class BlockchainDiagnosticsController {
  constructor(private readonly diagnosticsService: BlockchainDiagnosticsService) {}

  @Get()
  async diagnostics() {
    return this.diagnosticsService.diagnostics();
  }
}
