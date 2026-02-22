/**
 * Verify the FullMath-based _splitForDualSided fix produces correct fractions
 */

const { ethers } = require("hardhat");

const POOL = "0xc295aa4287127C5776Ad7031648692659eF2ceBB";

async function main() {
  const provider = (await ethers.getSigners())[0].provider;

  const pool = new ethers.Contract(POOL, [
    "function globalState() view returns (uint160,int24,uint16,uint8,uint16,bool)",
    "function tickSpacing() view returns (int24)",
  ], provider);

  const [gs, ts] = await Promise.all([pool.globalState(), pool.tickSpacing()]);
  const sqrtPriceX96 = gs[0];
  const currentTick = Number(gs[1]);
  console.log("sqrtPriceX96:", sqrtPriceX96.toString());
  console.log("currentTick:", currentTick);

  // Replicate getAmountsForLiquidity for a range of [-5%, +10%]
  // From debug output: bottomTick=-231120, topTick=-229620
  function getSqrtRatioAtTick(tick) {
    return BigInt(Math.floor(Math.pow(1.0001, tick / 2) * (2 ** 96)));
  }

  const bottomTick = -231120;
  const topTick = -229620;
  const sqrtLo = getSqrtRatioAtTick(bottomTick);
  const sqrtHi = getSqrtRatioAtTick(topTick);
  const sqrtP = sqrtPriceX96;
  const Q96 = 2n ** 96n;
  const liq = BigInt("1000000000000000000"); // 1e18

  // getAmountsForLiquidity (in-range)
  const ratio0 = (liq * (sqrtHi - sqrtP) * Q96) / (sqrtP * sqrtHi);
  const ratio1 = (liq * (sqrtP - sqrtLo)) / Q96;

  console.log("\nratio0 (WGLMR raw):", ratio0.toString());
  console.log("ratio1 (xcDOT raw):", ratio1.toString());

  // ─── OLD approach (buggy) ─────────────────────────────
  const totalRatioOld = ratio0 + ratio1;
  const totalAmount = 1657155781n; // 0.1657 xcDOT

  const swapOld = (totalAmount * ratio0) / totalRatioOld;
  console.log("\n═══ OLD (buggy): ratio0 + ratio1 directly ═══");
  console.log("  swap:", ethers.formatUnits(swapOld, 10), "xcDOT");
  console.log("  keep:", ethers.formatUnits(totalAmount - swapOld, 10), "xcDOT");
  console.log("  swap%:", (Number(swapOld) / Number(totalAmount) * 100).toFixed(6) + "%");

  // ─── NEW approach: FullMath price conversion ──────────
  // ratio0InToken1 = ratio0 * sqrtPriceX96^2 / 2^192
  // = mulDiv(mulDiv(ratio0, sqrtPriceX96, Q96), sqrtPriceX96, Q96)
  function mulDiv(a, b, d) {
    return (a * b) / d;
  }

  const ratio0InToken1 = mulDiv(mulDiv(ratio0, sqrtP, Q96), sqrtP, Q96);
  const totalValue = ratio0InToken1 + ratio1;
  const swapNew = mulDiv(totalAmount, ratio0InToken1, totalValue);

  console.log("\n═══ NEW (FullMath price conversion) ═══");
  console.log("  ratio0InToken1:", ratio0InToken1.toString());
  console.log("  ratio1:", ratio1.toString());
  console.log("  totalValue:", totalValue.toString());
  console.log("  swap:", ethers.formatUnits(swapNew, 10), "xcDOT");
  console.log("  keep:", ethers.formatUnits(totalAmount - swapNew, 10), "xcDOT");
  console.log("  swap%:", (Number(swapNew) / Number(totalAmount) * 100).toFixed(4) + "%");

  // ─── Sanity: what's the actual price? ─────────────────
  const priceRaw = Number(sqrtP) ** 2 / (2 ** 192);
  const priceDOTperGLMR = priceRaw * 1e8; // adjust for 18-10 decimal diff
  console.log("\n═══ Price sanity ═══");
  console.log("  1 WGLMR =", (1 / priceDOTperGLMR).toFixed(6), "xcDOT");
  console.log("  1 xcDOT =", priceDOTperGLMR.toFixed(4), "WGLMR");
  console.log("  ratio0 value in xcDOT (manual):", (Number(ratio0) / 1e18 / priceDOTperGLMR).toFixed(10));
  console.log("  ratio1 value in xcDOT (manual):", (Number(ratio1) / 1e10).toFixed(10));
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
