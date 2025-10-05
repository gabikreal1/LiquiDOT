/**
 * Test Pool Creation Script
 * 
 * Tests creating a pool on the deployed Algebra Factory
 */

const { ethers } = require("hardhat");
const fs = require("fs");
const path = require("path");

// Helper to load ABI from artifact
function loadArtifact(artifactPath) {
  return JSON.parse(fs.readFileSync(artifactPath, "utf8"));
}

async function main() {
  const [deployer] = await ethers.getSigners();
  const network = await ethers.provider.getNetwork();
  
  console.log("\n╔════════════════════════════════════════════════════════════╗");
  console.log("║           Test Algebra Pool Creation                      ║");
  console.log("╚════════════════════════════════════════════════════════════╝\n");
  console.log(`Network: ${network.name} (${network.chainId})`);
  console.log(`Deployer: ${deployer.address}\n`);

  // Load deployed contracts
  const deploymentFile = path.join(__dirname, "../deployments/moonbase_algebra.json");
  if (!fs.existsSync(deploymentFile)) {
    console.error("❌ Deployment file not found. Run deploy-moonbase.js first.");
    process.exit(1);
  }

  const deployment = JSON.parse(fs.readFileSync(deploymentFile, "utf8"));
  const factoryAddress = deployment.contracts.factory;
  const nfpmAddress = deployment.contracts.nfpm;
  const poolDeployerAddress = deployment.contracts.poolDeployer;

  console.log(`✓ Factory: ${factoryAddress}`);
  console.log(`✓ PoolDeployer: ${poolDeployerAddress}`);
  console.log(`✓ NFPM: ${nfpmAddress}\n`);

  // Load Factory ABI
  const factoryArtifact = loadArtifact(
    path.join(__dirname, "../node_modules/@cryptoalgebra/integral-core/artifacts/contracts/AlgebraFactory.sol/AlgebraFactory.json")
  );
  const factory = new ethers.Contract(factoryAddress, factoryArtifact.abi, deployer);

  // Deploy test tokens
  console.log("STEP 1: Deploy Test Tokens");
  console.log("-".repeat(60));
  
  const TestERC20 = await ethers.getContractFactory("TestERC20");
  
  console.log("📦 Deploying TestUSDC...");
  const usdc = await TestERC20.deploy("Test USDC", "USDC");
  await usdc.waitForDeployment();
  const usdcAddress = await usdc.getAddress();
  console.log(`✅ USDC: ${usdcAddress}`);

  console.log("\n📦 Deploying TestUSDT...");
  const usdt = await TestERC20.deploy("Test USDT", "USDT");
  await usdt.waitForDeployment();
  const usdtAddress = await usdt.getAddress();
  console.log(`✅ USDT: ${usdtAddress}`);

  // Sort tokens (Algebra requires token0 < token1)
  const [token0, token1] = usdcAddress < usdtAddress ? 
    [usdcAddress, usdtAddress] : [usdtAddress, usdcAddress];
  
  console.log(`\n✓ Sorted tokens: token0=${token0}, token1=${token1}`);

  // Create pool
  console.log("\nSTEP 2: Create Pool");
  console.log("-".repeat(60));
  
  console.log("📦 Creating USDC/USDT pool...");
  const createTx = await factory.createPool(token0, token1, "0x");
  const receipt = await createTx.wait();
  console.log(`✅ Pool created! Tx: ${receipt.hash}`);

  // Get pool address
  const poolAddress = await factory.poolByPair(token0, token1);
  console.log(`✅ Pool address: ${poolAddress}`);

  // Verify pool was created
  if (poolAddress === ethers.ZeroAddress) {
    console.error("❌ Pool creation failed - got zero address!");
    process.exit(1);
  }

  // Initialize pool
  console.log("\nSTEP 3: Initialize Pool");
  console.log("-".repeat(60));
  
  // Load Pool ABI
  const poolArtifact = loadArtifact(
    path.join(__dirname, "../node_modules/@cryptoalgebra/integral-core/artifacts/contracts/AlgebraPool.sol/AlgebraPool.json")
  );
  const pool = new ethers.Contract(poolAddress, poolArtifact.abi, deployer);
  
  console.log("📦 Initializing pool at 1:1 price...");
  const sqrtPriceX96 = BigInt("79228162514264337593543950336"); // sqrt(1) * 2^96
  const initTx = await pool.initialize(sqrtPriceX96);
  await initTx.wait();
  console.log(`✅ Pool initialized! Tx: ${initTx.hash}`);

  // Verify initialization
  const globalState = await pool.globalState();
  console.log(`✅ Pool sqrtPrice: ${globalState.price}`);
  console.log(`✅ Pool tick: ${globalState.tick}`);
  
  // Check plugin configuration (Algebra Integral feature)
  try {
    const plugin = await pool.plugin();
    console.log(`🔌 Pool plugin: ${plugin}`);
    if (plugin !== ethers.ZeroAddress) {
      console.log(`⚠️  Pool has an active plugin at ${plugin}`);
    }
  } catch (e) {
    console.log(`⚠️  Could not read plugin (might not exist in this version)`);
  }
  
  // Note: Algebra Integral v1.2.x pools don't have a deployer() getter
  // The deployer parameter in MintParams is just the PoolDeployer contract address
  console.log(`📝 Will use PoolDeployer address from deployment: ${poolDeployerAddress}`);

  // Add liquidity
  console.log("\nSTEP 4: Add Liquidity");
  console.log("-".repeat(60));

  // Load NFPM ABI
  const nfpmArtifact = loadArtifact(
    path.join(__dirname, "../node_modules/@cryptoalgebra/integral-periphery/artifacts/contracts/NonfungiblePositionManager.sol/NonfungiblePositionManager.json")
  );
  const nfpm = new ethers.Contract(nfpmAddress, nfpmArtifact.abi, deployer);

  // Mint tokens (start with smaller amount for testing)
  const amount = ethers.parseEther("10000"); // 10K tokens (more reasonable for testing)
  console.log("📦 Minting tokens...");
  await (await usdc.mint(deployer.address, amount)).wait();
  await (await usdt.mint(deployer.address, amount)).wait();
  console.log(`✅ Minted ${ethers.formatEther(amount)} of each token`);

  // Approve NFPM
  console.log("\n📦 Approving NFPM...");
  await (await usdc.approve(nfpmAddress, amount)).wait();
  await (await usdt.approve(nfpmAddress, amount)).wait();
  console.log(`✅ Approved NFPM to spend tokens`);

  // Get tick spacing and calculate valid tick range
  let tickSpacing;
  try {
    tickSpacing = Number(await pool.tickSpacing());
  } catch (e) {
    console.log(`⚠️  Could not read tickSpacing, using default: 60`);
    tickSpacing = 60;
  }
  
  // Fallback to 60 if undefined/NaN
  if (!tickSpacing || isNaN(tickSpacing)) {
    console.log(`⚠️  tickSpacing is invalid (${tickSpacing}), using default: 60`);
    tickSpacing = 60;
  }
  
  console.log(`\n📊 Pool tick spacing: ${tickSpacing}`);
  
  // Calculate valid ticks aligned to tick spacing
  // Use a reasonable range around current price (tick 0)
  // Full range can be gas intensive, use +/- 100,000 ticks instead
  const tickRange = 100000;
  const tickLower = Math.floor(-tickRange / tickSpacing) * tickSpacing;
  const tickUpper = Math.floor(tickRange / tickSpacing) * tickSpacing;
  
  console.log(`📊 Using tick range: [${tickLower}, ${tickUpper}]`);

  // Verify NFPM can compute the correct pool address
  console.log("\n🔍 Verifying pool address computation...");
  const computedPoolAddress = await factory.poolByPair(token0, token1);
  console.log(`📍 Pool address from factory: ${poolAddress}`);
  console.log(`📍 Pool address from poolByPair: ${computedPoolAddress}`);
  
  if (poolAddress.toLowerCase() !== computedPoolAddress.toLowerCase()) {
    console.error("❌ Pool address mismatch! NFPM may not find the pool.");
    console.error(`   Created: ${poolAddress}`);
    console.error(`   Expected: ${computedPoolAddress}`);
    throw new Error("Pool address mismatch");
  }
  console.log("✅ Pool addresses match!");

  // Add liquidity
  console.log("\n📦 Adding liquidity...");
  console.log(`🔧 Using PoolDeployer address: ${poolDeployerAddress}`);
  
  const mintParams = {
    token0: token0,
    token1: token1,
    deployer: poolDeployerAddress,  // PoolDeployer contract address
    tickLower: tickLower,
    tickUpper: tickUpper,
    amount0Desired: amount,
    amount1Desired: amount,
    amount0Min: 0,
    amount1Min: 0,
    recipient: deployer.address,
    deadline: Math.floor(Date.now() / 1000) + 3600, // 1 hour
  };

  console.log(`📋 Mint params: ${JSON.stringify({
    ...mintParams,
    amount0Desired: ethers.formatEther(mintParams.amount0Desired),
    amount1Desired: ethers.formatEther(mintParams.amount1Desired),
  }, null, 2)}`);

  let mintReceipt;
  try {
    console.log("\n🔄 Estimating gas...");
    const gasEstimate = await nfpm.mint.estimateGas(mintParams);
    console.log(`⛽ Estimated gas: ${gasEstimate.toString()}`);
    
    console.log("📤 Sending mint transaction...");
    const mintTx = await nfpm.mint(mintParams, { gasLimit: gasEstimate * 120n / 100n });
    console.log(`⏳ Waiting for confirmation...`);
    mintReceipt = await mintTx.wait();
    console.log(`✅ Liquidity added! Tx: ${mintReceipt.hash}`);
  } catch (error) {
    console.error("\n❌ Mint failed!");
    console.error("Error:", error.message);
    
    // Try to get more details
    if (error.data) {
      console.error("Error data:", error.data);
    }
    
    // Try calling staticCall to get revert reason
    try {
      console.log("\n🔍 Attempting to get revert reason...");
      await nfpm.mint.staticCall(mintParams);
    } catch (staticError) {
      console.error("Static call error:", staticError.message);
      if (staticError.reason) {
        console.error("Revert reason:", staticError.reason);
      }
    }
    
    throw error;
  }

  // Get the NFT token ID from events
  const transferEvent = mintReceipt.logs.find(
    log => log.topics[0] === ethers.id("Transfer(address,address,uint256)")
  );
  
  let tokenId;
  if (transferEvent) {
    tokenId = ethers.toBigInt(transferEvent.topics[3]);
    console.log(`✅ NFT Position ID: ${tokenId}`);
  }

  console.log("\n" + "=".repeat(60));
  console.log("\n╔════════════════════════════════════════════════════════════╗");
  console.log("║              POOL CREATION TEST SUCCESS! 🎉                ║");
  console.log("╚════════════════════════════════════════════════════════════╝\n");

  const summary = {
    network: network.name,
    pool: poolAddress,
    tokens: {
      token0: token0,
      token1: token1,
      usdc: usdcAddress,
      usdt: usdtAddress,
    },
    nftPositionId: tokenId ? tokenId.toString() : "unknown",
    liquidityAmount: ethers.formatEther(amount),
  };

  console.log("📋 Summary:");
  console.log(JSON.stringify(summary, null, 2));

  // Save test results
  const outputFile = path.join(__dirname, "../deployments/test-pool-result.json");
  fs.writeFileSync(outputFile, JSON.stringify(summary, null, 2));
  console.log(`\n💾 Saved to: deployments/test-pool-result.json`);

  console.log("\n✅ You can now use this pool for testing XCMProxy!");
  console.log(`   Pool Address: ${poolAddress}`);
  console.log(`   Token0: ${token0}`);
  console.log(`   Token1: ${token1}`);

  return summary;
}

if (require.main === module) {
  main()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error("\n❌ Test failed:", error);
      process.exit(1);
    });
}

module.exports = { main };

