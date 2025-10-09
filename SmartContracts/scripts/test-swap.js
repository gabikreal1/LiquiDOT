/**
 * Test Swap Through Algebra Pool
 * 
 * Tests swapping tokens through a deployed Algebra pool
 */

const { ethers } = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  console.log("\n╔════════════════════════════════════════════════════════════╗");
  console.log("║              Test Swap Through Algebra Pool                ║");
  console.log("╚════════════════════════════════════════════════════════════╝\n");

  const [trader] = await ethers.getSigners();
  const network = await ethers.provider.getNetwork();
  
  console.log(`Network: ${network.name} (${network.chainId})`);
  console.log(`Trader: ${trader.address}`);
  console.log(`Balance: ${ethers.formatEther(await ethers.provider.getBalance(trader.address))} DEV\n`);

  // Load Algebra deployment
  const algebraDeploymentFile = path.join(__dirname, `../deployments/${network.name}_algebra.json`);
  const algebraDeployment = JSON.parse(fs.readFileSync(algebraDeploymentFile, "utf8"));
  
  const routerAddress = algebraDeployment.contracts.router;
  const quoterAddress = algebraDeployment.contracts.quoter;

  console.log("Algebra Contracts:");
  console.log(`  Router: ${routerAddress}`);
  console.log(`  Quoter: ${quoterAddress}\n`);

  // Check if we have a test pool result
  const testPoolFile = path.join(__dirname, "../deployments/test-pool-result.json");
  let poolAddress, token0Address, token1Address, token0, token1;

  if (fs.existsSync(testPoolFile)) {
    console.log("📋 Loading test pool data...");
    const testPool = JSON.parse(fs.readFileSync(testPoolFile, "utf8"));
    poolAddress = testPool.pool;
    token0Address = testPool.token0;
    token1Address = testPool.token1;
    console.log(`✅ Pool: ${poolAddress}`);
    console.log(`✅ Token0: ${token0Address}`);
    console.log(`✅ Token1: ${token1Address}\n`);

    // Get token contracts
    token0 = await ethers.getContractAt("TestERC20", token0Address);
    token1 = await ethers.getContractAt("TestERC20", token1Address);
  } else {
    console.error("❌ No test pool found. Run test-pool-simple.js first.");
    process.exit(1);
  }

  // ===== STEP 1: Prepare Tokens for Swap =====
  console.log("STEP 1: Prepare Tokens");
  console.log("=".repeat(60));

  const swapAmount = ethers.parseEther("100"); // Swap 100 tokens
  console.log(`📦 Minting ${ethers.formatEther(swapAmount)} token0 for swap...`);
  await (await token0.mint(trader.address, swapAmount)).wait();
  console.log(`✅ Minted`);

  console.log(`📦 Approving Router to spend token0...`);
  await (await token0.approve(routerAddress, ethers.MaxUint256)).wait();
  console.log(`✅ Approved\n`);

  // ===== STEP 2: Get Quote =====
  console.log("STEP 2: Get Swap Quote");
  console.log("=".repeat(60));

  const quoter = await ethers.getContractAt(
    [
      "function quoteExactInputSingle(tuple(address tokenIn, address tokenOut, uint256 amountIn, uint160 limitSqrtPrice) params) external returns (uint256 amountOut, uint16 fee)"
    ],
    quoterAddress
  );

  try {
    console.log(`📊 Querying quote for ${ethers.formatEther(swapAmount)} token0...`);
    const quoteParams = {
      tokenIn: token0Address,
      tokenOut: token1Address,
      amountIn: swapAmount,
      limitSqrtPrice: 0 // No price limit
    };
    
    const [amountOut, fee] = await quoter.quoteExactInputSingle.staticCall(quoteParams);
    console.log(`✅ Expected output: ${ethers.formatEther(amountOut)} token1`);
    console.log(`✅ Pool fee: ${fee / 100}%\n`);
  } catch (error) {
    console.log(`⚠️  Quote failed (pool might be empty): ${error.message}\n`);
  }

  // ===== STEP 3: Execute Swap =====
  console.log("STEP 3: Execute Swap");
  console.log("=".repeat(60));

  const router = await ethers.getContractAt(
    [
      "function exactInputSingle(tuple(address tokenIn, address tokenOut, address recipient, uint256 deadline, uint256 amountIn, uint256 amountOutMinimum, uint160 limitSqrtPrice) params) external payable returns (uint256 amountOut)"
    ],
    routerAddress
  );

  const balanceBefore0 = await token0.balanceOf(trader.address);
  const balanceBefore1 = await token1.balanceOf(trader.address);
  
  console.log(`💼 Balances before swap:`);
  console.log(`   Token0: ${ethers.formatEther(balanceBefore0)}`);
  console.log(`   Token1: ${ethers.formatEther(balanceBefore1)}\n`);

  try {
    console.log(`📦 Executing swap: ${ethers.formatEther(swapAmount)} token0 → token1...`);
    
    const swapParams = {
      tokenIn: token0Address,
      tokenOut: token1Address,
      recipient: trader.address,
      deadline: Math.floor(Date.now() / 1000) + 3600, // 1 hour
      amountIn: swapAmount,
      amountOutMinimum: 0, // Accept any amount (for testing)
      limitSqrtPrice: 0 // No price limit
    };

    const swapTx = await router.exactInputSingle(swapParams, {
      gasLimit: 3000000
    });
    
    console.log(`⏳ Waiting for confirmation...`);
    const receipt = await swapTx.wait();
    console.log(`✅ Swap successful! Tx: ${receipt.hash}\n`);

    const balanceAfter0 = await token0.balanceOf(trader.address);
    const balanceAfter1 = await token1.balanceOf(trader.address);
    
    console.log(`💼 Balances after swap:`);
    console.log(`   Token0: ${ethers.formatEther(balanceAfter0)}`);
    console.log(`   Token1: ${ethers.formatEther(balanceAfter1)}\n`);

    const actualAmountIn = balanceBefore0 - balanceAfter0;
    const actualAmountOut = balanceAfter1 - balanceBefore1;

    console.log(`📊 Swap Results:`);
    console.log(`   Spent: ${ethers.formatEther(actualAmountIn)} token0`);
    console.log(`   Received: ${ethers.formatEther(actualAmountOut)} token1`);
    console.log(`   Effective Rate: 1 token0 = ${(Number(actualAmountOut) / Number(actualAmountIn)).toFixed(6)} token1\n`);

    // Save result
    const result = {
      network: network.name,
      pool: poolAddress,
      swapTx: receipt.hash,
      amountIn: ethers.formatEther(actualAmountIn),
      amountOut: ethers.formatEther(actualAmountOut),
      rate: Number(actualAmountOut) / Number(actualAmountIn),
      timestamp: new Date().toISOString()
    };

    const outputFile = path.join(__dirname, "../deployments/test-swap-result.json");
    fs.writeFileSync(outputFile, JSON.stringify(result, null, 2));

    console.log("╔════════════════════════════════════════════════════════════╗");
    console.log("║                  SWAP SUCCESS! 🎉                           ║");
    console.log("╚════════════════════════════════════════════════════════════╝");
    console.log(`\n✅ Your Algebra DEX is fully functional!`);
    console.log(`✅ Pool: ${poolAddress}`);
    console.log(`✅ Router: ${routerAddress}`);
    console.log(`\n🎯 Next: Test XCMProxy integration for cross-chain swaps!`);

    return result;

  } catch (error) {
    console.error("\n❌ Swap failed:", error.message);
    
    if (error.data) {
      console.error("Error data:", error.data);
    }

    // Check if pool has liquidity
    const pool = await ethers.getContractAt(
      ["function liquidity() external view returns (uint128)"],
      poolAddress
    );
    
    try {
      const liquidity = await pool.liquidity();
      console.log(`\n📊 Pool liquidity: ${liquidity.toString()}`);
      if (liquidity === 0n) {
        console.log("⚠️  Pool has no liquidity! Run test-pool-simple.js to add liquidity first.");
      }
    } catch (e) {
      console.log("⚠️  Could not check pool liquidity");
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



