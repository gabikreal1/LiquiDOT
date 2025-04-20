const fs = require('fs');

// File paths
const USER_PREFERENCES_FILE = './userPreferences.json';
const POOL_DATA_FILE = './sanitizedPoolData.json';
const INVESTMENT_DECISIONS_FILE = './investmentDecisions.json';

/**
 * Reads user preferences from file
 * @returns {Object|null} User preferences object or null if error
 */
function loadUserPreferences() {
  try {
    if (fs.existsSync(USER_PREFERENCES_FILE)) {
      const data = fs.readFileSync(USER_PREFERENCES_FILE, 'utf8');
      return JSON.parse(data);
    } else {
      console.error(`Error: User preferences file not found (${USER_PREFERENCES_FILE})`);
      return null;
    }
  } catch (error) {
    console.error('Error loading user preferences:', error.message);
    return null;
  }
}

/**
 * Reads sanitized pool data from file
 * @returns {Object|null} Pool data object or null if error
 */
function loadPoolData() {
  try {
    if (fs.existsSync(POOL_DATA_FILE)) {
      const data = fs.readFileSync(POOL_DATA_FILE, 'utf8');
      return JSON.parse(data);
    } else {
      console.error(`Error: Pool data file not found (${POOL_DATA_FILE})`);
      return null;
    }
  } catch (error) {
    console.error('Error loading pool data:', error.message);
    return null;
  }
}

/**
 * Makes investment decisions based on user preferences and pool data
 * @param {Object} preferences User preferences
 * @param {Object} poolData Pool data
 * @returns {Array|null} Array of investment decisions or null if error
 */
function makeInvestmentDecisions(preferences, poolData) {
  if (!preferences || !poolData || !poolData.pools) {
    console.error('Error: Invalid preferences or pool data');
    return null;
  }

  console.log('Making investment decisions based on user preferences...');
  console.log(`Minimum Required APR: ${preferences.minRequiredApr}%`);
  console.log(`Minimum Market Cap: $${preferences.minMarketCap.toLocaleString()}`);
  console.log(`Risk Strategy: ${preferences.riskStrategy}`);
  
  // Extract allowed coins list (if provided)
  const allowedCoins = preferences.allowedCoins || [];
  console.log(`Allowed Coins List: ${allowedCoins.length > 0 ? allowedCoins.join(', ') : 'No restrictions'}`);
  
  // Filter pools by minimum APR
  let eligiblePools = poolData.pools.filter(pool => 
    pool.approximateAPR >= preferences.minRequiredApr
  );
  
  console.log(`Found ${eligiblePools.length} pools with APR >= ${preferences.minRequiredApr}%`);
  
  // Filter out pools with extremely high APRs (likely to be calculation errors or very low liquidity)
  eligiblePools = eligiblePools.filter(pool => 
    pool.approximateAPR < 10000000 && pool.totalValueLockedUSD > 0.01
  );
  
  console.log(`Filtered to ${eligiblePools.length} pools with reasonable APR and liquidity`);
  
  // Filter pools based on allowed coins (if the list is not empty)
  if (allowedCoins.length > 0) {
    eligiblePools = eligiblePools.filter(pool => {
      // Check if at least one of the tokens in the pool is in the allowed list
      return allowedCoins.includes(pool.token0.symbol) || allowedCoins.includes(pool.token1.symbol);
    });
    
    console.log(`Filtered to ${eligiblePools.length} pools containing at least one allowed coin`);
  }
  
  // Apply risk strategy
  if (preferences.riskStrategy === 'highestMarketCap') {
    // Sort by total value locked (as a proxy for market cap)
    eligiblePools.sort((a, b) => b.totalValueLockedUSD - a.totalValueLockedUSD);
  } else if (preferences.riskStrategy === 'highestApr') {
    // Already sorted by APR from sanitizePoolData.js
  }
  
  // Use maxDecisions from user preferences if provided, otherwise default to coinLimit
  const maxDecisions = 10 //preferences.maxDecisions || preferences.coinLimit;
  const effectiveLimit = Math.min(maxDecisions, preferences.coinLimit);
  const selectedPools = eligiblePools.slice(0, effectiveLimit);
  
  console.log(`Selected ${selectedPools.length} pools (maximum set to ${maxDecisions})`);
  
  // Create investment decisions
  const decisions = selectedPools.map((pool, index) => {
    // Calculate proportion based on APR and TVL
    // Higher APR and higher TVL get more weight
    const aprScore = Math.min(pool.approximateAPR / 100, 1000); // Cap APR score
    const tvlScore = Math.log10(Math.max(pool.totalValueLockedUSD, 1)); // Log scale for TVL
    const score = aprScore * tvlScore;
    
    return {
      poolId: pool.id,
      pairName: `${pool.token0.symbol}/${pool.token1.symbol}`,
      token0: {
        symbol: pool.token0.symbol,
        address: pool.token0.id
      },
      token1: {
        symbol: pool.token1.symbol,
        address: pool.token1.id
      },
      approximateAPR: pool.approximateAPR,
      totalValueLockedUSD: pool.totalValueLockedUSD,
      score: score,
      stopLoss: preferences.stopLossLevel,
      takeProfit: preferences.takeProfitLevel
    };
  });
  
  // Calculate proportions based on scores
  const totalScore = decisions.reduce((sum, decision) => sum + decision.score, 0);
  
  decisions.forEach(decision => {
    decision.proportion = totalScore > 0 
      ? (decision.score / totalScore) * 100 
      : (100 / decisions.length); // Equal distribution if no scores
    delete decision.score; // Remove intermediate calculation
  });
  
  return decisions;
}

