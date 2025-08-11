import dotenv from 'dotenv';
import DataAggregatorService from './src/DataAggregatorService.js';

// Load environment variables
dotenv.config();

console.log('🚀 Starting LiquiDOT Data Aggregator Service...');
console.log('=====================================');

async function startService() {
  let service;
  
  try {
    // Initialize the service
    service = new DataAggregatorService();
    
    // Run initial sync
    console.log('🔄 Running initial data sync...');
    await service.syncData();
    console.log('✅ Initial sync completed successfully\n');
    
    // Start scheduler for future syncs
    console.log('⏰ Starting automated scheduler...');
    service.startScheduler();
    console.log('✅ Data aggregator service is now running');
    console.log('📊 Data will be synced automatically every hour');
    console.log('🛑 Press Ctrl+C to stop the service\n');
    
    return service;
  } catch (error) {
    console.error('❌ Failed to start data aggregator service:', error.message);
    console.error('📤 Error details:', error);
    process.exit(1);
  }
}

// Graceful shutdown handlers
function setupGracefulShutdown(service) {
  const shutdown = (signal) => {
    console.log(`\n🛑 Received ${signal}, shutting down data aggregator service...`);
    if (service) {
      service.stopScheduler();
    }
    console.log('👋 Data aggregator service stopped gracefully');
    process.exit(0);
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  
  process.on('uncaughtException', (error) => {
    console.error('💥 Uncaught Exception:', error);
    if (service) {
      service.stopScheduler();
    }
    process.exit(1);
  });

  process.on('unhandledRejection', (reason, promise) => {
    console.error('💥 Unhandled Rejection at:', promise, 'reason:', reason);
    if (service) {
      service.stopScheduler();
    }
    process.exit(1);
  });
}

// Start the service
startService().then(service => {
  setupGracefulShutdown(service);
}); 