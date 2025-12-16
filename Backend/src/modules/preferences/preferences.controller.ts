import { Body, Controller, Get, Param, Put } from '@nestjs/common';
import { PreferencesService } from './preferences.service';
import { UpsertPreferencesDto } from './dto/upsert-preferences.dto';

@Controller('users/:userId/preferences')
export class PreferencesController {
  constructor(private readonly preferencesService: PreferencesService) {}

  @Get()
  async get(@Param('userId') userId: string) {
    return this.preferencesService.getByUserId(userId);
  }

  @Put()
  async upsert(@Param('userId') userId: string, @Body() body: UpsertPreferencesDto) {
    return this.preferencesService.upsertForUser(userId, body);
  }
}
