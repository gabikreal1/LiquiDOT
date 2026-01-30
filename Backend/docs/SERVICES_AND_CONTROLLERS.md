# Services and API Controllers

## Overview

This document covers the supporting services (PositionsService, UsersService, PreferencesService) and REST API controllers needed to complete the backend. These provide CRUD operations and expose endpoints for the frontend.

## Services Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        API Layer (Controllers)                   │
├─────────────────────────────────────────────────────────────────┤
│  UsersController  │ PositionsController │ PreferencesController │
│  PoolsController  │    HealthController │                       │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                      Service Layer                               │
├─────────────────────────────────────────────────────────────────┤
│   UsersService   │  PositionsService  │  PreferencesService     │
│   PoolsService   │  (existing)        │                         │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                      Data Layer (TypeORM)                        │
├─────────────────────────────────────────────────────────────────┤
│     User Entity  │  Position Entity   │  UserPreference Entity  │
│     Pool Entity  │    Dex Entity      │                         │
└─────────────────────────────────────────────────────────────────┘
```

---

## 1. PositionsService

### Responsibilities
- CRUD operations for Position entity
- Sync position status with on-chain state
- Query positions by user, status, pool
- Calculate position P&L

### Proposed Methods

```typescript
@Injectable()
export class PositionsService {
  // CRUD
  async create(data: CreatePositionDto): Promise<Position>
  async findAll(filter: PositionFilterDto): Promise<Position[]>
  async findOne(id: string): Promise<Position>
  async findByUser(userId: string): Promise<Position[]>
  async findByStatus(status: PositionStatus): Promise<Position[]>
  async update(id: string, data: UpdatePositionDto): Promise<Position>
  
  // Business Logic
  async syncWithOnChain(positionId: string): Promise<Position>
  async markAsExecuted(id: string, moonbeamPositionId: string, liquidity: string): Promise<Position>
  async markAsLiquidated(id: string, returnedAmount: string): Promise<Position>
  async calculatePnL(position: Position): Promise<PositionPnL>
  
  // Queries
  async getActivePositions(): Promise<Position[]>
  async getUserActivePositions(userId: string): Promise<Position[]>
  async getPositionsByPool(poolId: string): Promise<Position[]>
}
```

### API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/positions` | List all positions (with filters) |
| GET | `/positions/:id` | Get single position |
| GET | `/positions/user/:userId` | Get user's positions |
| GET | `/positions/active` | Get all active positions |
| POST | `/positions/:id/sync` | Sync position with on-chain state |

---

## 2. UsersService

### Responsibilities
- User registration/lookup by wallet address
- Track user balances (cached from on-chain)
- Manage user active status

### Proposed Methods

```typescript
@Injectable()
export class UsersService {
  // CRUD
  async create(walletAddress: string): Promise<User>
  async findAll(): Promise<User[]>
  async findOne(id: string): Promise<User>
  async findByWallet(walletAddress: string): Promise<User>
  async findOrCreate(walletAddress: string): Promise<User>
  
  // Balance Management
  async getBalance(userId: string): Promise<UserBalance>
  async syncBalanceFromChain(userId: string): Promise<UserBalance>
  async refreshAllBalances(): Promise<void>
  
  // Status
  async deactivate(userId: string): Promise<User>
  async reactivate(userId: string): Promise<User>
}
```

### API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/users` | List all users |
| GET | `/users/:id` | Get user by ID |
| GET | `/users/wallet/:address` | Get user by wallet |
| POST | `/users` | Register new user |
| GET | `/users/:id/balance` | Get user balance |
| POST | `/users/:id/balance/sync` | Sync balance from chain |

---

## 3. PreferencesService

### Responsibilities
- CRUD for user preferences
- Validate preference values
- Get effective preferences (with defaults)

### Proposed Methods

```typescript
@Injectable()
export class PreferencesService {
  // CRUD
  async create(userId: string, data: CreatePreferenceDto): Promise<UserPreference>
  async findByUser(userId: string): Promise<UserPreference>
  async update(userId: string, data: UpdatePreferenceDto): Promise<UserPreference>
  async delete(userId: string): Promise<void>
  
  // Business Logic
  async getEffectivePreferences(userId: string): Promise<EffectivePreferences>
  async validatePreferences(data: CreatePreferenceDto): ValidationResult
  async setAutoInvest(userId: string, enabled: boolean): Promise<UserPreference>
}
```

