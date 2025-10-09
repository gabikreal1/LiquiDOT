/**
 * Simplified Pool Test - Multiple Approaches
 * 
 * Tries different methods to add liquidity to an Algebra pool
 */

const { ethers } = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  console.log("\n╔════════════════════════════════════════════════════════════╗");
  console.log("║           Simplified Pool Test                             ║");
  console.log("╚════════════════════════════════════════════════════════════╝\n");

  const [deployer] = await ethers.getSigners();
  const network = await ethers.provider.getNetwork();
  
  console.log(`Network: ${network.name} (${network.chainId})`);
  console.log(`Deployer: ${deployer.address}`);
  console.log(`Balance: ${ethers.formatEther(await ethers.provider.getBalance(deployer.address))} DEV\n`);

  // Load deployment
  const deploymentFile = path.join(__dirname, `../deployments/${network.name}_algebra.json`);
  const deployment = JSON.parse(fs.readFileSync(deploymentFile, "utf8"));
  
  const factoryAddress = deployment.contracts.factory;
  const routerAddress = deployment.contracts.router;
  const poolDeployerAddress = deployment.contracts.poolDeployer;

  console.log("Using Contracts:");
  console.log(`  Factory: ${factoryAddress}`);
  console.log(`  Router: ${routerAddress}`);
  console.log(`  PoolDeployer: ${poolDeployerAddress}\n`);

  // ===== STEP 1: Deploy Tokens =====
  console.log("STEP 1: Deploy Test Tokens");
  console.log("=".repeat(60));
  
  const TestERC20 = await ethers.getContractFactory("TestERC20");
  
  const usdc = await TestERC20.deploy("Test USDC", "USDC");
  await usdc.waitForDeployment();
  const usdcAddress = await usdc.getAddress();
  console.log(`✅ USDC: ${usdcAddress}`);

  const usdt = await TestERC20.deploy("Test USDT", "USDT");
  await usdt.waitForDeployment();
  const usdtAddress = await usdt.getAddress();
  console.log(`✅ USDT: ${usdtAddress}`);

  // Sort tokens
  const [token0Address, token1Address] = usdcAddress.toLowerCase() < usdtAddress.toLowerCase()
    ? [usdcAddress, usdtAddress]
    : [usdtAddress, usdcAddress];
  
  const token0 = token0Address === usdcAddress ? usdc : usdt;
  const token1 = token1Address === usdcAddress ? usdc : usdt;

  console.log(`\nSorted: token0=${token0Address.slice(0,10)}... < token1=${token1Address.slice(0,10)}...`);

  // ===== STEP 2: Create & Initialize Pool =====
  console.log("\nSTEP 2: Create & Initialize Pool");
  console.log("=".repeat(60));

  const factory = await ethers.getContractAt(
    ["function createPool(address,address,bytes) external returns (address)",
     "function poolByPair(address,address) external view returns (address)"],
    factoryAddress
  );

  console.log("📦 Creating pool...");
  const createTx = await factory.createPool(token0Address, token1Address, "0x");
  await createTx.wait();

  const poolAddress = await factory.poolByPair(token0Address, token1Address);
  console.log(`✅ Pool: ${poolAddress}`);

  const pool = await ethers.getContractAt(
    ["function initialize(uint160) external",
     "function globalState() external view returns (uint160,int24,uint16,uint8,uint16,bool)",
     "function mint(address,address,int24,int24,uint128,bytes) external returns (uint256,uint256,uint128)"],
    poolAddress
  );

  console.log("📦 Initializing at 1:1 price...");
  const sqrtPrice = BigInt("79228162514264337593543950336");
  await (await pool.initialize(sqrtPrice)).wait();
  
  const state = await pool.globalState();
  console.log(`✅ Initialized at tick ${state[1]}`);

  // ===== STEP 3: Deploy Liquidity Helper & Add Liquidity =====
  console.log("\nSTEP 3: Add Liquidity via Helper Contract");
  console.log("=".repeat(60));

  // Deploy SimpleLiquidityProvider helper
  console.log("📦 Deploying liquidity helper contract...");
  const SimpleLiquidityProvider = await ethers.getContractFactory("SimpleLiquidityProvider");
  const liquidityHelper = await SimpleLiquidityProvider.deploy();
  await liquidityHelper.waitForDeployment();
  const helperAddress = await liquidityHelper.getAddress();
  console.log(`✅ Helper deployed: ${helperAddress}`);

  const amount = ethers.parseEther("50000");
  console.log(`\n📦 Minting ${ethers.formatEther(amount)} tokens...`);
  await (await token0.mint(deployer.address, amount)).wait();
  await (await token1.mint(deployer.address, amount)).wait();

  console.log("📦 Approving liquidity helper...");
  await (await token0.approve(helperAddress, ethers.MaxUint256)).wait();
  await (await token1.approve(helperAddress, ethers.MaxUint256)).wait();

  // Use reasonable tick range
  const tickLower = -86400; // Roughly 1/2 to 2x price range
  const tickUpper = 86400;
  const liquidity = ethers.parseUnits("10000", 18);

  console.log(`\n📦 Adding liquidity via helper...`);
  console.log(`   Range: [${tickLower}, ${tickUpper}]`);
  console.log(`   Liquidity: ${ethers.formatUnits(liquidity, 18)}`);

  try {
    const addLiqTx = await liquidityHelper.addLiquidity(
      poolAddress,
      token0Address,
      token1Address,
      tickLower,
      tickUpper,
      liquidity,
      { gasLimit: 5000000 }
    );
    
    const receipt = await addLiqTx.wait();
    console.log(`✅ Liquidity added! Tx: ${receipt.hash}`);

    // Get amounts from logs
    console.log(`✅ Success! Pool now has liquidity.`);

    // Save result
    const result = {
      network: network.name,
      pool: poolAddress,
      token0: token0Address,
      token1: token1Address,
      tick0: token0Address === usdcAddress ? "USDC" : "USDT",
      tick1: token1Address === usdcAddress ? "USDC" : "USDT",
      txHash: receipt.hash,
      timestamp: new Date().toISOString()
    };

    const outputFile = path.join(__dirname, "../deployments/test-pool-result.json");
    fs.writeFileSync(outputFile, JSON.stringify(result, null, 2));

    console.log("\n╔════════════════════════════════════════════════════════════╗");
    console.log("║                  SUCCESS! 🎉                                ║");
    console.log("╚════════════════════════════════════════════════════════════╝");
    console.log(`\nPool Address: ${poolAddress}`);
    console.log(`Token0 (${result.tick0}): ${token0Address}`);
    console.log(`Token1 (${result.tick1}): ${token1Address}`);
    console.log(`\nYou can now test swaps with this pool!`);

    return result;

  } catch (error) {
    console.error("\n❌ Liquidity provision failed:", error.message);
    
    if (error.data) {
      console.error("Error data:", error.data);
    }

    console.log("\n💡 The pool is created and initialized.");
    console.log("   You can add liquidity via:");
    console.log("   1. A frontend interface");
    console.log("   2. Algebra's official UI");
    console.log("   3. Manual interaction with NFPM");
    
    throw error;
  }
}

if (require.main === module) {
  main()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error("\n❌ Test failed");
      process.exit(1);
    });
}

module.exports = { main };

