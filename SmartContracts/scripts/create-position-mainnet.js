/**
 * Create Position on Moonbeam — Full End-to-End
 *
 * 1. Configure DEX addresses on XCMProxy (setIntegrations + setNFPM) if needed
 * 2. Fetch live pool data (xcDOT/WGLMR)
 * 3. Call receiveAssets() with proper params
 * 4. Call executePendingInvestment() to mint LP
 *
 * Usage:
 *   npx hardhat run scripts/create-position-mainnet.js --network moonbeam
 */

const { ethers } = require("hardhat");
const fs = require("fs");
const path = require("path");

// ─── Addresses ──────────────────────────────────────────────
const XCMPROXY = "0x0cfb7CE7D66C7CdAe5827074C5f5A62223a0c230";

// Algebra Integral (StellaSwap Pulsar) on Moonbeam
const NFPM = "0x26c48519bBCf6df3E39d4C724ff82B6F060D3Bbe";
const ROUTER = "0x217fd038FF2ac580de8E635a5d726f6f0E5214e3";
const QUOTER = "0x8f55D600eD3f79fB300beac0400C44C8cC6eb728";

// Tokens
const xcDOT = "0xFfFFfFff1FcaCBd218EDc0EbA20Fc2308C778080";
const WGLMR = "0xAcc15dC74880C9944775448304B263D191c6077F";

// xcDOT/WGLMR pool on StellaSwap Pulsar (Algebra Integral V2 — from factory)
// Note: 0xB13B28... is the V1 pool (incompatible ABI), 0xc295aa... is the V2 pool
const POOL = "0xc295aa4287127C5776Ad7031648692659eF2ceBB";

// ─── ABIs ───────────────────────────────────────────────────
const ERC20_ABI = [
  "function balanceOf(address) view returns (uint256)",
  "function decimals() view returns (uint8)",
  "function symbol() view returns (string)",
];

const POOL_ABI = [
  "function token0() view returns (address)",
  "function token1() view returns (address)",
  "function globalState() view returns (uint160 price, int24 tick, uint16 fee, uint8 pluginConfig, uint16 communityFee, bool unlocked)",
  "function tickSpacing() view returns (int24)",
  "function liquidity() view returns (uint128)",
];

const PROXY_ABI = [
  // Config getters
  "function quoterContract() view returns (address)",
  "function swapRouterContract() view returns (address)",
  "function nfpmContract() view returns (address)",
  "function operator() view returns (address)",
  "function owner() view returns (address)",
  "function positionCounter() view returns (uint256)",
  "function testMode() view returns (bool)",
  "function paused() view returns (bool)",
  "function defaultSlippageBps() view returns (uint16)",
  "function supportedTokens(address) view returns (bool)",
  "function pendingPositions(bytes32) view returns (bytes32,address,address,uint256,address,address,int24,int24,uint16,uint256,bool)",
  "function positions(uint256) view returns (bytes32,address,address,address,int24,int24,uint128,uint256,address,int24,int24,uint256,uint256,uint8,uint256,uint256)",
  // Config setters
  "function setIntegrations(address quoter, address router)",
  "function setNFPM(address nfpm)",
  "function setDefaultSlippageBps(uint16 bps)",
  // Operations
  "function receiveAssets(bytes32 assetHubPositionId, address token, address user, uint256 amount, bytes investmentParams)",
  "function executePendingInvestment(bytes32 assetHubPositionId) returns (uint256)",
  "function cancelPendingPosition(bytes32 assetHubPositionId, bytes destination)",
  // Views
  "function getBalance(address token) view returns (uint256)",
];

