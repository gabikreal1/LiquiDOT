# LiquiDOT Data Aggregator Service (optional)

Standalone microservice that fetches liquidity pool data from the Dune Analytics API and stores it as time-series files.

This service is **optional**. The main backend can ingest pool data from a GraphQL subgraph (see `Backend/README.md`).

## Features

- **Automated Data Fetching**: Scheduled data sync from Dune Analytics API
- **Time Series Storage**: Stores data with timestamps for historical analysis  
- **Data Retention**: Automatic cleanup of old data based on retention policy
- **Normalized Data Format**: Consistent data structure for easy consumption
- **Manual Sync**: On-demand data synchronization
- **Comprehensive Logging**: Configurable logging levels
- **Graceful Shutdown**: Proper cleanup and shutdown handling

## Architecture

This service is designed as a standalone microservice separate from the main LiquiDOT backend, following microservices best practices:

- **Separation of Concerns**: Data aggregation logic isolated from main API
- **Independent Scaling**: Can be scaled independently based on data needs
- **Fault Isolation**: Failures don't affect the main backend service
- **Technology Flexibility**: Can use different tech stack if needed

## Installation

1. **Navigate to the service directory:**
   ```bash
   cd DataAggregatorService
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Configure environment variables:**
   ```bash
   cp env.example .env
   # Edit .env with your configuration
   ```

4. **Set up your Dune Analytics API key:**
   ```bash
   # In .env file
   DUNE_API_KEY=your_actual_api_key_here
   ```

## Configuration

### Environment Variables

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `DUNE_API_KEY` | Your Dune Analytics API key | - | ✅ |
| `DUNE_QUERY_ID` | Dune query ID to fetch | `5618379` | ❌ |
| `DUNE_API_BASE_URL` | Dune API base URL | `https://api.dune.com/api/v1` | ❌ |
| `DATA_STORAGE_DIR` | Directory for storing data | `./storage` | ❌ |
| `DUNE_SYNC_INTERVAL_HOURS` | Sync interval in hours | `1` | ❌ |
| `DATA_RETENTION_DAYS` | Data retention period | `30` | ❌ |
| `LOG_LEVEL` | Logging level | `info` | ❌ |
| `NODE_ENV` | Environment | `development` | ❌ |

### Logging Levels

- `error`: Only error messages
- `warn`: Warnings and errors
- `info`: General information (default)
- `debug`: Detailed debugging information

## Usage

### Running the Service

#### Production Mode
```bash
npm start
```

#### Development Mode (with auto-restart)
```bash
npm run dev
```

#### Manual Sync (one-time)
```bash
npm run sync
```

### Service Output

When running, the service will display:
- Configuration summary
- Initial sync progress
- Scheduler status
- Periodic sync results
- Error handling

Example output:
```
🚀 Starting LiquiDOT Data Aggregator Service...
=====================================
⚙️  Service Configuration:
   • API Key: kjId5G1F04...
   • Query ID: 5618379
   • Base URL: https://api.dune.com/api/v1
   • Data Directory: ./storage
   • Sync Interval: Every 1 hour(s)
   • Data Retention: 30 days
=====================================

🔄 Running initial data sync...
🔍 Fetching data from Dune Analytics...
✅ Successfully fetched data from Dune Analytics
📊 Execution ID: 01K2DG1NQRW23ZM9725EVC2KJK
🔄 Query State: QUERY_STATE_COMPLETED
📈 Rows fetched: 3
💾 Stored time series data: dune_data_2025-01-12.json
📊 Pools processed: 3
✅ Data aggregation sync completed successfully
✅ Initial sync completed successfully

⏰ Starting automated scheduler...
📅 Schedule: Every 1 hour(s) (0 */1 * * *)
✅ Data aggregator scheduler started
✅ Data aggregator service is now running
📊 Data will be synced automatically every hour
🛑 Press Ctrl+C to stop the service
```

## Data Storage

### Storage Structure

```
storage/
├── dune_data_2025-01-12.json    # Daily time series data
├── dune_data_2025-01-11.json    # Previous day's data
├── latest.json                  # Latest complete sync result
└── latest_pools.json           # Latest normalized pools data
```

### Data Format

#### Time Series Entry (latest.json)
```json
{
  "timestamp": "2025-01-12T10:00:00.000Z",
  "execution_id": "01K2DG1NQRW23ZM9725EVC2KJK",
  "query_id": 5618379,
  "is_execution_finished": true,
  "state": "QUERY_STATE_COMPLETED",
  "submitted_at": "2025-01-12T09:59:40.282089Z",
  "expires_at": "2025-04-12T10:00:09.914924Z",
  "execution_started_at": "2025-01-12T09:59:40.544636Z",
  "execution_ended_at": "2025-01-12T10:00:09.914923Z",
  "data_count": 3,
  "pools": [/* raw pool data */]
}
```

