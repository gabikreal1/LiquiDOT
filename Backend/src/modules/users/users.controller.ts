/**
 * Users Controller
 *
 * REST API endpoints for user management.
 * Public: registration, list, wallet lookup.
 * Protected: user-specific data requires JWT + ownership check.
 */

import { Controller, Get, Post, Body, Param, HttpCode, HttpStatus, UseGuards, ForbiddenException } from '@nestjs/common';
import { UsersService, UserBalance } from './users.service';
import { User } from './entities/user.entity';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

class CreateUserDto {
  walletAddress: string;
}

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  /**
   * Register new user (called on frontend wallet connect)
   * POST /users — PUBLIC
   */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(@Body() createUserDto: CreateUserDto): Promise<User> {
    return this.usersService.findOrCreate(createUserDto.walletAddress);
  }

  /**
   * List all users
   * GET /users — PUBLIC
   */
  @Get()
  async findAll(): Promise<User[]> {
    return this.usersService.findAll();
  }

  /**
   * Get user by ID
   * GET /users/:id — AUTH + IDOR
   */
  @UseGuards(JwtAuthGuard)
  @Get(':id')
  async findOne(@Param('id') id: string, @CurrentUser() currentUser: User): Promise<User> {
    if (currentUser.id !== id) throw new ForbiddenException();
    return this.usersService.findOne(id);
  }

  /**
   * Get user by wallet address
   * GET /users/wallet/:address — PUBLIC
   */
  @Get('wallet/:address')
  async findByWallet(@Param('address') address: string): Promise<User | null> {
    return this.usersService.findByWallet(address);
  }

  /**
   * Get user balance
   * GET /users/:id/balance — AUTH + IDOR
   */
  @UseGuards(JwtAuthGuard)
  @Get(':id/balance')
  async getBalance(@Param('id') id: string, @CurrentUser() currentUser: User): Promise<UserBalance> {
    if (currentUser.id !== id) throw new ForbiddenException();
    return this.usersService.getBalance(id);
  }

  /**
   * Sync balance from chain
   * POST /users/:id/balance/sync — AUTH + IDOR
   */
  @UseGuards(JwtAuthGuard)
  @Post(':id/balance/sync')
  async syncBalance(@Param('id') id: string, @CurrentUser() currentUser: User): Promise<UserBalance> {
    if (currentUser.id !== id) throw new ForbiddenException();
    return this.usersService.syncBalanceFromChain(id);
  }

  /**
   * Deactivate user
   * POST /users/:id/deactivate — AUTH + IDOR
   */
  @UseGuards(JwtAuthGuard)
  @Post(':id/deactivate')
  async deactivate(@Param('id') id: string, @CurrentUser() currentUser: User): Promise<User> {
    if (currentUser.id !== id) throw new ForbiddenException();
    return this.usersService.deactivate(id);
  }

  /**
   * Reactivate user
   * POST /users/:id/reactivate — AUTH + IDOR
   */
  @UseGuards(JwtAuthGuard)
  @Post(':id/reactivate')
  async reactivate(@Param('id') id: string, @CurrentUser() currentUser: User): Promise<User> {
    if (currentUser.id !== id) throw new ForbiddenException();
    return this.usersService.reactivate(id);
  }
}
