const fs = require('fs');

// File paths
const USER_PREFERENCES_FILE = './userPreferences.json';
const POOL_DATA_FILE = './sanitizedPoolData.json';
const INVESTMENT_DECISIONS_FILE = './investmentDecisions.json';

/**
 * Reads user preferences from file
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
  
  // Apply risk strategy
  if (preferences.riskStrategy === 'highestMarketCap') {
    // Sort by total value locked (as a proxy for market cap)
    eligiblePools.sort((a, b) => b.totalValueLockedUSD - a.totalValueLockedUSD);
  } else if (preferences.riskStrategy === 'highestApr') {
    // Already sorted by APR from sanitizePoolData.js
  }
  
  // Select top pools (up to the coin limit)
  const selectedPools = eligiblePools.slice(0, preferences.coinLimit);
  
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

/**
 * Main function
 */
function main() {
  console.log('Starting investment decision process...');
  
  // Load user preferences
  const preferences = loadUserPreferences();
  if (!preferences) {
    console.log('Failed to load user preferences');
    return;
  }
  
  // Load pool data
  const poolData = loadPoolData();
  if (!poolData) {
    console.log('Failed to load pool data');
    return;
  }
  
  // Make investment decisions
  const decisions = makeInvestmentDecisions(preferences, poolData);
  if (!decisions || decisions.length === 0) {
    console.log('No investment decisions could be made');
    return;
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

// Run the application
main(); 