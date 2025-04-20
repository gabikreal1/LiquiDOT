const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

// Import functions from existing files
const { readAndSanitizePoolData } = require('./readPoolDataModule');
const { makeInvestmentDecisions } = require('./poolInvestmentDecisionModule');

// File paths
const POOL_DATA_FILE = './sanitizedPoolData.json';
const DECISIONS_FOLDER = './decisions';

// Ensure decisions folder exists
if (!fs.existsSync(DECISIONS_FOLDER)) {
  fs.mkdirSync(DECISIONS_FOLDER, { recursive: true });
}

// Initialize express app
const app = express();
const PORT = process.env.PORT || 3001;

// Middlewares
app.use(cors());
app.use(express.json());

// GET: Health check
app.get('/api/health', (req, res) => {
  res.status(200).json({ status: 'ok', message: 'Server is running' });
});

// GET: Get available pools
app.get('/api/pools', (req, res) => {
  try {
    if (!fs.existsSync(POOL_DATA_FILE)) {
      // If pool data doesn't exist, process it first
      const poolData = readAndSanitizePoolData();
      if (!poolData) {
        return res.status(500).json({ 
          success: false, 
          message: 'Failed to process pool data' 
        });
      }
      return res.status(200).json({ 
        success: true, 
        data: { pools: poolData }
      });
    }

    // Read existing pool data
    const data = fs.readFileSync(POOL_DATA_FILE, 'utf8');
    const poolData = JSON.parse(data);
    res.status(200).json({
      success: true,
      data: poolData
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: `Error getting pools: ${error.message}`
    });
  }
});

// GET: List previous investment decisions
app.get('/api/decisions', (req, res) => {
  try {
    const decisions = fs.readdirSync(DECISIONS_FOLDER);
    res.status(200).json({
      success: true,
      data: decisions
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: `Error listing decisions: ${error.message}`
    });
  }
});

// GET: Get a specific investment decision by filename
app.get('/api/decisions/:filename', (req, res) => {
  try {
    const filePath = path.join(DECISIONS_FOLDER, req.params.filename);
    
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({
        success: false,
        message: 'Decision file not found'
      });
    }
    
    const data = fs.readFileSync(filePath, 'utf8');
    const decision = JSON.parse(data);
    
    res.status(200).json({
      success: true,
      data: decision
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: `Error getting decision: ${error.message}`
    });
  }
});

// POST: Get investment decisions based on user preferences
app.post('/api/get-investment-decisions', (req, res) => {
  try {
    const userPreferences = req.body;
    
    // Validate user preferences
    if (!userPreferences) {
      return res.status(400).json({
        success: false,
        message: 'User preferences are required'
      });
    }

    // Check for required fields
    const requiredFields = ['coinLimit', 'minRequiredApr', 'minMarketCap', 
                           'stopLossLevel', 'takeProfitLevel', 'riskStrategy', 'userAddress'];
    
    for (const field of requiredFields) {
      if (userPreferences[field] === undefined) {
        return res.status(400).json({
          success: false,
          message: `Missing required field: ${field}`
        });
      }
    }

    // Validate allowedCoins is an array if provided
    if (userPreferences.allowedCoins !== undefined && !Array.isArray(userPreferences.allowedCoins)) {
      return res.status(400).json({
        success: false,
        message: 'allowedCoins must be an array of coin symbols'
      });
    }
    
    // If maxDecisions is provided, ensure it's a positive number
    if (userPreferences.maxDecisions !== undefined) {
      if (typeof userPreferences.maxDecisions !== 'number' || userPreferences.maxDecisions <= 0) {
        return res.status(400).json({
          success: false,
          message: 'maxDecisions must be a positive number'
        });
      }
    }

    // Load pool data first
    let poolData;
    if (fs.existsSync(POOL_DATA_FILE)) {
      const data = fs.readFileSync(POOL_DATA_FILE, 'utf8');
      poolData = JSON.parse(data);
    } else {
      // Process pool data if not available
      const processedPools = readAndSanitizePoolData();
      if (!processedPools) {
        return res.status(500).json({
          success: false,
          message: 'Failed to process pool data'
        });
      }
      poolData = { pools: processedPools };
    }

    // Make investment decisions
    const decisions = makeInvestmentDecisions(userPreferences, poolData);
    
    if (!decisions || decisions.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'No eligible pools found matching your criteria'
      });
    }

    // Create the decision data with timestamp
    const decisionData = {
      timestamp: new Date().toISOString(),
      userPreferences: userPreferences,
      decisions: decisions
    };

    // Create a unique filename based on timestamp and user address
    const timestamp = new Date().toISOString().replace(/:/g, '-');
    const addressShort = userPreferences.userAddress.substring(0, 8);
    const filename = `decision_${timestamp}_${addressShort}.json`;
    const filePath = path.join(DECISIONS_FOLDER, filename);

    // Save decision to a file
    fs.writeFileSync(filePath, JSON.stringify(decisionData, null, 2));
    console.log(`Saved investment decision to ${filePath}`);

    // Return decision data and the filename
    res.status(200).json({
      success: true,
      data: {
        filename: filename,
        ...decisionData
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: `Error processing investment decisions: ${error.message}`
    });
  }
});

