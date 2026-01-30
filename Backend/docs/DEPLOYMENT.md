# Deployment & Operations Guide

This guide covers deploying and operating the LiquiDOT backend in production.

## Prerequisites

- Node.js 18+ (LTS recommended)
- PostgreSQL 14+
- Docker (optional, recommended)
- Access to Moonbeam and Asset Hub RPC endpoints

---

## Deployment Options

### Option 1: Docker (Recommended)

```bash
# Build the image
docker build -t liquidot-backend .

# Run with environment file
docker run -d \
  --name liquidot-backend \
  --env-file .env.production \
  -p 3001:3001 \
  liquidot-backend
```

### Option 2: Docker Compose

```bash
# Start all services (backend + postgres)
docker-compose up -d

# View logs
docker-compose logs -f backend

# Stop services
docker-compose down
```

### Option 3: Direct Node.js

```bash
# Install production dependencies
npm ci --production

# Build TypeScript
npm run build

# Run migrations
npm run migration:run

# Start production server
npm run start:prod
```

---

## Environment Configuration

Create `.env.production` with these variables:

```env
# Application
NODE_ENV=production
PORT=3001

# Database
DATABASE_URL=postgresql://user:pass@host:5432/liquidot?ssl=true

# Blockchain
MOONBEAM_RPC_URL=https://rpc.api.moonbeam.network
ASSET_HUB_RPC_URL=wss://polkadot-asset-hub-rpc.polkadot.io
PRIVATE_KEY=0x...

# Contract Addresses
XCM_PROXY_ADDRESS=0x...
ASSET_HUB_VAULT_ADDRESS=0x...

# Workers
INVESTMENT_CHECK_INTERVAL_MS=14400000  # 4 hours
STOP_LOSS_CHECK_INTERVAL_MS=30000      # 30 seconds

# Limits
MAX_GAS_PRICE_GWEI=100
LIQUIDATION_SLIPPAGE_BPS=50
```

### Required Secrets

| Secret | Description |
|--------|-------------|
| `DATABASE_URL` | PostgreSQL connection string |
| `PRIVATE_KEY` | Backend wallet private key |

**Security:**
- Use a secrets manager (AWS Secrets Manager, HashiCorp Vault)
- Never commit secrets to version control
- Rotate keys periodically

---

## Database Setup

### Initial Setup

```bash
# Create database
createdb liquidot

# Run migrations
npm run migration:run
```

### Migration Commands

```bash
# Generate new migration from entity changes
npm run migration:generate -- -n AddNewColumn

# Run pending migrations
npm run migration:run

# Revert last migration
npm run migration:revert

# Show migration status
npm run migration:show
```

### Backup & Restore

```bash
# Backup
pg_dump $DATABASE_URL > backup_$(date +%Y%m%d).sql

# Restore
psql $DATABASE_URL < backup_20260130.sql
```

---

## Monitoring

### Health Checks

Configure your load balancer to check:

```
GET /health
Expected: 200 OK
Interval: 30 seconds
Timeout: 5 seconds
```

For detailed status:
```
GET /health/detailed
```

### Logs

Logs are output to stdout in JSON format. Configure your log aggregator accordingly.

Log levels:
- `error` - Failures requiring attention
- `warn` - Potential issues
- `log` - Normal operations
- `debug` - Detailed diagnostics

### Metrics to Monitor

| Metric | Alert Threshold |
|--------|-----------------|
| API response time | > 1000ms |
| Database connections | > 80% pool |
| Memory usage | > 80% |
| Error rate | > 1% |
| Position liquidation failures | > 0 |

### Recommended Tools

- **Logging**: CloudWatch, Datadog, or ELK stack
- **APM**: New Relic, Datadog APM
- **Uptime**: Better Uptime, Pingdom

---

## Scaling

### Horizontal Scaling

The backend is stateless and can be scaled horizontally:

```yaml
# docker-compose.yml
services:
  backend:
    image: liquidot-backend
    deploy:
      replicas: 3
```

**Note:** Workers (investment decision, stop-loss) should run on a single instance or use distributed locking.

### Database Scaling

For high load:
1. Enable connection pooling (PgBouncer)
2. Add read replicas for read-heavy operations
3. Partition historical data (positions, logs)

---

## Operations Runbook

### Starting the Service

```bash
# Docker
docker-compose up -d

# Direct
npm run start:prod
```

### Stopping the Service

```bash
# Docker (graceful)
docker-compose stop

# Direct
kill -SIGTERM <pid>
```

### Checking Status

```bash
# API health
curl http://localhost:3001/health

# Detailed health
curl http://localhost:3001/health/detailed

# Docker status
docker-compose ps
```

### Viewing Logs

```bash
# Docker
docker-compose logs -f backend

# Direct (if using PM2)
pm2 logs liquidot
```

---

## Troubleshooting

### Common Issues

#### "Database connection failed"

1. Check `DATABASE_URL` is correct
2. Verify database is running: `pg_isready -h host -p 5432`
3. Check firewall/security groups
4. Verify SSL settings match database config

#### "RPC request failed"

1. Check RPC URL is accessible
2. Verify rate limits aren't exceeded
3. Try a backup RPC endpoint
4. Check blockchain node is synced

#### "Transaction underpriced"

1. Increase gas price in config
2. Check network congestion
3. Wait and retry with higher gas

#### Worker not running

1. Check `@nestjs/schedule` is properly imported
2. Verify cron expressions are valid
3. Check worker configuration in module

### Emergency Procedures

#### Pause All Operations

Set environment variable and restart:
```env
PAUSE_ALL_OPERATIONS=true
```

This disables workers while keeping API available.

#### Manual Position Liquidation

If automatic liquidation fails:

```bash
# Use the CLI tool (if available)
npm run cli -- liquidate-position <positionId>

# Or via API (if implemented)
curl -X POST http://localhost:3001/positions/<id>/force-liquidate
```

#### Database Recovery

If database is corrupted:

```bash
# Restore from latest backup
psql $DATABASE_URL < backup_latest.sql

# Re-sync positions from chain
npm run cli -- sync-positions
```

---

## Security Checklist

### Before Production

- [ ] Private keys in secrets manager
- [ ] Database SSL enabled
- [ ] API behind HTTPS/TLS
- [ ] Rate limiting configured
- [ ] Firewall rules set
- [ ] Audit logs enabled

### Ongoing

- [ ] Rotate secrets quarterly
- [ ] Review access logs
- [ ] Update dependencies monthly
- [ ] Penetration testing annually

---

## Cost Estimation

### Infrastructure (AWS Example)

| Service | Spec | Monthly Cost |
|---------|------|--------------|
| EC2 | t3.medium (2 vCPU, 4GB) | ~$30 |
| RDS PostgreSQL | db.t3.small | ~$25 |
| Load Balancer | ALB | ~$20 |
| CloudWatch | Basic | ~$10 |
| **Total** | | **~$85/month** |

### Blockchain Costs

| Operation | Gas | Frequency | Monthly Cost |
|-----------|-----|-----------|--------------|
| Add liquidity | ~0.01 GLMR | 6/user/month | ~$0.06/user |
| Remove liquidity | ~0.01 GLMR | 6/user/month | ~$0.06/user |
| XCM transfer | ~0.001 DOT | 12/user/month | ~$0.05/user |

---

## Support

- **Issues**: GitHub Issues
- **Docs**: This repository
- **Emergency**: [Contact info]
