const { ethers } = require("hardhat");

const XTOKENS = "0x0000000000000000000000000000000000000804";
const XCM_PRECOMPILE = "0x000000000000000000000000000000000000081A";
const xcDOT = "0xFfFFfFff1FcaCBd218EDc0EbA20Fc2308C778080";

async function main() {
  const [signer] = await ethers.getSigners();
  const provider = signer.provider;

  // Check if XCM precompile has code
  const xcmCode = await provider.getCode(XCM_PRECOMPILE);
  console.log("XCM Precompile (0x081A) code length:", xcmCode.length);
  console.log("Has code:", xcmCode !== "0x" && xcmCode.length > 2);

  // Check xTokens precompile code
  const xtokensCode = await provider.getCode(XTOKENS);
  console.log("xTokens (0x0804) code length:", xtokensCode.length);
  console.log("Has code:", xtokensCode !== "0x" && xtokensCode.length > 2);

  // Get current runtime version
  console.log("\n=== Runtime info ===");
  try {
    const block = await provider.getBlockNumber();
    console.log("Current block:", block);
  } catch (e) {
    console.log("Error getting block:", e.message?.substring(0, 100));
  }

  // Now let's try xTokens.transferMultiasset with the CORRECT asset location
  // DOT reserve is now Asset Hub, so the asset location from Moonbeam's perspective is:
  // {parents: 1, interior: []} for the relay chain native token
  // BUT the reserve is Asset Hub, so maybe we need a different approach

  const xtokens = new ethers.Contract(XTOKENS, [
    "function transfer(address currencyAddress, uint256 amount, tuple(uint8 parents, bytes[] interior) destination, uint64 weight)",
    "function transferMultiasset(tuple(uint8 parents, bytes[] interior) asset, uint256 amount, tuple(uint8 parents, bytes[] interior) destination, uint64 weight)",
    "function transferMultiCurrencies(tuple(address currencyAddress, uint256 amount)[] currencies, uint32 feeItem, tuple(uint8 parents, bytes[] interior) destination, uint64 weight)",
    "function transferMultiAssets(tuple(tuple(uint8 parents, bytes[] interior) location, uint256 amount)[] assets, uint32 feeItem, tuple(uint8 parents, bytes[] interior) destination, uint64 weight)",
  ], signer);

  const testAmount = 10000000000n; // 1 DOT

  // Junctions
  const parachainAH = ethers.solidityPacked(["bytes1", "bytes4"], ["0x00", ethers.toBeHex(1000, 4)]);
  const accountKey20 = ethers.solidityPacked(["bytes1", "bytes20", "bytes1"], ["0x03", signer.address, "0x00"]);

  // Try destination directly to Asset Hub sovereign without going through relay
  // Maybe the issue is that destination goes through relay (parents:1) but DOT reserve is AH
  // Try parents:1, interior: [Parachain(1000), AccountKey20(signer)]

  const tests = [
    {
      name: "transferMultiasset: asset=HERE(0,[]) amount → AH+AccountKey20 (asset relative to self = DOT on Moonbeam?)",
      fn: () => xtokens.transferMultiasset.staticCall(
        { parents: 0, interior: [] }, // asset = here (Moonbeam native?) - probably wrong
        testAmount,
        { parents: 1, interior: [parachainAH, accountKey20] },
        6000000000n
      ),
    },
    {
      name: "transferMultiAssets: asset=DOT(1,[]) → AH, fee_item=0",
      fn: () => xtokens.transferMultiAssets.staticCall(
        [{ location: { parents: 1, interior: [] }, amount: testAmount }],
        0,
        { parents: 1, interior: [parachainAH, accountKey20] },
        6000000000n
      ),
    },
    {
      name: "transferMultiCurrencies: xcDOT addr → AH, fee_item=0",
      fn: () => xtokens.transferMultiCurrencies.staticCall(
        [{ currencyAddress: xcDOT, amount: testAmount }],
        0,
        { parents: 1, interior: [parachainAH, accountKey20] },
        6000000000n
      ),
    },
  ];

  console.log("\n=== xTokens transfer tests ===\n");
  for (const t of tests) {
    console.log(`--- ${t.name} ---`);
    try {
      const result = await t.fn();
      console.log("  [PASS]", result);
    } catch (e) {
      const msg = e.message || "";
      const moduleMatch = msg.match(/Module\(ModuleError\s*\{[^}]+\}/);
      if (moduleMatch) {
        console.log("  [FAIL]", moduleMatch[0]);
      } else {
        console.log("  [FAIL]", msg.substring(0, 300));
      }
    }
    console.log("");
  }

  // If XCM precompile exists, try it
  if (xcmCode !== "0x" && xcmCode.length > 2) {
    console.log("=== XCM Precompile tests ===\n");
    // Try to enumerate selectors
    // transferAssets(dest, assets, feeItem) — common pallet-xcm function
    const xcm = new ethers.Contract(XCM_PRECOMPILE, [
      "function transferAssetsLocation(tuple(tuple(uint8 parents, bytes[] interior) location, uint256 amount)[] assets, uint32 feeAssetItem, tuple(uint8 parents, bytes[] interior) destination, uint64 weight)",
      "function transferAssetsToPara20(tuple(address asset, uint256 amount)[] assets, uint32 feeAssetItem, uint32 paraId, bytes20 beneficiary, uint64 weight)",
    ], signer);

    try {
      await xcm.transferAssetsToPara20.staticCall(
        [{ asset: xcDOT, amount: testAmount }],
        0, 1000, signer.address, 6000000000n
      );
      console.log("  [PASS] transferAssetsToPara20");
    } catch (e) {
      console.log("  [FAIL] transferAssetsToPara20:", e.message?.substring(0, 200));
    }
  }
}

main().catch(e => { console.error(e); process.exit(1); });
