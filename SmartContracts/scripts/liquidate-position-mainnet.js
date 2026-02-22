/**
 * Liquidate Position on Moonbeam — Full End-to-End
 *
 * Phase 1: executeFullLiquidation() — remove NFPM liquidity
 * Phase 2: returnAssets() — send tokens back to Asset Hub via XTokens
 *
 * NOTE: Using executeFullLiquidation + returnAssets instead of liquidateSwapAndReturn
 * because the deployed contract has a double-counting bug in _liquidatePosition
 * (fixed in source but not yet redeployed). returnAssets uses actual ERC20 balances
 * instead of the buggy stored liquidatedAmount0/1.
 *
 * Usage:
 *   npx hardhat run scripts/liquidate-position-mainnet.js --network moonbeam
 */

const { ethers } = require("hardhat");

// ─── Addresses ──────────────────────────────────────────────
const XCMPROXY = "0x0cfb7CE7D66C7CdAe5827074C5f5A62223a0c230";

// Tokens
const xcDOT = "0xFfFFfFff1FcaCBd218EDc0EbA20Fc2308C778080";
const WGLMR = "0xAcc15dC74880C9944775448304B263D191c6077F";

// Asset Hub parachain ID
const ASSET_HUB_PARA_ID = 1000;

// Position to liquidate
const POSITION_ID = 1;

// ─── ABIs ───────────────────────────────────────────────────
const ERC20_ABI = [
  "function balanceOf(address) view returns (uint256)",
  "function decimals() view returns (uint8)",
  "function symbol() view returns (string)",
];

const PROXY_ABI = [
  // Config getters
  "function owner() view returns (address)",
  "function operator() view returns (address)",
  "function positionCounter() view returns (uint256)",
  "function testMode() view returns (bool)",
  "function paused() view returns (bool)",
  "function xcmPrecompile() view returns (address)",
  "function positions(uint256) view returns (bytes32,address,address,address,int24,int24,uint128,uint256,address,int24,int24,uint256,uint256,uint8,uint256,uint256)",
  // Liquidation
  "function executeFullLiquidation(uint256 positionId) returns (uint256, uint256)",
  "function isPositionOutOfRange(uint256 positionId) view returns (bool, uint256)",
  // Return assets (owner-only, uses actual ERC20 balance)
  "function returnAssets(address token, address user, uint256 amount, address beneficiary)",
  // Balance
  "function getBalance(address token) view returns (uint256)",
];

const POOL_ABI = [
  "function globalState() view returns (uint160 price, int24 tick, uint16 fee, uint8 pluginConfig, uint16 communityFee, bool unlocked)",
];

/**
 * Build ABI-encoded Multilocation for xTokens precompile
 * parents=1, interior=[Parachain(paraId), AccountKey20(network=Any, key=address)]
 */
function buildXTokensDestination(paraId, recipientAddress) {
  // Parachain junction: 0x00 + uint32(paraId) big-endian
  const parachainJunction = new Uint8Array(5);
  parachainJunction[0] = 0x00;
  const dv = new DataView(parachainJunction.buffer);
  dv.setUint32(1, paraId, false); // big-endian

  // AccountKey20 junction: 0x03 + 0x00 (network Any) + bytes20(address)
  const addrBytes = ethers.getBytes(recipientAddress);
  const accountJunction = new Uint8Array(22);
  accountJunction[0] = 0x03; // AccountKey20
  accountJunction[1] = 0x00; // Network: Any
  accountJunction.set(addrBytes, 2);

  // ABI-encode as tuple(uint8 parents, bytes[] interior)
  const encoded = ethers.AbiCoder.defaultAbiCoder().encode(
    ["tuple(uint8 parents, bytes[] interior)"],
    [{ parents: 1, interior: [parachainJunction, accountJunction] }]
  );
  return encoded;
}

