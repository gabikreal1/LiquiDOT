const { ethers } = require("hardhat");

const XCM = "0x000000000000000000000000000000000000081A";
const xcDOT = "0xFfFFfFff1FcaCBd218EDc0EbA20Fc2308C778080";
const XCMPROXY = "0x0cfb7CE7D66C7CdAe5827074C5f5A62223a0c230";

function encodeDepositAssetXcm(address) {
  // SCALE-encode: VersionedXcm::V4(Xcm([DepositAsset { assets: Wild(All), beneficiary }]))
  // beneficiary = Location { parents: 0, interior: X1([AccountKey20 { network: None, key }]) }
  const addrBytes = ethers.getBytes(address);
  const buf = new Uint8Array(1 + 1 + 1 + 2 + 1 + 1 + 1 + 1 + 20);
  let i = 0;
  buf[i++] = 0x04; // VersionedXcm::V4
  buf[i++] = 0x04; // compact(1) — 1 instruction
  buf[i++] = 0x0d; // DepositAsset
  buf[i++] = 0x01; // AssetFilter::Wild
  buf[i++] = 0x00; // WildAsset::All
  buf[i++] = 0x00; // parents = 0
  buf[i++] = 0x01; // Junctions::X1
  buf[i++] = 0x03; // AccountKey20
  buf[i++] = 0x00; // network = None
  buf.set(addrBytes, i);
  return ethers.hexlify(buf);
}

async function main() {
  const [signer] = await ethers.getSigners();
  console.log("Signer:", signer.address);

  const xcDotToken = new ethers.Contract(xcDOT, [
    "function balanceOf(address) view returns (uint256)",
    "function approve(address, uint256) returns (bool)",
    "function allowance(address, address) view returns (uint256)",
  ], signer);

  // Check balances
  const signerBal = await xcDotToken.balanceOf(signer.address);
  const contractBal = await xcDotToken.balanceOf(XCMPROXY);
  console.log("Signer xcDOT balance:", ethers.formatUnits(signerBal, 10), `(${signerBal} raw)`);
  console.log("XCMProxy xcDOT balance:", ethers.formatUnits(contractBal, 10), `(${contractBal} raw)`);

  // Send the signer's xcDOT back to Asset Hub
  // Keep some for gas buffer, send most of it
  const sendAmount = signerBal - 100000000n; // Keep 0.01 DOT buffer
  if (sendAmount <= 0n) {
    console.log("Not enough xcDOT to send");
    return;
  }

  console.log(`\nSending ${ethers.formatUnits(sendAmount, 10)} DOT back to Asset Hub...`);
  console.log("Destination: Asset Hub (paraId 1000), AccountKey20(signer)");

  const xcm = new ethers.Contract(XCM, [
    "function transferAssetsUsingTypeAndThenAddress(tuple(uint8 parents, bytes[] interior) dest, tuple(address asset, uint256 amount)[] assets, uint8 assetsTransferType, uint8 remoteFeesIdIndex, uint8 feesTransferType, bytes customXcmOnDest)",
  ], signer);

  const parachainAH = ethers.solidityPacked(["bytes1", "bytes4"], ["0x00", ethers.toBeHex(1000, 4)]);
  const destAH = { parents: 1, interior: [parachainAH] };
  const xcmOnDest = encodeDepositAssetXcm(signer.address);

  console.log("customXcmOnDest:", xcmOnDest);

  // First simulate
  console.log("\nSimulating...");
  try {
    await xcm["transferAssetsUsingTypeAndThenAddress(tuple(uint8,bytes[]),tuple(address,uint256)[],uint8,uint8,uint8,bytes)"].staticCall(
      destAH,
      [{ asset: xcDOT, amount: sendAmount }],
      2, // DestinationReserve
      0, // remoteFeesIdIndex
      2, // feesTransferType = DestinationReserve
      xcmOnDest
    );
    console.log("Simulation PASSED");
  } catch (e) {
    console.log("Simulation FAILED:", e.message?.substring(0, 300));
    return;
  }

  // Execute for real
  console.log("\nExecuting transfer...");
  const tx = await xcm["transferAssetsUsingTypeAndThenAddress(tuple(uint8,bytes[]),tuple(address,uint256)[],uint8,uint8,uint8,bytes)"](
    destAH,
    [{ asset: xcDOT, amount: sendAmount }],
    2, 0, 2,
    xcmOnDest,
    { gasLimit: 500000n }
  );

  console.log("TX hash:", tx.hash);
  const receipt = await tx.wait();
  console.log("TX status:", receipt.status === 1 ? "SUCCESS" : "REVERTED");
  console.log("Gas used:", receipt.gasUsed.toString());

  // Check balance after
  const afterBal = await xcDotToken.balanceOf(signer.address);
  console.log("\nSigner xcDOT balance after:", ethers.formatUnits(afterBal, 10));
  console.log("xcDOT sent:", ethers.formatUnits(signerBal - afterBal, 10));
}

main().catch(e => { console.error(e); process.exit(1); });