async function main() {
  const [signer] = await ethers.getSigners();
  console.log("══════════════════════════════════════════════════════");
  console.log("  CREATE LP POSITION — Moonbeam Mainnet");
  console.log("══════════════════════════════════════════════════════\n");
  console.log("Signer:", signer.address);

  const proxy = new ethers.Contract(XCMPROXY, PROXY_ABI, signer);
  const pool = new ethers.Contract(POOL, POOL_ABI, signer.provider);
  const xcDotToken = new ethers.Contract(xcDOT, ERC20_ABI, signer.provider);
  const wglmrToken = new ethers.Contract(WGLMR, ERC20_ABI, signer.provider);

  // ═════════════════════════════════════════════════════════
  //  STEP 1: Check & Configure DEX Addresses
  // ═════════════════════════════════════════════════════════
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("  STEP 1: Check & Configure XCMProxy");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

  const [currentQuoter, currentRouter, currentNfpm, owner, operator, paused, testMode, slippageBps] =
    await Promise.all([
      proxy.quoterContract(),
      proxy.swapRouterContract(),
      proxy.nfpmContract(),
      proxy.owner(),
      proxy.operator(),
      proxy.paused(),
      proxy.testMode(),
      proxy.defaultSlippageBps(),
    ]);

  console.log("  Owner:", owner);
  console.log("  Operator:", operator);
  console.log("  Paused:", paused);
  console.log("  Test mode:", testMode);
  console.log("  Slippage BPS:", slippageBps.toString());
  console.log("  Quoter:", currentQuoter);
  console.log("  Router:", currentRouter);
  console.log("  NFPM:", currentNfpm);

  // Verify we're the owner
  if (owner.toLowerCase() !== signer.address.toLowerCase()) {
    console.error(`\n❌ Signer ${signer.address} is not the owner (${owner})`);
    process.exit(1);
  }

  // Configure integrations if needed
  const ZERO = "0x0000000000000000000000000000000000000000";
  let configChanged = false;

  if (currentQuoter === ZERO || currentRouter === ZERO) {
    console.log("\n  Setting integrations (Quoter + Router)...");
    const tx = await proxy.setIntegrations(QUOTER, ROUTER);
    console.log("  TX:", tx.hash);
    await tx.wait();
    console.log("  ✅ Integrations set!");
    configChanged = true;
  } else {
    console.log("\n  ✅ Integrations already configured");
  }

  if (currentNfpm === ZERO) {
    console.log("  Setting NFPM...");
    const tx = await proxy.setNFPM(NFPM);
    console.log("  TX:", tx.hash);
    await tx.wait();
    console.log("  ✅ NFPM set!");
    configChanged = true;
  } else {
    console.log("  ✅ NFPM already configured");
  }

  // Set default slippage if not set (500 = 5%)
  if (Number(slippageBps) === 0) {
    console.log("  Setting default slippage to 500 BPS (5%)...");
    const tx = await proxy.setDefaultSlippageBps(500);
    await tx.wait();
    console.log("  ✅ Slippage set!");
    configChanged = true;
  }

  if (configChanged) {
    console.log("\n  Re-reading config...");
    const [q, r, n] = await Promise.all([
      proxy.quoterContract(),
      proxy.swapRouterContract(),
      proxy.nfpmContract(),
    ]);
    console.log("  Quoter:", q);
    console.log("  Router:", r);
    console.log("  NFPM:", n);
  }

  // ═════════════════════════════════════════════════════════
  //  STEP 2: Fetch Live Pool Data
  // ═════════════════════════════════════════════════════════
  console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("  STEP 2: Live Pool Data (xcDOT/WGLMR)");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

  const [token0, token1, globalState, tickSpacing, poolLiquidity] = await Promise.all([
    pool.token0(),
    pool.token1(),
    pool.globalState(),
    pool.tickSpacing(),
    pool.liquidity(),
  ]);

  const currentTick = Number(globalState.tick);
  const sqrtPriceX96 = globalState.price;
  const fee = Number(globalState.fee);

  // Calculate price from sqrtPriceX96
  // price = (sqrtPriceX96 / 2^96)^2
  // token1/token0 price = price * 10^(decimals0 - decimals1)
  const priceRaw = Number(sqrtPriceX96) ** 2 / (2 ** 192);
  // token0 = WGLMR (18 dec), token1 = xcDOT (10 dec)
  const priceAdjusted = priceRaw * 10 ** (18 - 10); // price in WGLMR per xcDOT

  console.log("  Pool:", POOL);
  console.log("  Token0:", token0, "(WGLMR)");
  console.log("  Token1:", token1, "(xcDOT)");
  console.log("  Current tick:", currentTick);
  console.log("  Tick spacing:", Number(tickSpacing));
  console.log("  Fee:", fee, "/ 1M");
  console.log("  sqrtPriceX96:", sqrtPriceX96.toString());
  console.log("  Price: 1 xcDOT ≈", priceAdjusted.toFixed(4), "WGLMR");
  console.log("  Pool liquidity:", poolLiquidity.toString());

  // ═════════════════════════════════════════════════════════
  //  STEP 3: Check Contract Balances
  // ═════════════════════════════════════════════════════════
  console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("  STEP 3: Contract Balances");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

  const [xcDotBal, wglmrBal, glmrBal] = await Promise.all([
    xcDotToken.balanceOf(XCMPROXY),
    wglmrToken.balanceOf(XCMPROXY),
    signer.provider.getBalance(XCMPROXY),
  ]);

  console.log("  xcDOT:", ethers.formatUnits(xcDotBal, 10), "DOT");
  console.log("  WGLMR:", ethers.formatUnits(wglmrBal, 18), "WGLMR");
  console.log("  GLMR (native):", ethers.formatEther(glmrBal), "GLMR");

  if (xcDotBal === 0n) {
    console.error("\n❌ XCMProxy has no xcDOT! Transfer some first via dispatch-mainnet.js");
    process.exit(1);
  }

  // Use most of the xcDOT balance (leave a tiny buffer)
  const BUFFER = 100000n; // 0.00001 DOT buffer
  const useAmount = xcDotBal - BUFFER;
  console.log("\n  Will use:", ethers.formatUnits(useAmount, 10), "xcDOT for position");

  // ═════════════════════════════════════════════════════════
  //  STEP 4: Call receiveAssets() with Proper Params
  // ═════════════════════════════════════════════════════════
  console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("  STEP 4: receiveAssets() — Register Pending Position");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

  const positionId = ethers.hexlify(ethers.randomBytes(32));
  console.log("  Position ID:", positionId);

  // Investment params: (poolId, baseAsset, amounts[], lowerRangePercent, upperRangePercent, positionOwner, slippageBps)
  //
  // IMPORTANT: Using out-of-range single-sided position strategy.
  // Range is set BELOW current price (-10% to -2%) so currentTick > topTick,
  // meaning only token1 (xcDOT) is needed — no swap required.
  //
  // NOTE: _splitForDualSided has a bug (InsufficientSwappedFunding) for in-range positions.
  // When that's fixed, can use in-range positions with empty amounts [].
  const investmentParams = ethers.AbiCoder.defaultAbiCoder().encode(
    ["address", "address", "uint256[]", "int24", "int24", "address", "uint16"],
    [
      POOL,                  // poolId — Algebra V2 xcDOT/WGLMR pool
      xcDOT,                 // baseAsset
      [0n, useAmount],       // amounts — [token0=0, token1=full] single-sided xcDOT
      -100000,               // lowerRangePercent — -10% from current price
      -20000,                // upperRangePercent — -2% from current price
      signer.address,        // positionOwner
      500,                   // slippageBps — 5%
    ]
  );

  console.log("  Pool:", POOL);
  console.log("  Base asset: xcDOT (single-sided, no swap)");
  console.log("  Range: -10% to -2% (below current price)");
  console.log("  Slippage: 5%");

  // Simulate first
  console.log("\n  Simulating receiveAssets()...");
  try {
    await proxy.receiveAssets.staticCall(
      positionId,
      xcDOT,
      signer.address,
      useAmount,
      investmentParams
    );
    console.log("  ✅ Simulation passed");
  } catch (e) {
    console.error("  ❌ Simulation failed:", e.reason || e.message?.substring(0, 300));
    process.exit(1);
  }

  // Send real tx
  console.log("  Sending receiveAssets() tx...");
  const tx1 = await proxy.receiveAssets(
    positionId,
    xcDOT,
    signer.address,
    useAmount,
    investmentParams
  );
  console.log("  TX:", tx1.hash);
  const receipt1 = await tx1.wait();
  console.log("  Block:", receipt1.blockNumber);
  console.log("  Gas used:", receipt1.gasUsed.toString());
  console.log("  ✅ Pending position created!");

  // Verify it was stored
  const pending = await proxy.pendingPositions(positionId);
  console.log("  Pending exists:", pending[10]); // exists field is the 11th

  // ═════════════════════════════════════════════════════════
  //  STEP 5: executePendingInvestment() — Mint LP
  // ═════════════════════════════════════════════════════════
  console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("  STEP 5: executePendingInvestment() — Mint LP Position");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

  // Simulate first
  console.log("  Simulating executePendingInvestment()...");
  try {
    const localId = await proxy.executePendingInvestment.staticCall(positionId);
    console.log("  ✅ Simulation passed, would create localPositionId:", localId.toString());
  } catch (e) {
    console.error("  ❌ Simulation failed:", e.reason || e.message?.substring(0, 500));
    console.log("\n  The pending position is stored. Debug and retry manually.");
    console.log("  Position ID:", positionId);
    process.exit(1);
  }

  // Send real tx
  console.log("  Sending executePendingInvestment() tx...");
  const tx2 = await proxy.executePendingInvestment(positionId, { gasLimit: 2000000n });
  console.log("  TX:", tx2.hash);
  const receipt2 = await tx2.wait();
  console.log("  Block:", receipt2.blockNumber);
  console.log("  Gas used:", receipt2.gasUsed.toString());
  console.log("  Status:", receipt2.status === 1 ? "✅ SUCCESS" : "❌ REVERTED");

  // Parse events
  if (receipt2.logs.length > 0) {
    console.log("\n  Events:");
    const proxyIface = new ethers.Interface([
      "event AssetsReceived(address indexed token, address indexed user, uint256 amount, bytes investmentParams)",
      "event PendingPositionCreated(bytes32 indexed assetHubPositionId, address indexed user, address token, uint256 amount, address poolId)",
      "event PositionExecuted(bytes32 indexed assetHubPositionId, uint256 indexed localPositionId, uint256 nfpmTokenId, uint128 liquidity)",
      "event PositionCreated(uint256 indexed positionId, address indexed user, address pool, address token0, address token1, int24 bottomTick, int24 topTick, uint128 liquidity)",
      "event ProceedsSwapped(address indexed tokenIn, address indexed tokenOut, uint256 amountIn, uint256 amountOut, uint256 positionId)",
    ]);

    for (const log of receipt2.logs) {
      try {
        const parsed = proxyIface.parseLog({ topics: log.topics, data: log.data });
        if (parsed) {
          console.log(`    ${parsed.name}:`);
          for (const [key, val] of Object.entries(parsed.args)) {
            if (isNaN(Number(key))) {
              console.log(`      ${key}: ${val}`);
            }
          }
        }
      } catch {
        console.log(`    Raw: ${log.address} topic0=${log.topics[0]?.substring(0, 18)}...`);
      }
    }
  }

  // ═════════════════════════════════════════════════════════
  //  STEP 6: Verify Position
  // ═════════════════════════════════════════════════════════
  console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("  STEP 6: Verify Position");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

  const newCounter = await proxy.positionCounter();
  console.log("  Position counter:", newCounter.toString());

  // Read position data
  try {
    const pos = await proxy.positions(newCounter);
    console.log("  Position", newCounter.toString(), ":");
    console.log("    AssetHub ID:", pos[0]);
    console.log("    Pool:", pos[1]);
    console.log("    Token0:", pos[2]);
    console.log("    Token1:", pos[3]);
    console.log("    Bottom tick:", Number(pos[4]));
    console.log("    Top tick:", Number(pos[5]));
    console.log("    Liquidity:", pos[6].toString());
    console.log("    NFPM Token ID:", pos[7].toString());
    console.log("    Owner:", pos[8]);
    console.log("    Status:", Number(pos[13]) === 0 ? "Active" : Number(pos[13]) === 1 ? "Liquidated" : "Returned");
  } catch (e) {
    console.log("  Could not read position:", e.message?.substring(0, 200));
  }

  // Final balances
  const [xcDotAfter, wglmrAfter] = await Promise.all([
    xcDotToken.balanceOf(XCMPROXY),
    wglmrToken.balanceOf(XCMPROXY),
  ]);
  console.log("\n  Final balances:");
  console.log("    xcDOT:", ethers.formatUnits(xcDotAfter, 10), "(was", ethers.formatUnits(xcDotBal, 10), ")");
  console.log("    WGLMR:", ethers.formatUnits(wglmrAfter, 18), "(was", ethers.formatUnits(wglmrBal, 18), ")");

  console.log("\n══════════════════════════════════════════════════════");
  console.log("  ✅ DONE — LP Position Created on Moonbeam!");
  console.log("══════════════════════════════════════════════════════\n");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("\n❌ Fatal:", error.message || error);
    process.exit(1);
  });
