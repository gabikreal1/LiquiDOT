/**
 * Preferences Controller
 *
 * REST API endpoints for user preferences management.
 * Public: getDefaults.
 * Protected: all user-specific endpoints require JWT + IDOR.
 */

import { Controller, Get, Post, Patch, Delete, Body, Param, HttpCode, HttpStatus, UseGuards, ForbiddenException } from '@nestjs/common';
import { PreferencesService, CreatePreferenceDto, UpdatePreferenceDto, EffectivePreferences } from './preferences.service';
import { UserPreference } from './entities/user-preference.entity';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { User } from '../users/entities/user.entity';

class SetAutoInvestDto {
  enabled: boolean;
}

@Controller('preferences')
export class PreferencesController {
  constructor(private readonly preferencesService: PreferencesService) {}

  /**
   * Get default preferences
   * GET /preferences/defaults — PUBLIC
   */
  @Get('defaults')
  getDefaults(): EffectivePreferences {
    return this.preferencesService.getDefaults();
  }

  /**
   * Get user preferences
   * GET /preferences/:userId — AUTH + IDOR
   */
  @UseGuards(JwtAuthGuard)
  @Get(':userId')
  async findByUser(@Param('userId') userId: string, @CurrentUser() currentUser: User): Promise<UserPreference | null> {
    if (currentUser.id !== userId) throw new ForbiddenException();
    return this.preferencesService.findByUser(userId);
  }

  /**
   * Get effective preferences (with defaults applied)
   * GET /preferences/:userId/effective — AUTH + IDOR
   */
  @UseGuards(JwtAuthGuard)
  @Get(':userId/effective')
  async getEffective(@Param('userId') userId: string, @CurrentUser() currentUser: User): Promise<EffectivePreferences> {
    if (currentUser.id !== userId) throw new ForbiddenException();
    return this.preferencesService.getEffectivePreferences(userId);
  }

  /**
   * Create user preferences
   * POST /preferences/:userId — AUTH + IDOR
   */
  @UseGuards(JwtAuthGuard)
  @Post(':userId')
  @HttpCode(HttpStatus.CREATED)
  async create(
    @Param('userId') userId: string,
    @CurrentUser() currentUser: User,
    @Body() createDto: CreatePreferenceDto,
  ): Promise<UserPreference> {
    if (currentUser.id !== userId) throw new ForbiddenException();
    return this.preferencesService.create(userId, createDto);
  }

  /**
   * Update user preferences
   * PATCH /preferences/:userId — AUTH + IDOR
   */
  @UseGuards(JwtAuthGuard)
  @Patch(':userId')
  async update(
    @Param('userId') userId: string,
    @CurrentUser() currentUser: User,
    @Body() updateDto: UpdatePreferenceDto,
  ): Promise<UserPreference> {
    if (currentUser.id !== userId) throw new ForbiddenException();
    return this.preferencesService.update(userId, updateDto);
  }

  /**
   * Delete user preferences
   * DELETE /preferences/:userId — AUTH + IDOR
   */
  @UseGuards(JwtAuthGuard)
  @Delete(':userId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async delete(@Param('userId') userId: string, @CurrentUser() currentUser: User): Promise<void> {
    if (currentUser.id !== userId) throw new ForbiddenException();
    return this.preferencesService.delete(userId);
  }

  /**
   * Toggle auto-invest
   * POST /preferences/:userId/auto-invest — AUTH + IDOR
   */
  @UseGuards(JwtAuthGuard)
  @Post(':userId/auto-invest')
  async setAutoInvest(
    @Param('userId') userId: string,
    @CurrentUser() currentUser: User,
    @Body() body: SetAutoInvestDto,
  ): Promise<UserPreference> {
    if (currentUser.id !== userId) throw new ForbiddenException();
    return this.preferencesService.setAutoInvest(userId, body.enabled);
  }
}
