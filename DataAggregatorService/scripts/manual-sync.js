import dotenv from 'dotenv';
import DataAggregatorService from '../src/DataAggregatorService.js';

// Load environment variables
dotenv.config();

console.log('🔄 Manual Data Sync - LiquiDOT Data Aggregator');
console.log('===============================================');

async function runManualSync() {
  try {
    // Initialize the service
    const service = new DataAggregatorService();
    
    // Run sync
    console.log('🚀 Starting manual data sync...');
    const result = await service.syncData();
    
    console.log('\n✅ Manual sync completed successfully!');
    console.log('📊 Sync Results:');
    console.log(`   • Timestamp: ${result.timestamp}`);
    console.log(`   • Execution ID: ${result.execution_id}`);
    console.log(`   • Query ID: ${result.query_id}`);
    console.log(`   • Data Count: ${result.data_count} pools`);
    console.log(`   • State: ${result.state}`);
    
    // Show statistics
    const stats = service.getPoolStatistics();
    console.log('\n📈 Pool Statistics:');
    console.log(`   • Total Pools: ${stats.totalPools}`);
    console.log(`   • Total Value Locked: $${stats.totalValueLocked.toLocaleString()}`);
    console.log(`   • Total 24h Volume: $${stats.totalVolume24h.toLocaleString()}`);
    
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Manual sync failed:', error.message);
    console.error('📤 Error details:', error);
    process.exit(1);
  }
}

// Run the manual sync
runManualSync(); 