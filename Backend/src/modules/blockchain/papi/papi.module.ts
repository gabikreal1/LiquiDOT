import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { PapiClientService } from './papi-client.service';

@Module({
  imports: [ConfigModule],
  providers: [PapiClientService],
  exports: [PapiClientService],
})
export class PapiModule {}
