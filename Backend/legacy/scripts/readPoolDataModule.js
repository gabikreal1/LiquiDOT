const fs = require('fs');

// File paths
const DATA_FILE = './data.json';
const SANITIZED_FILE = './sanitizedPoolData.json';

/**
 * Reads the pool data from the data.json file and extracts key information
 * @returns {Array|null} Array of sanitized pool data or null if error
 */
function readAndSanitizePoolData() {
  try {
    console.log('Reading pool data from file...');
    
    // Check if the data file exists
    if (!fs.existsSync(DATA_FILE)) {
      console.error(`Error: File ${DATA_FILE} not found`);
      return null;
    }
    
    // Read the data file
    const data = fs.readFileSync(DATA_FILE, 'utf8');
    const poolData = JSON.parse(data);
    
    // Check if the data has the expected structure
    if (!poolData.data || !poolData.data.pools || !Array.isArray(poolData.data.pools)) {
      console.error('Error: Data file does not have the expected structure');
      return null;
    }
    
    // Extract the key information from each pool
    const sanitizedPools = poolData.data.pools.map(pool => {
      // Calculate APR based on volume and total value locked (simplified calculation)
      const volumeUSD = parseFloat(pool.volumeUSD || '0');
      const totalValueLockedUSD = parseFloat(pool.totalValueLockedUSD || '0');
      // Fee is given in thousandths of a percent (0.001%)
      const feePercent = parseInt(pool.fee) / 1000; // Convert fee from thousandths to actual percentage
      const annualFees = volumeUSD * 365 * (feePercent / 100); // Convert percentage to decimal for multiplication
      const approximateAPR = totalValueLockedUSD > 0 ? (annualFees / totalValueLockedUSD) * 100 : 0;

      return {
        id: pool.id,
        createdAt: new Date(parseInt(pool.createdAtTimestamp) * 1000).toISOString(),
        fee: parseInt(pool.fee) / 1000, // Convert from thousandths to actual percentage
        token0: {
          symbol: pool.token0.symbol,
          name: pool.token0.name,
          id: pool.token0.id
        },
        token1: {
          symbol: pool.token1.symbol,
          name: pool.token1.name,
          id: pool.token1.id
        },
        token0Price: parseFloat(pool.token0Price),
        token1Price: parseFloat(pool.token1Price),
        totalValueLockedUSD: parseFloat(pool.totalValueLockedUSD),
        totalValueLockedToken0: parseFloat(pool.totalValueLockedToken0),
        totalValueLockedToken1: parseFloat(pool.totalValueLockedToken1),
        volumeUSD: volumeUSD,
        txCount: parseInt(pool.txCount),
        approximateAPR: approximateAPR
      };
    });
    
    // Sort pools by approximate APR in descending order
    sanitizedPools.sort((a, b) => b.approximateAPR - a.approximateAPR);
    
    // Save the sanitized data to a new file
    fs.writeFileSync(SANITIZED_FILE, JSON.stringify({ pools: sanitizedPools }, null, 2));
    console.log(`Successfully sanitized pool data and saved to ${SANITIZED_FILE}`);
    
    // Print a summary of the top pools by APR (only if not called as a module)
    if (require.main === module) {
      console.log('\nTop 5 Pools by Approximate APR:');
      console.log('--------------------------------------');
      for (let i = 0; i < Math.min(5, sanitizedPools.length); i++) {
        const pool = sanitizedPools[i];
        console.log(`${i+1}. ${pool.token0.symbol}/${pool.token1.symbol}`);
        console.log(`   Approximate APR: ${pool.approximateAPR.toFixed(2)}%`);
        console.log(`   Total Value Locked: $${pool.totalValueLockedUSD.toFixed(2)}`);
        console.log(`   Volume: $${pool.volumeUSD.toFixed(2)}`);
        console.log('--------------------------------------');
      }
    }
    
    return sanitizedPools;
  } catch (error) {
    console.error('Error reading or sanitizing pool data:', error.message);
    return null;
  }
}

// Run the application if this file is directly executed
if (require.main === module) {
  console.log('Starting the pool data processing...');
  const sanitizedPools = readAndSanitizePoolData();
  
  if (sanitizedPools) {
    console.log('Ready to process data and make investment decisions');
  } else {
    console.log('Failed to read or sanitize pool data');
  }
}

// Export functions for use in other modules
module.exports = {
  readAndSanitizePoolData
}; 