### API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/preferences/:userId` | Get user preferences |
| POST | `/preferences/:userId` | Create preferences |
| PATCH | `/preferences/:userId` | Update preferences |
| DELETE | `/preferences/:userId` | Delete preferences |
| POST | `/preferences/:userId/auto-invest` | Toggle auto-invest |

---

## 4. PoolsController (Extend Existing)

### Additional Endpoints Needed

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/pools` | List pools with filters |
| GET | `/pools/:id` | Get pool details |
| GET | `/pools/top` | Get top pools by APR |
| GET | `/pools/search` | Search pools by token |
| POST | `/pools/sync` | Trigger manual pool sync |

---

## 5. HealthController

### Responsibilities
- Basic health check for load balancers
- Detailed status for monitoring
- Database connectivity check
- Blockchain connectivity check

### Proposed Methods

```typescript
@Controller('health')
export class HealthController {
  @Get()
  async check(): Promise<HealthStatus>
  
  @Get('/detailed')
  async detailed(): Promise<DetailedHealthStatus>
}
```

### API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/health` | Basic health check |
| GET | `/health/detailed` | Detailed system status |

---

## Implementation Decisions (Confirmed)

### ✅ Decision 1: User Registration Flow
**Answer:** Frontend calls on wallet connect

- When user connects wallet in frontend, frontend calls `POST /users` with wallet address
- Backend creates User record if not exists (findOrCreate pattern)
- All subsequent operations reference this user

---

### ✅ Decision 2: Balance Caching Strategy
**Answer:** Event-driven

- Update balance cache when deposit/withdrawal events occur from EventListenerService
- No TTL-based polling needed
- Direct on-chain queries only for verification before investments

---

### ✅ Decision 3: API Authentication  
**Answer:** No auth for MVP

- Public endpoints
- Wallet address used as identifier
- No signature verification for MVP

---

### ✅ Decision 4: Pagination Strategy
**Answer:** Offset/Limit (standard)

- Use traditional pagination: `?page=1&limit=20`
- Simple and sufficient for MVP
- Can add cursor-based later if needed for performance

---

### ❓ Question 5: Error Response Format
What format should API errors use?

**Options:**
- A) **Simple**: `{ error: "message" }`
- B) **Structured**: `{ code: "ERR_001", message: "...", details: {...} }`
- C) **RFC 7807**: Problem Details for HTTP APIs standard

---

## DTOs (Data Transfer Objects)

```typescript
// positions.dto.ts
class CreatePositionDto {
  userId: string;
  poolId: string;
  baseAsset: string;
  amount: string;
  lowerRangePercent: number;
  upperRangePercent: number;
  chainId: number;
}

class PositionFilterDto {
  userId?: string;
  status?: PositionStatus;
  poolId?: string;
  limit?: number;
  offset?: number;
}

// preferences.dto.ts
class CreatePreferenceDto {
  minApr: number;
  minTvl: string;
  defaultLowerRangePercent?: number;
  defaultUpperRangePercent?: number;
  preferredDexes?: string[];
  preferredTokens?: string[];
  autoInvestEnabled?: boolean;
}

class UpdatePreferenceDto extends PartialType(CreatePreferenceDto) {}
```

---

## Module Structure

```
src/modules/
├── users/
│   ├── users.module.ts
│   ├── users.service.ts
│   ├── users.controller.ts
│   ├── dto/
│   │   ├── create-user.dto.ts
│   │   └── user-response.dto.ts
│   └── entities/
│       └── user.entity.ts (existing)
│
├── positions/
│   ├── positions.module.ts
│   ├── positions.service.ts
│   ├── positions.controller.ts
│   ├── dto/
│   │   ├── create-position.dto.ts
│   │   ├── update-position.dto.ts
│   │   └── position-filter.dto.ts
│   └── entities/
│       └── position.entity.ts (existing)
│
├── preferences/
│   ├── preferences.module.ts
│   ├── preferences.service.ts
│   ├── preferences.controller.ts
│   ├── dto/
│   │   ├── create-preference.dto.ts
│   │   └── update-preference.dto.ts
│   └── entities/
│       └── user-preference.entity.ts (existing)
│
├── pools/
│   ├── pools.module.ts (existing)
│   ├── pools.service.ts (existing)
│   ├── pools.controller.ts (NEW)
│   └── ...
│
└── health/
    ├── health.module.ts
    └── health.controller.ts
```

---

## Next Steps

1. Answer clarifying questions above
2. Implement PositionsService + Controller
3. Implement UsersService + Controller
4. Implement PreferencesService + Controller
5. Extend PoolsController
6. Add HealthController
7. Add validation pipes and error handling
8. API documentation (Swagger)
