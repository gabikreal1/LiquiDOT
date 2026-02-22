const { ethers } = require("hardhat");

const XCM_PRECOMPILE = "0x000000000000000000000000000000000000081A";
const xcDOT = "0xFfFFfFff1FcaCBd218EDc0EbA20Fc2308C778080";

async function main() {
  const [signer] = await ethers.getSigners();

  const xcDotToken = new ethers.Contract(xcDOT, [
    "function balanceOf(address) view returns (uint256)",
  ], signer);
  const bal = await xcDotToken.balanceOf(signer.address);
  console.log("Signer:", signer.address);
  console.log("xcDOT balance:", ethers.formatUnits(bal, 10), `(${bal} raw)\n`);

  // XCM Precompile interface
  const xcmPrecompile = new ethers.Contract(XCM_PRECOMPILE, [
    // transferAssetsToPara20 — send to 20-byte account on a parachain
    "function transferAssetsToPara20(tuple(address asset, uint256 amount)[] assets, uint32 feeAssetItem, uint32 paraId, bytes20 beneficiary, uint64 weight)",
    // transferAssetsToRelay — send to 32-byte account on relay chain
    "function transferAssetsToRelay(tuple(address asset, uint256 amount)[] assets, uint32 feeAssetItem, bytes32 beneficiary, uint64 weight)",
    // transferAssetsLocation — send using Location format
    "function transferAssetsLocation(tuple(tuple(uint8 parents, bytes[] interior) location, uint256 amount)[] assets, uint32 feeAssetItem, tuple(uint8 parents, bytes[] interior) destination, uint64 weight)",
  ], signer);

  const testAmount = 10000000000n; // 1 DOT

  // Signer address as bytes20 and bytes32
  const signerBytes20 = signer.address;
  const signerBytes32 = ethers.zeroPadValue(signer.address, 32);

  const tests = [
    {
      name: "transferAssetsToPara20: xcDOT → Asset Hub (paraId 1000), 1 DOT",
      fn: () => xcmPrecompile.transferAssetsToPara20.staticCall(
        [{ asset: xcDOT, amount: testAmount }],
        0,    // feeAssetItem
        1000, // paraId (Asset Hub)
        signerBytes20,
        6000000000n // weight
      ),
    },
    {
      name: "transferAssetsToRelay: xcDOT → Relay chain, 1 DOT",
      fn: () => xcmPrecompile.transferAssetsToRelay.staticCall(
        [{ asset: xcDOT, amount: testAmount }],
        0,    // feeAssetItem
        signerBytes32,
        6000000000n
      ),
    },
    {
      name: "transferAssetsLocation: xcDOT via Location → Asset Hub, 1 DOT",
      fn: () => {
        // Asset = DOT on relay: {parents: 1, interior: []}
        const assetLocation = { parents: 1, interior: [] };
        // Destination = Asset Hub with AccountKey20
        const parachainJunction = ethers.solidityPacked(["bytes1", "bytes4"], ["0x00", ethers.toBeHex(1000, 4)]);
        const accountKey20 = ethers.solidityPacked(["bytes1", "bytes20", "bytes1"], ["0x03", signer.address, "0x00"]);
        const dest = { parents: 1, interior: [parachainJunction, accountKey20] };
        return xcmPrecompile.transferAssetsLocation.staticCall(
          [{ location: assetLocation, amount: testAmount }],
          0,
          dest,
          6000000000n
        );
      },
    },
  ];

  for (const t of tests) {
    console.log(`=== ${t.name} ===`);
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
}

main().catch(e => { console.error(e); process.exit(1); });
