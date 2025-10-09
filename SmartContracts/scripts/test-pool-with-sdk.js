/**
 * Test Pool Creation with Algebra SDK
 * 
 * This script uses the official @cryptoalgebra/sdk to create pools and add liquidity
 */

const { ethers } = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  console.log("\n╔════════════════════════════════════════════════════════════╗");
  console.log("║      Test Pool Creation with Algebra SDK                   ║");
  console.log("╚════════════════════════════════════════════════════════════╝\n");

  const [deployer] = await ethers.getSigners();
  const network = await ethers.provider.getNetwork();
  
  console.log(`Network: ${network.name} (${network.chainId})`);
  console.log(`Deployer: ${deployer.address}\n`);

  // Load deployment
  const deploymentFile = path.join(__dirname, `../deployments/${network.name}_algebra.json`);
  if (!fs.existsSync(deploymentFile)) {
    console.error("❌ Deployment file not found. Run deploy-moonbase.js first.");
    process.exit(1);
  }

  const deployment = JSON.parse(fs.readFileSync(deploymentFile, "utf8"));
  const factoryAddress = deployment.contracts.factory;
  const nfpmAddress = deployment.contracts.nfpm;
  const poolDeployerAddress = deployment.contracts.poolDeployer;

  console.log("Deployed Contracts:");
  console.log(`  Factory: ${factoryAddress}`);
  console.log(`  NFPM: ${nfpmAddress}`);
  console.log(`  PoolDeployer: ${poolDeployerAddress}\n`);

  // Deploy test tokens
  console.log("STEP 1: Deploy Test Tokens");
  console.log("-".repeat(60));
  
  const TestERC20 = await ethers.getContractFactory("TestERC20");
  
  console.log("📦 Deploying TestUSDC...");
  const usdc = await TestERC20.deploy("Test USDC", "USDC", 18);
  await usdc.waitForDeployment();
  const usdcAddress = await usdc.getAddress();
  console.log(`✅ USDC: ${usdcAddress}`);

  console.log("\n📦 Deploying TestUSDT...");
  const usdt = await TestERC20.deploy("Test USDT", "USDT", 18);
  await usdt.waitForDeployment();
  const usdtAddress = await usdt.getAddress();
  console.log(`✅ USDT: ${usdtAddress}`);

  // Sort tokens (Algebra requires token0 < token1)
  let token0, token1, token0Address, token1Address;
  if (usdcAddress.toLowerCase() < usdtAddress.toLowerCase()) {
    token0 = usdc;
    token1 = usdt;
    token0Address = usdcAddress;
    token1Address = usdtAddress;
  } else {
    token0 = usdt;
    token1 = usdc;
    token0Address = usdtAddress;
    token1Address = usdcAddress;
  }

  console.log(`\n✓ Sorted tokens: token0=${token0Address}, token1=${token1Address}`);

  // Create Pool
  console.log("\nSTEP 2: Create Pool");
  console.log("-".repeat(60));

  const factoryAbi = [
    "function createPool(address tokenA, address tokenB, bytes data) external returns (address pool)",
    "function poolByPair(address tokenA, address tokenB) external view returns (address pool)"
  ];
  const factory = new ethers.Contract(factoryAddress, factoryAbi, deployer);

  console.log("📦 Creating pool...");
  const createTx = await factory.createPool(token0Address, token1Address, "0x");
  await createTx.wait();
  console.log(`✅ Pool created! Tx: ${createTx.hash}`);

  const poolAddress = await factory.poolByPair(token0Address, token1Address);
  console.log(`✅ Pool address: ${poolAddress}`);

  // Initialize Pool
  console.log("\nSTEP 3: Initialize Pool");
  console.log("-".repeat(60));

  const poolAbi = [
    "function initialize(uint160 initialPrice) external",
    "function globalState() external view returns (uint160 price, int24 tick, uint16 lastFee, uint8 pluginConfig, uint16 communityFee, bool unlocked)"
  ];
  const pool = new ethers.Contract(poolAddress, poolAbi, deployer);

  console.log("📦 Initializing pool at 1:1 price...");
  const sqrtPriceX96 = BigInt("79228162514264337593543950336"); // sqrt(1) * 2^96
  const initTx = await pool.initialize(sqrtPriceX96);
  await initTx.wait();
  console.log(`✅ Pool initialized! Tx: ${initTx.hash}`);

  const globalState = await pool.globalState();
  console.log(`✅ Pool price: ${globalState.price}`);
  console.log(`✅ Pool tick: ${globalState.tick}`);

  // Mint tokens and approve
  console.log("\nSTEP 4: Prepare Tokens");
  console.log("-".repeat(60));

  const amount = ethers.parseEther("100000"); // 100K tokens
  console.log("📦 Minting tokens...");
  await (await token0.mint(deployer.address, amount)).wait();
  await (await token1.mint(deployer.address, amount)).wait();
  console.log(`✅ Minted ${ethers.formatEther(amount)} of each token`);

  console.log("\n📦 Approving NFPM...");
  await (await token0.approve(nfpmAddress, ethers.MaxUint256)).wait();
  await (await token1.approve(nfpmAddress, ethers.MaxUint256)).wait();
  console.log("✅ Approved NFPM to spend tokens");

  // Add liquidity using NFPM
  console.log("\nSTEP 5: Add Liquidity via NFPM");
  console.log("-".repeat(60));

  const nfpmAbi = [
    "function mint(tuple(address token0, address token1, address deployer, int24 tickLower, int24 tickUpper, uint256 amount0Desired, uint256 amount1Desired, uint256 amount0Min, uint256 amount1Min, address recipient, uint256 deadline) params) external payable returns (uint256 tokenId, uint128 liquidity, uint256 amount0, uint256 amount1)"
  ];
  const nfpm = new ethers.Contract(nfpmAddress, nfpmAbi, deployer);

  // Use a reasonable tick range (not full range to save gas)
  const tickSpacing = 60; // Default for Algebra
  const tickRange = 100000;
  const tickLower = Math.floor(-tickRange / tickSpacing) * tickSpacing;
  const tickUpper = Math.floor(tickRange / tickSpacing) * tickSpacing;

  const mintParams = {
    token0: token0Address,
    token1: token1Address,
    deployer: poolDeployerAddress,
    tickLower: tickLower,
    tickUpper: tickUpper,
    amount0Desired: ethers.parseEther("10000"),
    amount1Desired: ethers.parseEther("10000"),
    amount0Min: 0,
    amount1Min: 0,
    recipient: deployer.address,
    deadline: Math.floor(Date.now() / 1000) + 3600
  };

  console.log(`📦 Adding liquidity with params:`);
  console.log(`   Tick range: [${tickLower}, ${tickUpper}]`);
  console.log(`   Amount0: ${ethers.formatEther(mintParams.amount0Desired)}`);
  console.log(`   Amount1: ${ethers.formatEther(mintParams.amount1Desired)}`);

  try {
    // Try with explicit gas limit
    console.log("\n🔄 Sending mint transaction...");
    const mintTx = await nfpm.mint(mintParams, {
      gasLimit: 5000000 // 5M gas
    });
    
    console.log("⏳ Waiting for confirmation...");
    const receipt = await mintTx.wait();
    console.log(`✅ Liquidity added! Tx: ${receipt.hash}`);

    // Try to find the tokenId from events
    const transferEvents = receipt.logs.filter(
      log => log.topics[0] === ethers.id("Transfer(address,address,uint256)")
    );
    
    if (transferEvents.length > 0) {
      const tokenId = ethers.toBigInt(transferEvents[transferEvents.length - 1].topics[3]);
      console.log(`✅ NFT Position ID: ${tokenId}`);
    }

    // Save results
    const result = {
      network: network.name,
      chainId: Number(network.chainId),
      deployer: deployer.address,
      tokens: {
        token0: { address: token0Address, symbol: await token0.symbol() },
        token1: { address: token1Address, symbol: await token1.symbol() }
      },
      pool: poolAddress,
      mintTx: receipt.hash,
      timestamp: new Date().toISOString()
    };

    const outputFile = path.join(__dirname, "../deployments/test-pool-sdk-result.json");
    fs.writeFileSync(outputFile, JSON.stringify(result, null, 2));
    console.log(`\n💾 Results saved to: deployments/test-pool-sdk-result.json`);

    console.log("\n╔════════════════════════════════════════════════════════════╗");
    console.log("║              TEST POOL SUCCESS! 🎉                          ║");
    console.log("╚════════════════════════════════════════════════════════════╝");
    console.log(`\n📍 Pool Address: ${poolAddress}`);
    console.log(`📍 Token0: ${token0Address}`);
    console.log(`📍 Token1: ${token1Address}`);

  } catch (error) {
    console.error("\n❌ Mint failed!");
    console.error("Error:", error.message);

    // Alternative: Direct pool interaction
    console.log("\n⚠️  Attempting alternative approach: Direct pool mint...");
    
    const poolMintAbi = [
      "function mint(address sender, address recipient, int24 bottomTick, int24 topTick, uint128 liquidityDesired, bytes calldata data) external returns (uint256 amount0, uint256 amount1, uint128 liquidityActual)"
    ];
    const poolForMint = new ethers.Contract(poolAddress, poolMintAbi, deployer);

    try {
      // Calculate liquidity amount (simplified)
      const liquidityAmount = ethers.parseUnits("10000", 18);
      
      const directMintTx = await poolForMint.mint(
        deployer.address,
        deployer.address,
        tickLower,
        tickUpper,
        liquidityAmount,
        "0x",
        { gasLimit: 5000000 }
      );
      
      const directReceipt = await directMintTx.wait();
      console.log(`✅ Direct pool mint successful! Tx: ${directReceipt.hash}`);
      
    } catch (directError) {
      console.error("❌ Direct pool mint also failed:", directError.message);
      console.log("\n💡 Recommendation: Use a frontend interface or Algebra's official UI");
      throw error;
    }
  }
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



