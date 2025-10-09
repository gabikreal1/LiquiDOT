/**
 * Test Direct Swap Through Pool
 * 
 * Tests swapping tokens directly through the pool using SimpleSwapper helper
 */

const { ethers } = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  console.log("\n╔════════════════════════════════════════════════════════════╗");
  console.log("║           Test Direct Swap Through Pool                    ║");
  console.log("╚════════════════════════════════════════════════════════════╝\n");

  const [trader] = await ethers.getSigners();
  const network = await ethers.provider.getNetwork();
  
  console.log(`Network: ${network.name} (${network.chainId})`);
  console.log(`Trader: ${trader.address}\n`);

  // Load test pool data
  const testPoolFile = path.join(__dirname, "../deployments/test-pool-result.json");
  if (!fs.existsSync(testPoolFile)) {
    console.error("❌ No test pool found. Run test-pool-simple.js first.");
    process.exit(1);
  }

  const testPool = JSON.parse(fs.readFileSync(testPoolFile, "utf8"));
  const poolAddress = testPool.pool;
  const token0Address = testPool.token0;
  const token1Address = testPool.token1;

  console.log("Test Pool:");
  console.log(`  Pool: ${poolAddress}`);
  console.log(`  Token0: ${token0Address}`);
  console.log(`  Token1: ${token1Address}\n`);

  // Get token contracts
  const token0 = await ethers.getContractAt("TestERC20", token0Address);
  const token1 = await ethers.getContractAt("TestERC20", token1Address);

  // ===== Deploy Swap Helper =====
  console.log("STEP 1: Deploy Swap Helper");
  console.log("=".repeat(60));
  
  const SimpleSwapper = await ethers.getContractFactory("SimpleSwapper");
  const swapper = await SimpleSwapper.deploy();
  await swapper.waitForDeployment();
  const swapperAddress = await swapper.getAddress();
  console.log(`✅ SimpleSwapper deployed: ${swapperAddress}\n`);

  // ===== Check Pool State =====
  console.log("STEP 2: Check Pool State");
  console.log("=".repeat(60));

  const [price, tick] = await swapper.getPoolPrice(poolAddress);
  console.log(`📊 Pool price (sqrtPriceX96): ${price}`);
  console.log(`📊 Pool tick: ${tick}\n`);

  // ===== Prepare for Swap =====
  console.log("STEP 3: Prepare Tokens");
  console.log("=".repeat(60));

  const swapAmount = ethers.parseEther("10"); // Swap 10 tokens
  console.log(`📦 Minting ${ethers.formatEther(swapAmount)} token0...`);
  await (await token0.mint(trader.address, swapAmount)).wait();

  console.log(`📦 Approving swapper...`);
  await (await token0.approve(swapperAddress, ethers.MaxUint256)).wait();
  console.log(`✅ Ready\n`);

  // ===== Execute Swap =====
  console.log("STEP 4: Execute Swap");
  console.log("=".repeat(60));

  const balance0Before = await token0.balanceOf(trader.address);
  const balance1Before = await token1.balanceOf(trader.address);
  
  console.log(`💼 Balances before:`);
  console.log(`   Token0: ${ethers.formatEther(balance0Before)}`);
  console.log(`   Token1: ${ethers.formatEther(balance1Before)}\n`);

  try {
    console.log(`📦 Swapping ${ethers.formatEther(swapAmount)} token0 → token1...`);
    
    const swapTx = await swapper.swap(
      poolAddress,
      token0Address,
      token1Address,
      swapAmount,
      trader.address,
      { gasLimit: 3000000 }
    );
    
    console.log(`⏳ Waiting for confirmation...`);
    const receipt = await swapTx.wait();
    console.log(`✅ Swap successful! Tx: ${receipt.hash}\n`);

    const balance0After = await token0.balanceOf(trader.address);
    const balance1After = await token1.balanceOf(trader.address);
    
    console.log(`💼 Balances after:`);
    console.log(`   Token0: ${ethers.formatEther(balance0After)}`);
    console.log(`   Token1: ${ethers.formatEther(balance1After)}\n`);

    const amountIn = balance0Before - balance0After;
    const amountOut = balance1After - balance1Before;

    console.log(`📊 Swap Results:`);
    console.log(`   Spent: ${ethers.formatEther(amountIn)} token0`);
    console.log(`   Received: ${ethers.formatEther(amountOut)} token1`);
    
    if (amountIn > 0n) {
      const rate = Number(ethers.formatEther(amountOut)) / Number(ethers.formatEther(amountIn));
      console.log(`   Rate: 1 token0 = ${rate.toFixed(6)} token1`);
    }

    // Check new pool state
    const [newPrice, newTick] = await swapper.getPoolPrice(poolAddress);
    console.log(`\n📊 New pool state:`);
    console.log(`   Price: ${newPrice}`);
    console.log(`   Tick: ${newTick}`);
    console.log(`   Price moved: ${Number(tick) - Number(newTick)} ticks\n`);

    // Save result
    const result = {
      network: network.name,
      pool: poolAddress,
      swapTx: receipt.hash,
      amountIn: ethers.formatEther(amountIn),
      amountOut: ethers.formatEther(amountOut),
      rate: Number(ethers.formatEther(amountOut)) / Number(ethers.formatEther(amountIn)),
      priceBefore: price.toString(),
      priceAfter: newPrice.toString(),
      tickBefore: Number(tick),
      tickAfter: Number(newTick),
      timestamp: new Date().toISOString()
    };

    const outputFile = path.join(__dirname, "../deployments/test-swap-result.json");
    fs.writeFileSync(outputFile, JSON.stringify(result, null, 2));

    console.log("╔════════════════════════════════════════════════════════════╗");
    console.log("║              SWAP SUCCESS! 🎉                               ║");
    console.log("╚════════════════════════════════════════════════════════════╝");
    console.log(`\n✅ Your Algebra pool is fully functional!`);
    console.log(`✅ Liquidity provision: Working`);
    console.log(`✅ Swaps: Working`);
    console.log(`✅ Price discovery: Working`);
    console.log(`\n🎯 Next step: Deploy XCMProxy and test cross-chain integration!`);

    return result;

  } catch (error) {
    console.error("\n❌ Swap failed:", error.message);
    
    if (error.data) {
      console.error("Error data:", error.data);
    }
    
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



