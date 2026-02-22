const { ethers } = require("hardhat");

const XCM = "0x000000000000000000000000000000000000081A";
const xcDOT = "0xFfFFfFff1FcaCBd218EDc0EbA20Fc2308C778080";

function encodeDepositAssetXcm_AccountId32(evmAddress) {
  // AccountId32 on Asset Hub = H160 address + 12 bytes of 0xEE
  const addrBytes = ethers.getBytes(evmAddress);
  const accountId32 = new Uint8Array(32);
  accountId32.set(addrBytes, 0);
  accountId32.fill(0xEE, 20);

  // SCALE-encode: VersionedXcm::V4(Xcm([DepositAsset { assets: Wild(All), beneficiary }]))
  // beneficiary = Location { parents: 0, interior: X1([AccountId32 { network: None, id }]) }
  const buf = new Uint8Array(1 + 1 + 1 + 2 + 1 + 1 + 1 + 1 + 32);
  let i = 0;
  buf[i++] = 0x04; // VersionedXcm::V4
  buf[i++] = 0x04; // compact(1) — 1 instruction
  buf[i++] = 0x0d; // DepositAsset
  buf[i++] = 0x01; // AssetFilter::Wild
  buf[i++] = 0x00; // WildAsset::All
  buf[i++] = 0x00; // parents = 0
  buf[i++] = 0x01; // Junctions::X1
  buf[i++] = 0x01; // AccountId32
  buf[i++] = 0x00; // network = None
  buf.set(accountId32, i);
  return ethers.hexlify(buf);
}

async function main() {
  const [signer] = await ethers.getSigners();
  console.log("Signer:", signer.address);

  const xcDotToken = new ethers.Contract(xcDOT, [
    "function balanceOf(address) view returns (uint256)",
  ], signer);

  const bal = await xcDotToken.balanceOf(signer.address);
  console.log("xcDOT balance:", ethers.formatUnits(bal, 10), `(${bal} raw)\n`);

  const xcm = new ethers.Contract(XCM, [
    "function transferAssetsUsingTypeAndThenAddress(tuple(uint8 parents, bytes[] interior) dest, tuple(address asset, uint256 amount)[] assets, uint8 assetsTransferType, uint8 remoteFeesIdIndex, uint8 feesTransferType, bytes customXcmOnDest)",
  ], signer);

  const parachainAH = ethers.solidityPacked(["bytes1", "bytes4"], ["0x00", ethers.toBeHex(1000, 4)]);
  const destAH = { parents: 1, interior: [parachainAH] };
  const xcmOnDest = encodeDepositAssetXcm_AccountId32(signer.address);

  console.log("customXcmOnDest (AccountId32 with EE-padding):", xcmOnDest);

  // Use a small test amount for simulation
  const testAmount = bal > 0n ? bal : 1000000000n; // use actual balance or 0.1 DOT
  console.log("Test amount:", ethers.formatUnits(testAmount, 10), "DOT\n");

  // Simulate
  console.log("=== Simulating DestReserve(2) → Asset Hub, AccountId32 ===");
  try {
    await xcm["transferAssetsUsingTypeAndThenAddress(tuple(uint8,bytes[]),tuple(address,uint256)[],uint8,uint8,uint8,bytes)"].staticCall(
      destAH,
      [{ asset: xcDOT, amount: testAmount }],
      2, // DestinationReserve
      0, // remoteFeesIdIndex
      2, // feesTransferType = DestinationReserve
      xcmOnDest
    );
    console.log("  SIMULATION PASSED\n");
  } catch (e) {
    console.log("  SIMULATION FAILED:", e.message?.substring(0, 300));
    return;
  }

  // Only simulate, don't execute — user can decide
  console.log("Simulation passed. To execute for real, run with --execute flag.");
  if (!process.argv.includes("--execute")) return;

  console.log("\nExecuting transfer...");
  const tx = await xcm["transferAssetsUsingTypeAndThenAddress(tuple(uint8,bytes[]),tuple(address,uint256)[],uint8,uint8,uint8,bytes)"](
    destAH,
    [{ asset: xcDOT, amount: testAmount }],
    2, 0, 2,
    xcmOnDest,
    { gasLimit: 500000n }
  );

  console.log("TX hash:", tx.hash);
  const receipt = await tx.wait();
  console.log("TX status:", receipt.status === 1 ? "SUCCESS" : "REVERTED");
  console.log("Gas used:", receipt.gasUsed.toString());

  const afterBal = await xcDotToken.balanceOf(signer.address);
  console.log("\nxcDOT balance after:", ethers.formatUnits(afterBal, 10));
}

main().catch(e => { console.error(e); process.exit(1); });
