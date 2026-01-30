/**
 * Preferences Controller
 * 
 * REST API endpoints for user preferences management.
 */

import { Controller, Get, Post, Patch, Delete, Body, Param, HttpCode, HttpStatus } from '@nestjs/common';
import { PreferencesService, CreatePreferenceDto, UpdatePreferenceDto, EffectivePreferences } from './preferences.service';
import { UserPreference } from './entities/user-preference.entity';

class SetAutoInvestDto {
  enabled: boolean;
}

@Controller('preferences')
export class PreferencesController {
  constructor(private readonly preferencesService: PreferencesService) {}

  /**
   * Get default preferences
   * GET /preferences/defaults
   */
  @Get('defaults')
  getDefaults(): EffectivePreferences {
    return this.preferencesService.getDefaults();
  }

  /**
   * Get user preferences
   * GET /preferences/:userId
   */
  @Get(':userId')
  async findByUser(@Param('userId') userId: string): Promise<UserPreference | null> {
    return this.preferencesService.findByUser(userId);
  }

  /**
   * Get effective preferences (with defaults applied)
   * GET /preferences/:userId/effective
   */
  @Get(':userId/effective')
  async getEffective(@Param('userId') userId: string): Promise<EffectivePreferences> {
    return this.preferencesService.getEffectivePreferences(userId);
  }

  /**
   * Create user preferences
   * POST /preferences/:userId
   */
  @Post(':userId')
  @HttpCode(HttpStatus.CREATED)
  async create(
    @Param('userId') userId: string,
    @Body() createDto: CreatePreferenceDto,
  ): Promise<UserPreference> {
    return this.preferencesService.create(userId, createDto);
  }

  /**
   * Update user preferences
   * PATCH /preferences/:userId
   */
  @Patch(':userId')
  async update(
    @Param('userId') userId: string,
    @Body() updateDto: UpdatePreferenceDto,
  ): Promise<UserPreference> {
    return this.preferencesService.update(userId, updateDto);
  }

  /**
   * Delete user preferences
   * DELETE /preferences/:userId
   */
  @Delete(':userId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async delete(@Param('userId') userId: string): Promise<void> {
    return this.preferencesService.delete(userId);
  }

  /**
   * Toggle auto-invest
   * POST /preferences/:userId/auto-invest
   */
  @Post(':userId/auto-invest')
  async setAutoInvest(
    @Param('userId') userId: string,
    @Body() body: SetAutoInvestDto,
  ): Promise<UserPreference> {
    return this.preferencesService.setAutoInvest(userId, body.enabled);
  }
}