async function main() {
  const [signer] = await ethers.getSigners();
  console.log("══════════════════════════════════════════════════════");
  console.log("  LIQUIDATE LP POSITION — Moonbeam Mainnet");
  console.log("══════════════════════════════════════════════════════\n");
  console.log("Signer:", signer.address);

  const proxy = new ethers.Contract(XCMPROXY, PROXY_ABI, signer);
  const xcDotToken = new ethers.Contract(xcDOT, ERC20_ABI, signer.provider);
  const wglmrToken = new ethers.Contract(WGLMR, ERC20_ABI, signer.provider);

  // ═════════════════════════════════════════════════════════
  //  STEP 1: Read Position State
  // ═════════════════════════════════════════════════════════
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("  STEP 1: Read Position #" + POSITION_ID);
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

  const [owner, operator, testMode, paused, xcmPre] = await Promise.all([
    proxy.owner(),
    proxy.operator(),
    proxy.testMode(),
    proxy.paused(),
    proxy.xcmPrecompile(),
  ]);

  console.log("  Owner:", owner);
  console.log("  Operator:", operator);
  console.log("  Test mode:", testMode);
  console.log("  Paused:", paused);
  console.log("  XCM Precompile:", xcmPre);

  if (owner.toLowerCase() !== signer.address.toLowerCase()) {
    console.error(`\n  Signer ${signer.address} is not owner (${owner})`);
    process.exit(1);
  }

  const pos = await proxy.positions(POSITION_ID);
  const STATUS_NAMES = ["Active", "Liquidated", "Returned"];
  const status = Number(pos[13]);

  console.log("\n  Position #" + POSITION_ID + ":");
  console.log("    AssetHub ID:", pos[0]);
  console.log("    Pool:", pos[1]);
  console.log("    Token0:", pos[2], "(WGLMR)");
  console.log("    Token1:", pos[3], "(xcDOT)");
  console.log("    Bottom tick:", Number(pos[4]));
  console.log("    Top tick:", Number(pos[5]));
  console.log("    Liquidity:", pos[6].toString());
  console.log("    NFPM Token ID:", pos[7].toString());
  console.log("    Owner:", pos[8]);
  console.log("    Status:", STATUS_NAMES[status] || status);

  if (status !== 0) {
    console.log("\n  Position is not Active — cannot liquidate.");
    if (status === 1) {
      console.log("  Position is already Liquidated. Skipping to Phase 2 (returnAssets).");
    } else {
      console.log("  Position is already Returned. Nothing to do.");
      process.exit(0);
    }
  }

  // Check pool state
  const poolAddr = pos[1];
  const pool = new ethers.Contract(poolAddr, POOL_ABI, signer.provider);
  const gs = await pool.globalState();
  const currentTick = Number(gs.tick);
  const bottomTick = Number(pos[4]);
  const topTick = Number(pos[5]);

  console.log("\n  Pool state:");
  console.log("    Current tick:", currentTick);
  console.log("    Position range:", bottomTick, "to", topTick);
  console.log("    In range:", currentTick >= bottomTick && currentTick < topTick);

  // ═════════════════════════════════════════════════════════
  //  STEP 2: Pre-liquidation Balances
  // ═════════════════════════════════════════════════════════
  console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("  STEP 2: Pre-liquidation Balances");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

  const [xcDotBefore, wglmrBefore] = await Promise.all([
    xcDotToken.balanceOf(XCMPROXY),
    wglmrToken.balanceOf(XCMPROXY),
  ]);

  console.log("  xcDOT:", ethers.formatUnits(xcDotBefore, 10));
  console.log("  WGLMR:", ethers.formatUnits(wglmrBefore, 18));

  // ═════════════════════════════════════════════════════════
  //  STEP 3: Execute Full Liquidation (Phase 1)
  // ═════════════════════════════════════════════════════════
  if (status === 0) {
    console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("  STEP 3: executeFullLiquidation() — Remove NFPM");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

    // Simulate
    console.log("  Simulating executeFullLiquidation()...");
    try {
      const result = await proxy.executeFullLiquidation.staticCall(POSITION_ID);
      console.log("  Simulation passed:");
      console.log("    amount0 (WGLMR):", ethers.formatUnits(result[0], 18));
      console.log("    amount1 (xcDOT):", ethers.formatUnits(result[1], 10));
    } catch (e) {
      console.error("  Simulation failed:", e.reason || e.message?.substring(0, 300));
      process.exit(1);
    }

    // Execute
    console.log("\n  Sending executeFullLiquidation() tx...");
    const tx = await proxy.executeFullLiquidation(POSITION_ID, { gasLimit: 1_000_000n });
    console.log("  TX:", tx.hash);
    const receipt = await tx.wait();
    console.log("  Block:", receipt.blockNumber);
    console.log("  Gas used:", receipt.gasUsed.toString());
    console.log("  Status:", receipt.status === 1 ? "SUCCESS" : "REVERTED");

    if (receipt.status !== 1) {
      console.error("  Liquidation tx reverted!");
      process.exit(1);
    }
  }

  // ═════════════════════════════════════════════════════════
  //  STEP 4: Post-liquidation Balances
  // ═════════════════════════════════════════════════════════
  console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("  STEP 4: Post-liquidation Balances");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

  const [xcDotAfter, wglmrAfter] = await Promise.all([
    xcDotToken.balanceOf(XCMPROXY),
    wglmrToken.balanceOf(XCMPROXY),
  ]);

  console.log("  xcDOT:", ethers.formatUnits(xcDotAfter, 10), "(was", ethers.formatUnits(xcDotBefore, 10) + ")");
  console.log("  WGLMR:", ethers.formatUnits(wglmrAfter, 18), "(was", ethers.formatUnits(wglmrBefore, 18) + ")");

  const xcDotGained = xcDotAfter - xcDotBefore;
  const wglmrGained = wglmrAfter - wglmrBefore;
  console.log("\n  Gained from liquidation:");
  console.log("    xcDOT:", ethers.formatUnits(xcDotGained, 10));
  console.log("    WGLMR:", ethers.formatUnits(wglmrGained, 18));

  // ═════════════════════════════════════════════════════════
  //  STEP 5: Return Assets to Asset Hub via XTokens
  // ═════════════════════════════════════════════════════════
  console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("  STEP 5: returnAssets() — Send xcDOT back to Asset Hub");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

  if (testMode) {
    console.log("  Test mode ON — XCM transfer will be skipped by contract.");
    console.log("  Tokens remain in XCMProxy contract.");
    console.log("\n  DONE (test mode).");
    return;
  }

  // Beneficiary address (converted to AccountId32 with EE-padding by the contract)
  const beneficiary = signer.address;
  console.log("  Destination: Asset Hub paraId", ASSET_HUB_PARA_ID);
  console.log("  Beneficiary:", beneficiary);

  // Return xcDOT (the main asset)
  if (xcDotAfter > 0n) {
    console.log("\n  Returning", ethers.formatUnits(xcDotAfter, 10), "xcDOT...");

    // Simulate
    try {
      await proxy.returnAssets.staticCall(xcDOT, signer.address, 0, beneficiary);
      console.log("  Simulation passed");
    } catch (e) {
      console.error("  Simulation failed:", e.reason || e.message?.substring(0, 300));
      console.log("  xcDOT remains in contract. Can retry later.");
    }

    // Execute
    try {
      const tx = await proxy.returnAssets(xcDOT, signer.address, 0, beneficiary, { gasLimit: 500_000n });
      console.log("  TX:", tx.hash);
      const receipt = await tx.wait();
      console.log("  Gas used:", receipt.gasUsed.toString());
      console.log("  Status:", receipt.status === 1 ? "SUCCESS" : "REVERTED");
    } catch (e) {
      console.error("  returnAssets failed:", e.reason || e.message?.substring(0, 300));
      console.log("  xcDOT remains in contract.");
    }
  } else {
    console.log("  No xcDOT to return.");
  }

  // Return WGLMR if any (swap to xcDOT first would be needed for XTokens,
  // but for small dust amounts just leave it)
  if (wglmrAfter > 0n) {
    console.log("\n  WGLMR in contract:", ethers.formatUnits(wglmrAfter, 18));
    console.log("  (WGLMR cannot be sent via XTokens directly — it's native Moonbeam token)");
    console.log("  (Would need to swap WGLMR -> xcDOT first, or unwrap to GLMR)");
  }

  // ═════════════════════════════════════════════════════════
  //  STEP 6: Final State
  // ═════════════════════════════════════════════════════════
  console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("  STEP 6: Final State");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

  const posAfter = await proxy.positions(POSITION_ID);
  const finalStatus = Number(posAfter[13]);
  console.log("  Position #" + POSITION_ID + " status:", STATUS_NAMES[finalStatus] || finalStatus);
  console.log("    Stored liquidatedAmount0:", posAfter[14].toString(), "(NOTE: double-counted in current contract)");
  console.log("    Stored liquidatedAmount1:", posAfter[15].toString(), "(NOTE: double-counted in current contract)");

  const [xcDotFinal, wglmrFinal] = await Promise.all([
    xcDotToken.balanceOf(XCMPROXY),
    wglmrToken.balanceOf(XCMPROXY),
  ]);
  console.log("\n  Remaining in contract:");
  console.log("    xcDOT:", ethers.formatUnits(xcDotFinal, 10));
  console.log("    WGLMR:", ethers.formatUnits(wglmrFinal, 18));

  console.log("\n══════════════════════════════════════════════════════");
  console.log("  DONE — Position Liquidated");
  console.log("══════════════════════════════════════════════════════\n");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("\nFatal:", error.message || error);
    process.exit(1);
  });