/**
 * Saves investment decisions to file
 * @param {Array} decisions Array of investment decisions
 * @returns {boolean} True if saved successfully, false otherwise
 */
function saveInvestmentDecisions(decisions) {
  try {
    fs.writeFileSync(INVESTMENT_DECISIONS_FILE, JSON.stringify({
      timestamp: new Date().toISOString(),
      decisions: decisions
    }, null, 2));
    console.log(`Successfully saved investment decisions to ${INVESTMENT_DECISIONS_FILE}`);
    return true;
  } catch (error) {
    console.error('Error saving investment decisions:', error.message);
    return false;
  }
}

// Run the application if this file is directly executed
if (require.main === module) {
  console.log('Starting investment decision process...');
  
  // Load user preferences
  const preferences = loadUserPreferences();
  if (!preferences) {
    console.log('Failed to load user preferences');
    process.exit(1);
  }
  
  // Load pool data
  const poolData = loadPoolData();
  if (!poolData) {
    console.log('Failed to load pool data');
    process.exit(1);
  }
  
  // Make investment decisions
  const decisions = makeInvestmentDecisions(preferences, poolData);
  if (!decisions || decisions.length === 0) {
    console.log('No investment decisions could be made');
    process.exit(1);
  }
  
  // Save investment decisions
  const saved = saveInvestmentDecisions(decisions);
  if (saved) {
    // Print summary of decisions
    console.log('\nTop Investment Decisions:');
    console.log('--------------------------------------');
    decisions.slice(0, 5).forEach((decision, index) => {
      console.log(`${index+1}. ${decision.pairName}`);
      console.log(`   Approximate APR: ${decision.approximateAPR.toFixed(2)}%`);
      console.log(`   Total Value Locked: $${decision.totalValueLockedUSD.toFixed(2)}`);
      console.log(`   Allocation: ${decision.proportion.toFixed(2)}%`);
      console.log(`   Stop Loss: ${decision.stopLoss}%`);
      console.log(`   Take Profit: ${decision.takeProfit}%`);
      console.log('--------------------------------------');
    });
  }
}

// Export functions for use in other modules
module.exports = {
  loadUserPreferences,
  loadPoolData,
  makeInvestmentDecisions,
  saveInvestmentDecisions
}; 