#### Normalized Pools Data (latest_pools.json)
```json
[
  {
    "id": "0xb13b281503f6ec8a837ae1a21e86a9cae368fcc5",
    "timestamp": "2025-01-12T10:00:00.000Z",
    "token0": {
      "decimals": 18,
      "id": "0xacc15dc74880c9944775448304b263d191c6077f",
      "name": "Wrapped GLMR",
      "symbol": "WGLMR"
    },
    "token1": {
      "decimals": 10,
      "id": "0xffffffff1fcacbd218edc0eba20fc2308c778080",
      "name": "xcDOT",
      "symbol": "xcDOT"
    },
    "metrics": {
      "totalValueLockedUSD": 961688.7204165558,
      "volume24hUSD": 251333.8301693344
    }
  }
]
```

## Scheduling

The service uses cron scheduling for automated data fetching:

- **Default**: Every hour (`0 */1 * * *`)
- **Configurable**: Set `DUNE_SYNC_INTERVAL_HOURS` environment variable
- **Examples**:
  - Every 30 minutes: Set to `0.5`
  - Every 2 hours: Set to `2`
  - Every 6 hours: Set to `6`

## Data Retention

- Automatically cleans up old daily files based on `DATA_RETENTION_DAYS`
- Default retention: 30 days
- Cleanup runs after each successful sync
- `latest.json` and `latest_pools.json` are never deleted

## Integration with the main backend

The LiquiDOT backend can consume the aggregated data by:

1. **Reading latest data files** directly from the storage directory
2. **Setting up file watchers** to detect new data
3. **Polling the storage directory** periodically
4. **Using a shared database** (future enhancement)

Example integration:
```javascript
// In your main backend
import fs from 'fs';
import path from 'path';

function getLatestPoolsData() {
  const dataPath = path.join('../DataAggregatorService/storage/latest_pools.json');
  if (fs.existsSync(dataPath)) {
    return JSON.parse(fs.readFileSync(dataPath, 'utf8'));
  }
  return [];
}
```

## Deployment

### As a System Service (Linux)

1. **Create a systemd service file:**
   ```bash
   sudo nano /etc/systemd/system/liqui-dot-data-aggregator.service
   ```

2. **Service configuration:**
   ```ini
   [Unit]
   Description=LiquiDOT Data Aggregator Service
   After=network.target
   
   [Service]
   Type=simple
   User=your-user
   WorkingDirectory=/path/to/DataAggregatorService
   ExecStart=/usr/bin/node index.js
   Restart=always
   RestartSec=10
   Environment=NODE_ENV=production
   EnvironmentFile=/path/to/DataAggregatorService/.env
   
   [Install]
   WantedBy=multi-user.target
   ```

3. **Enable and start the service:**
   ```bash
   sudo systemctl enable liqui-dot-data-aggregator
   sudo systemctl start liqui-dot-data-aggregator
   sudo systemctl status liqui-dot-data-aggregator
   ```

### Using Docker

1. **Create Dockerfile:**
   ```dockerfile
   FROM node:18-alpine
   WORKDIR /app
   COPY package*.json ./
   RUN npm ci --only=production
   COPY . .
   EXPOSE 3000
   CMD ["npm", "start"]
   ```

2. **Build and run:**
   ```bash
   docker build -t liqui-dot-data-aggregator .
   docker run -d --name data-aggregator \
     --env-file .env \
     -v $(pwd)/storage:/app/storage \
     liqui-dot-data-aggregator
   ```

### Using PM2

```bash
npm install -g pm2
pm2 start index.js --name "data-aggregator"
pm2 startup
pm2 save
```

## Monitoring and Maintenance

### Logs
- All activities are logged with timestamps
- Configure `LOG_LEVEL` for appropriate verbosity
- Consider using log rotation for production

### Health Checks
- Monitor the storage directory for recent files
- Check process status regularly
- Set up alerts for failed syncs

### Backup
- Consider backing up the storage directory
- Historical data can be valuable for analysis
- Implement automated backup strategies

## Troubleshooting

### Common Issues

1. **API Key Issues**
   ```
   Error: DUNE_API_KEY environment variable is required
   ```
   Solution: Ensure your `.env` file has a valid `DUNE_API_KEY`

2. **Network Connectivity**
   ```
   Error fetching Dune data: connect ECONNREFUSED
   ```
   Solution: Check internet connectivity and Dune API status

3. **Permission Issues**
   ```
   Error: EACCES: permission denied, mkdir './storage'
   ```
   Solution: Ensure the process has write permissions to the data directory

4. **Storage Space**
   - Monitor disk space usage
   - Adjust `DATA_RETENTION_DAYS` if needed
   - Consider external storage for large datasets

### Debug Mode

Run with debug logging to troubleshoot issues:
```bash
LOG_LEVEL=debug npm start
```

## Future Enhancements

- **Database Integration**: PostgreSQL/MongoDB for better data management
- **API Endpoints**: REST API for data access
- **Metrics Export**: Prometheus metrics for monitoring
- **Data Validation**: Schema validation for incoming data
- **Rate Limiting**: Handle API rate limits gracefully
- **Multi-Query Support**: Support for multiple Dune queries
- **Real-time Updates**: WebSocket support for real-time data
- **Data Transformation**: Advanced data processing pipelines

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

This project is part of the LiquiDOT ecosystem and follows the same license terms. 