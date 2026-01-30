/**
 * Users Controller
 * 
 * REST API endpoints for user management.
 * Decision: No auth for MVP - wallet address is identifier.
 */

import { Controller, Get, Post, Body, Param, HttpCode, HttpStatus } from '@nestjs/common';
import { UsersService, UserBalance } from './users.service';
import { User } from './entities/user.entity';

class CreateUserDto {
  walletAddress: string;
}

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  /**
   * Register new user (called on frontend wallet connect)
   * POST /users
   */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(@Body() createUserDto: CreateUserDto): Promise<User> {
    return this.usersService.findOrCreate(createUserDto.walletAddress);
  }

  /**
   * List all users
   * GET /users
   */
  @Get()
  async findAll(): Promise<User[]> {
    return this.usersService.findAll();
  }

  /**
   * Get user by ID
   * GET /users/:id
   */
  @Get(':id')
  async findOne(@Param('id') id: string): Promise<User> {
    return this.usersService.findOne(id);
  }

  /**
   * Get user by wallet address
   * GET /users/wallet/:address
   */
  @Get('wallet/:address')
  async findByWallet(@Param('address') address: string): Promise<User | null> {
    return this.usersService.findByWallet(address);
  }

  /**
   * Get user balance
   * GET /users/:id/balance
   */
  @Get(':id/balance')
  async getBalance(@Param('id') id: string): Promise<UserBalance> {
    return this.usersService.getBalance(id);
  }

  /**
   * Sync balance from chain
   * POST /users/:id/balance/sync
   */
  @Post(':id/balance/sync')
  async syncBalance(@Param('id') id: string): Promise<UserBalance> {
    return this.usersService.syncBalanceFromChain(id);
  }

  /**
   * Deactivate user
   * POST /users/:id/deactivate
   */
  @Post(':id/deactivate')
  async deactivate(@Param('id') id: string): Promise<User> {
    return this.usersService.deactivate(id);
  }

  /**
   * Reactivate user
   * POST /users/:id/reactivate
   */
  @Post(':id/reactivate')
  async reactivate(@Param('id') id: string): Promise<User> {
    return this.usersService.reactivate(id);
  }
}
