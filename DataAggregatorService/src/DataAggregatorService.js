import axios from 'axios';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import cron from 'node-cron';

// Get __dirname equivalent in ES Modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class DataAggregatorService {
  constructor() {
    this.apiKey = process.env.DUNE_API_KEY;
    this.queryId = process.env.DUNE_QUERY_ID || '5618379';
    this.baseUrl = process.env.DUNE_API_BASE_URL || 'https://api.dune.com/api/v1';
    this.dataDir = process.env.DATA_STORAGE_DIR || path.join(process.cwd(), 'storage');
    this.retentionDays = parseInt(process.env.DATA_RETENTION_DAYS) || 30;
    this.syncIntervalHours = parseInt(process.env.DUNE_SYNC_INTERVAL_HOURS) || 1;
    this.logLevel = process.env.LOG_LEVEL || 'info';
    
    // Validate required configuration
    this.validateConfiguration();
    this.ensureDataDirectory();
  }

  /**
   * Validate required configuration
   */
  validateConfiguration() {
    if (!this.apiKey) {
      throw new Error('DUNE_API_KEY environment variable is required');
    }
    
    this.log('info', '⚙️  Service Configuration:');
    this.log('info', `   • API Key: ${this.apiKey.substring(0, 10)}...`);
    this.log('info', `   • Query ID: ${this.queryId}`);
    this.log('info', `   • Base URL: ${this.baseUrl}`);
    this.log('info', `   • Data Directory: ${this.dataDir}`);
    this.log('info', `   • Sync Interval: Every ${this.syncIntervalHours} hour(s)`);
    this.log('info', `   • Data Retention: ${this.retentionDays} days`);
  }

  /**
   * Logging utility
   */
  log(level, message, data = null) {
    const timestamp = new Date().toISOString();
    const logLevels = { error: 0, warn: 1, info: 2, debug: 3 };
    const currentLevel = logLevels[this.logLevel] || 2;
    
    if (logLevels[level] <= currentLevel) {
      console.log(`[${timestamp}] [${level.toUpperCase()}] ${message}`);
      if (data && this.logLevel === 'debug') {
        console.log(JSON.stringify(data, null, 2));
      }
    }
  }

  /**
   * Ensure the data directory exists
   */
  ensureDataDirectory() {
    if (!fs.existsSync(this.dataDir)) {
      fs.mkdirSync(this.dataDir, { recursive: true });
      this.log('info', `📁 Created data directory: ${this.dataDir}`);
    }
  }

  /**
   * Fetch data from Dune Analytics API
   */
  async fetchDuneData() {
    try {
      const url = `${this.baseUrl}/query/${this.queryId}/results?limit=1000`;
      const headers = {
        'X-Dune-API-Key': this.apiKey,
        'Content-Type': 'application/json'
      };

      this.log('info', `🔍 Fetching data from Dune Analytics...`);
      this.log('debug', `📡 URL: ${url}`);

      const response = await axios.get(url, { headers });
      
      if (response.status === 200 && response.data) {
        this.log('info', `✅ Successfully fetched data from Dune Analytics`);
        this.log('info', `📊 Execution ID: ${response.data.execution_id}`);
        this.log('info', `🔄 Query State: ${response.data.state}`);
        this.log('info', `📈 Rows fetched: ${response.data.result?.rows?.length || 0}`);
        
        return response.data;
      } else {
        throw new Error(`Unexpected response status: ${response.status}`);
      }
    } catch (error) {
      this.log('error', `❌ Error fetching Dune data: ${error.message}`);
      if (error.response) {
        this.log('error', `📤 Response status: ${error.response.status}`);
        this.log('debug', '📤 Response data:', error.response.data);
      }
      throw error;
    }
  }

  /**
   * Store data in time series format
   */
  async storeTimeSeriesData(duneData) {
    try {
      const timestamp = new Date().toISOString();
      const date = new Date().toISOString().split('T')[0]; // YYYY-MM-DD format
      
      // Create time series entry
      const timeSeriesEntry = {
        timestamp,
        execution_id: duneData.execution_id,
        query_id: duneData.query_id,
        is_execution_finished: duneData.is_execution_finished,
        state: duneData.state,
        submitted_at: duneData.submitted_at,
        expires_at: duneData.expires_at,
        execution_started_at: duneData.execution_started_at,
        execution_ended_at: duneData.execution_ended_at,
        data_count: duneData.result?.rows?.length || 0,
        pools: duneData.result?.rows || []
      };

      // Store daily file
      const dailyFileName = `dune_data_${date}.json`;
      const dailyFilePath = path.join(this.dataDir, dailyFileName);
      
      let dailyData = [];
      if (fs.existsSync(dailyFilePath)) {
        const existingData = fs.readFileSync(dailyFilePath, 'utf8');
        dailyData = JSON.parse(existingData);
      }
      
      dailyData.push(timeSeriesEntry);
      fs.writeFileSync(dailyFilePath, JSON.stringify(dailyData, null, 2));
      
      // Store latest data for quick access
      const latestFilePath = path.join(this.dataDir, 'latest.json');
      fs.writeFileSync(latestFilePath, JSON.stringify(timeSeriesEntry, null, 2));
      
      // Store processed pools data for easy querying
      const poolsFilePath = path.join(this.dataDir, 'latest_pools.json');
      const processedPools = this.processPoolsData(duneData.result?.rows || []);
      fs.writeFileSync(poolsFilePath, JSON.stringify(processedPools, null, 2));
      
      this.log('info', `💾 Stored time series data: ${dailyFileName}`);
      this.log('info', `📊 Pools processed: ${processedPools.length}`);
      
      return timeSeriesEntry;
    } catch (error) {
      this.log('error', `❌ Error storing time series data: ${error.message}`);
      throw error;
    }
  }

  /**
   * Process and normalize pools data
   */
  processPoolsData(pools) {
    return pools.map(pool => ({
      id: pool.id,
      timestamp: new Date().toISOString(),
      token0: {
        decimals: pool.token0_decimals,
        id: pool.token0_id,
        name: pool.token0_name,
        symbol: pool.token0_symbol
      },
      token1: {
        decimals: pool.token1_decimals,
        id: pool.token1_id,
        name: pool.token1_name,
        symbol: pool.token1_symbol
      },
      metrics: {
        totalValueLockedUSD: pool.totalvaluelockedusd,
        volume24hUSD: pool.volume_24h_usd
      }
    }));
  }

  /**
   * Clean up old data based on retention policy
   */
  cleanupOldData() {
    try {
      const files = fs.readdirSync(this.dataDir);
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - this.retentionDays);
      
      let deletedCount = 0;
      files.forEach(file => {
        if (file.startsWith('dune_data_') && file.endsWith('.json')) {
          const dateStr = file.replace('dune_data_', '').replace('.json', '');
          const fileDate = new Date(dateStr);
          
          if (fileDate < cutoffDate) {
            const filePath = path.join(this.dataDir, file);
            fs.unlinkSync(filePath);
            deletedCount++;
            this.log('info', `🗑️ Deleted old data file: ${file}`);
          }
        }
      });
      
      if (deletedCount > 0) {
        this.log('info', `🧹 Cleanup completed: ${deletedCount} old files deleted`);
      }
    } catch (error) {
      this.log('error', `❌ Error during cleanup: ${error.message}`);
    }
  }

  /**
   * Get historical data for a specific date range
   */
  getHistoricalData(startDate, endDate) {
    try {
      const files = fs.readdirSync(this.dataDir);
      const historicalData = [];
      
      files.forEach(file => {
        if (file.startsWith('dune_data_') && file.endsWith('.json')) {
          const dateStr = file.replace('dune_data_', '').replace('.json', '');
          const fileDate = new Date(dateStr);
          
          if (fileDate >= new Date(startDate) && fileDate <= new Date(endDate)) {
            const filePath = path.join(this.dataDir, file);
            const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
            historicalData.push(...data);
          }
        }
      });
      
      return historicalData.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
    } catch (error) {
      this.log('error', `❌ Error getting historical data: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get latest pools data
   */
  getLatestPools() {
    try {
      const latestPoolsPath = path.join(this.dataDir, 'latest_pools.json');
      if (fs.existsSync(latestPoolsPath)) {
        return JSON.parse(fs.readFileSync(latestPoolsPath, 'utf8'));
      }
      return [];
    } catch (error) {
      this.log('error', `❌ Error getting latest pools: ${error.message}`);
      return [];
    }
  }

  /**
   * Get aggregated statistics for pools
   */
  getPoolStatistics() {
    try {
      const pools = this.getLatestPools();
      
      if (pools.length === 0) {
        return { totalPools: 0, totalValueLocked: 0, totalVolume24h: 0 };
      }

      const stats = pools.reduce((acc, pool) => {
        acc.totalValueLocked += pool.metrics.totalValueLockedUSD || 0;
        acc.totalVolume24h += pool.metrics.volume24hUSD || 0;
        return acc;
      }, { totalValueLocked: 0, totalVolume24h: 0 });

      return {
        totalPools: pools.length,
        totalValueLocked: stats.totalValueLocked,
        totalVolume24h: stats.totalVolume24h,
        lastUpdated: pools[0]?.timestamp || null
      };
    } catch (error) {
      this.log('error', `❌ Error getting pool statistics: ${error.message}`);
      return { totalPools: 0, totalValueLocked: 0, totalVolume24h: 0 };
    }
  }

  /**
   * Sync data from Dune Analytics
   */
  async syncData() {
    try {
      this.log('info', `🚀 Starting data aggregation sync at ${new Date().toISOString()}`);
      
      const duneData = await this.fetchDuneData();
      const storedData = await this.storeTimeSeriesData(duneData);
      
      // Cleanup old data
      this.cleanupOldData();
      
      this.log('info', `✅ Data aggregation sync completed successfully`);
      return storedData;
    } catch (error) {
      this.log('error', `❌ Data aggregation sync failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Start the scheduled data aggregation
   */
  startScheduler() {
    // Run every hour
    const cronPattern = `0 */${this.syncIntervalHours} * * *`;
    
    this.log('info', `⏰ Starting data aggregator scheduler...`);
    this.log('info', `📅 Schedule: Every ${this.syncIntervalHours} hour(s) (${cronPattern})`);
    
    cron.schedule(cronPattern, async () => {
      try {
        await this.syncData();
      } catch (error) {
        this.log('error', `❌ Scheduled sync failed: ${error.message}`);
      }
    });
    
    this.log('info', `✅ Data aggregator scheduler started`);
  }

  /**
   * Stop the scheduler (for graceful shutdown)
   */
  stopScheduler() {
    cron.destroy();
    this.log('info', '🛑 Data aggregator scheduler stopped');
  }
}

export default DataAggregatorService; 