// POST: Get investment decisions based on user preferences
app.post('/api/investmentDecisions', async (req, res) => {
  try {
    console.log('Received investment decision request:', req.body);
    
    // Create decisions directory if it doesn't exist
    if (!fs.existsSync(DECISIONS_FOLDER)) {
      fs.mkdirSync(DECISIONS_FOLDER, { recursive: true });
      console.log(`Created directory: ${DECISIONS_FOLDER}`);
    }
    
    // Validate input
    const requiredFields = ['coinLimit', 'minRequiredApr', 'minMarketCap', 
                           'stopLossLevel', 'takeProfitLevel', 'riskStrategy', 'userAddress'];
    
    for (const field of requiredFields) {
      if (req.body[field] === undefined) {
        return res.status(400).json({ error: `Missing required field: ${field}` });
      }
    }
    
    // Validate allowedCoins is an array if provided
    if (req.body.allowedCoins !== undefined && !Array.isArray(req.body.allowedCoins)) {
      return res.status(400).json({ 
        error: 'Invalid allowedCoins format',
        details: 'allowedCoins must be an array of coin symbols'
      });
    }
    
    // Validate coinLimit doesn't exceed maximum allowed value of 10
    if (req.body.coinLimit > 100) {
      return res.status(400).json({ 
        error: 'coinLimit exceeds maximum allowed value',
        details: 'The maximum number of pools allowed is 100'
      });
    }
    
    // If maxDecisions is provided, ensure it's a positive number
    if (req.body.maxDecisions !== undefined) {
      if (typeof req.body.maxDecisions !== 'number' || req.body.maxDecisions <= 0) {
        return res.status(400).json({
          error: 'Invalid maxDecisions value',
          details: 'maxDecisions must be a positive number'
        });
      }
    }
    
    // Get current pool data
    let poolData;
    if (fs.existsSync(POOL_DATA_FILE)) {
      const data = fs.readFileSync(POOL_DATA_FILE, 'utf8');
      poolData = JSON.parse(data);
    } else {
      // Process pool data if not available
      const processedPools = readAndSanitizePoolData();
      if (!processedPools) {
        return res.status(500).json({
          success: false,
          message: 'Failed to process pool data'
        });
      }
      poolData = { pools: processedPools };
    }

    // Make investment decisions
    const decisions = makeInvestmentDecisions(req.body, poolData);
    
    if (!decisions || decisions.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'No eligible pools found matching your criteria'
      });
    }

    // Create the decision data with timestamp
    const decisionData = {
      timestamp: new Date().toISOString(),
      userPreferences: req.body,
      decisions: decisions
    };

    // Create a unique filename based on timestamp and user address
    const timestamp = new Date().toISOString().replace(/:/g, '-');
    const addressShort = req.body.userAddress.substring(0, 8);
    const filename = `decision_${timestamp}_${addressShort}.json`;
    const filePath = path.join(DECISIONS_FOLDER, filename);

    // Save decision to a file
    fs.writeFileSync(filePath, JSON.stringify(decisionData, null, 2));
    console.log(`Saved investment decision to ${filePath}`);

    // Return decision data and the filename
    res.status(200).json({
      success: true,
      data: {
        filename: filename,
        ...decisionData
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: `Error processing investment decisions: ${error.message}`
    });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
}); 