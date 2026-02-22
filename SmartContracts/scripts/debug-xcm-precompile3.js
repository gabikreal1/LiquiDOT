const { ethers } = require("hardhat");

const XCM = "0x000000000000000000000000000000000000081A";
const xcDOT = "0xFfFFfFff1FcaCBd218EDc0EbA20Fc2308C778080";

async function main() {
  const [signer] = await ethers.getSigners();

  const xcDotToken = new ethers.Contract(xcDOT, [
    "function balanceOf(address) view returns (uint256)",
  ], signer);
  const bal = await xcDotToken.balanceOf(signer.address);
  console.log("Signer:", signer.address);
  console.log("xcDOT balance:", ethers.formatUnits(bal, 10), `(${bal} raw)\n`);

  // XCM precompile with the correct transferAssetsLocation signature:
  // dest and beneficiary are SEPARATE Location params
  const xcm = new ethers.Contract(XCM, [
    "function transferAssetsLocation(tuple(uint8 parents, bytes[] interior) dest, tuple(uint8 parents, bytes[] interior) beneficiary, tuple(tuple(uint8 parents, bytes[] interior) location, uint256 amount)[] assets, uint32 feeAssetItem)",
  ], signer);

  const testAmount = 10000000000n; // 1 DOT

  // Junctions
  const parachainAH = ethers.solidityPacked(["bytes1", "bytes4"], ["0x00", ethers.toBeHex(1000, 4)]);
  const accountKey20 = ethers.solidityPacked(["bytes1", "bytes20", "bytes1"], ["0x03", signer.address, "0x00"]);
  const accountId32 = ethers.solidityPacked(["bytes1", "bytes32", "bytes1"], ["0x01", ethers.zeroPadValue(signer.address, 32), "0x00"]);

  // DOT asset location = relay chain native: {parents: 1, interior: []}
  const dotLocation = { parents: 1, interior: [] };

  const tests = [
    {
      name: "Location: DOT(1,[]) → dest=AH(1,[Para(1000)]), benef=AccountKey20",
      fn: () => xcm.transferAssetsLocation.staticCall(
        { parents: 1, interior: [parachainAH] },              // dest: Asset Hub
        { parents: 0, interior: [accountKey20] },              // beneficiary: AccountKey20
        [{ location: dotLocation, amount: testAmount }],       // assets
        0                                                       // feeAssetItem
      ),
    },
    {
      name: "Location: DOT(1,[]) → dest=AH(1,[Para(1000)]), benef=AccountId32",
      fn: () => xcm.transferAssetsLocation.staticCall(
        { parents: 1, interior: [parachainAH] },
        { parents: 0, interior: [accountId32] },
        [{ location: dotLocation, amount: testAmount }],
        0
      ),
    },
    {
      name: "Location: DOT(1,[]) → dest=Relay(1,[]), benef=AccountId32",
      fn: () => xcm.transferAssetsLocation.staticCall(
        { parents: 1, interior: [] },                          // dest: Relay chain
        { parents: 0, interior: [accountId32] },
        [{ location: dotLocation, amount: testAmount }],
        0
      ),
    },
    {
      name: "Location: DOT(1,[]) → dest=Relay(1,[]), benef=AccountKey20",
      fn: () => xcm.transferAssetsLocation.staticCall(
        { parents: 1, interior: [] },
        { parents: 0, interior: [accountKey20] },
        [{ location: dotLocation, amount: testAmount }],
        0
      ),
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
      const revertMatch = msg.match(/revert\s+(.*)/);
      if (moduleMatch) {
        console.log("  [FAIL]", moduleMatch[0]);
      } else if (revertMatch) {
        console.log("  [FAIL]", revertMatch[1]?.substring(0, 200));
      } else {
        console.log("  [FAIL]", msg.substring(0, 300));
      }
    }
    console.log("");
  }
}

main().catch(e => { console.error(e); process.exit(1); });
