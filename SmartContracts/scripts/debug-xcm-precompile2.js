const { ethers } = require("hardhat");

const XCM = "0x000000000000000000000000000000000000081A";
const xcDOT = "0xFfFFfFff1FcaCBd218EDc0EbA20Fc2308C778080";

async function main() {
  const [signer] = await ethers.getSigners();

  const xcDotToken = new ethers.Contract(xcDOT, [
    "function balanceOf(address) view returns (uint256)",
    "function approve(address, uint256) returns (bool)",
  ], signer);
  const bal = await xcDotToken.balanceOf(signer.address);
  console.log("Signer:", signer.address);
  console.log("xcDOT balance:", ethers.formatUnits(bal, 10), `(${bal} raw)\n`);

  // Correct XCM precompile interface from docs
  const xcm = new ethers.Contract(XCM, [
    // Simple: send to parachain with 20-byte account
    "function transferAssetsToPara20(uint32 paraId, address beneficiary, tuple(address asset, uint256 amount)[] assets, uint32 feeAssetItem)",
    // Simple: send to relay chain with 32-byte account
    "function transferAssetsToRelay(bytes32 beneficiary, tuple(address asset, uint256 amount)[] assets, uint32 feeAssetItem)",
    // Advanced: with transfer type
    "function transferAssetsUsingTypeAndThenAddress(tuple(uint8 parents, bytes[] interior) dest, tuple(address asset, uint256 amount)[] assets, uint8 assetsTransferType, uint8 remoteFeesIdIndex, uint8 feesTransferType, bytes customXcmOnDest)",
  ], signer);

  const testAmount = 10000000000n; // 1 DOT (10 decimals)

  const tests = [
    {
      name: "transferAssetsToPara20: xcDOT → Asset Hub (1000) + signer address",
      fn: () => xcm.transferAssetsToPara20.staticCall(
        1000,           // paraId
        signer.address, // beneficiary (20-byte)
        [{ asset: xcDOT, amount: testAmount }],
        0               // feeAssetItem
      ),
    },
    {
      name: "transferAssetsToRelay: xcDOT → Relay chain + padded signer address",
      fn: () => xcm.transferAssetsToRelay.staticCall(
        ethers.zeroPadValue(signer.address, 32), // beneficiary (32-byte)
        [{ asset: xcDOT, amount: testAmount }],
        0
      ),
    },
    {
      name: "transferAssetsUsingTypeAndThenAddress: xcDOT → AH, DestinationReserve(2)",
      fn: () => {
        const parachainAH = ethers.solidityPacked(["bytes1", "bytes4"], ["0x00", ethers.toBeHex(1000, 4)]);
        const dest = { parents: 1, interior: [parachainAH] };
        return xcm.transferAssetsUsingTypeAndThenAddress.staticCall(
          dest,
          [{ asset: xcDOT, amount: testAmount }],
          2,    // assetsTransferType = DestinationReserve
          0,    // remoteFeesIdIndex
          2,    // feesTransferType = DestinationReserve
          "0x"  // no custom XCM
        );
      },
    },
    {
      name: "transferAssetsUsingTypeAndThenAddress: xcDOT → Relay, LocalReserve(1)",
      fn: () => {
        const dest = { parents: 1, interior: [] };
        return xcm.transferAssetsUsingTypeAndThenAddress.staticCall(
          dest,
          [{ asset: xcDOT, amount: testAmount }],
          1,    // assetsTransferType = LocalReserve
          0,    // remoteFeesIdIndex
          1,    // feesTransferType = LocalReserve
          "0x"
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
