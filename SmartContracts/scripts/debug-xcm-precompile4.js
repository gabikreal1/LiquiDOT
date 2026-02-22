const { ethers } = require("hardhat");

const XCM = "0x000000000000000000000000000000000000081A";
const xcDOT = "0xFfFFfFff1FcaCBd218EDc0EbA20Fc2308C778080";

function encodeDepositAssetXcm(address) {
  // SCALE-encode: VersionedXcm::V4(Xcm([DepositAsset { assets: Wild(All), beneficiary }]))
  //
  // VersionedXcm::V4 = variant 4 = 0x04
  // Xcm = Vec<Instruction> with 1 element:
  //   compact length = 1 → 0x04 (1 << 2)
  // Instruction::DepositAsset = variant 13 = 0x0d
  //   assets: AssetFilter::Wild(WildAsset::All) = 0x01 0x00
  //   beneficiary: Location { parents: 0, interior: X1([AccountKey20 { network: None, key }]) }
  //     parents = 0x00
  //     Junctions::X1 = variant 1 = 0x01
  //     Junction::AccountKey20 = variant 3 = 0x03
  //       network: Option<NetworkId>::None = 0x00
  //       key: [u8; 20]

  const addrBytes = ethers.getBytes(address);

  const buf = new Uint8Array(
    1 +   // VersionedXcm::V4
    1 +   // Vec compact length
    1 +   // Instruction::DepositAsset
    2 +   // AssetFilter::Wild(All)
    1 +   // parents
    1 +   // Junctions::X1
    1 +   // Junction::AccountKey20
    1 +   // Option<NetworkId>::None
    20    // key
  );

  let i = 0;
  buf[i++] = 0x04; // VersionedXcm::V4
  buf[i++] = 0x04; // compact(1)
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

function encodeDepositAssetXcmAccountId32(address) {
  // Same but with AccountId32 (padded to 32 bytes)
  const padded = ethers.getBytes(ethers.zeroPadValue(address, 32));

  const buf = new Uint8Array(
    1 + 1 + 1 + 2 + 1 + 1 + 1 + 1 + 32
  );

  let i = 0;
  buf[i++] = 0x04; // VersionedXcm::V4
  buf[i++] = 0x04; // compact(1)
  buf[i++] = 0x0d; // DepositAsset
  buf[i++] = 0x01; // Wild
  buf[i++] = 0x00; // All
  buf[i++] = 0x00; // parents
  buf[i++] = 0x01; // X1
  buf[i++] = 0x01; // AccountId32
  buf[i++] = 0x00; // network = None
  buf.set(padded, i);

  return ethers.hexlify(buf);
}

async function main() {
  const [signer] = await ethers.getSigners();

  const xcDotToken = new ethers.Contract(xcDOT, [
    "function balanceOf(address) view returns (uint256)",
  ], signer);
  const bal = await xcDotToken.balanceOf(signer.address);
  console.log("Signer:", signer.address);
  console.log("xcDOT balance:", ethers.formatUnits(bal, 10), `(${bal} raw)\n`);

  // TransferType enum: 0=Teleport, 1=LocalReserve, 2=DestinationReserve
  const xcm = new ethers.Contract(XCM, [
    // 5-param overload with explicit transfer types
    "function transferAssetsUsingTypeAndThenAddress(tuple(uint8 parents, bytes[] interior) dest, tuple(address asset, uint256 amount)[] assets, uint8 assetsTransferType, uint8 remoteFeesIdIndex, uint8 feesTransferType, bytes customXcmOnDest)",
    // 5-param overload with remote reserve
    "function transferAssetsUsingTypeAndThenAddress(tuple(uint8 parents, bytes[] interior) dest, tuple(address asset, uint256 amount)[] assets, uint8 remoteFeesIdIndex, bytes customXcmOnDest, tuple(uint8 parents, bytes[] interior) remoteReserve)",
  ], signer);

  const testAmount = 10000000000n; // 1 DOT
  const parachainAH = ethers.solidityPacked(["bytes1", "bytes4"], ["0x00", ethers.toBeHex(1000, 4)]);
  const destAH = { parents: 1, interior: [parachainAH] };
  const destRelay = { parents: 1, interior: [] };

  const xcmOnDestKey20 = encodeDepositAssetXcm(signer.address);
  const xcmOnDestId32 = encodeDepositAssetXcmAccountId32(signer.address);

  console.log("customXcmOnDest (AccountKey20):", xcmOnDestKey20);
  console.log("customXcmOnDest (AccountId32):", xcmOnDestId32);
  console.log("");

  const tests = [
    // DestinationReserve to Asset Hub with AccountKey20
    {
      name: "DestReserve(2) → AH, xcDOT, AccountKey20 on dest",
      fn: () => xcm["transferAssetsUsingTypeAndThenAddress(tuple(uint8,bytes[]),tuple(address,uint256)[],uint8,uint8,uint8,bytes)"].staticCall(
        destAH,
        [{ asset: xcDOT, amount: testAmount }],
        2, 0, 2,
        xcmOnDestKey20
      ),
    },
    // DestinationReserve to Asset Hub with AccountId32
    {
      name: "DestReserve(2) → AH, xcDOT, AccountId32 on dest",
      fn: () => xcm["transferAssetsUsingTypeAndThenAddress(tuple(uint8,bytes[]),tuple(address,uint256)[],uint8,uint8,uint8,bytes)"].staticCall(
        destAH,
        [{ asset: xcDOT, amount: testAmount }],
        2, 0, 2,
        xcmOnDestId32
      ),
    },
    // LocalReserve to Asset Hub (Moonbeam IS the reserve?)
    {
      name: "LocalReserve(1) → AH, xcDOT, AccountKey20 on dest",
      fn: () => xcm["transferAssetsUsingTypeAndThenAddress(tuple(uint8,bytes[]),tuple(address,uint256)[],uint8,uint8,uint8,bytes)"].staticCall(
        destAH,
        [{ asset: xcDOT, amount: testAmount }],
        1, 0, 1,
        xcmOnDestKey20
      ),
    },
    // DestReserve to Relay with AccountId32
    {
      name: "DestReserve(2) → Relay, xcDOT, AccountId32 on dest",
      fn: () => xcm["transferAssetsUsingTypeAndThenAddress(tuple(uint8,bytes[]),tuple(address,uint256)[],uint8,uint8,uint8,bytes)"].staticCall(
        destRelay,
        [{ asset: xcDOT, amount: testAmount }],
        2, 0, 2,
        xcmOnDestId32
      ),
    },
    // Teleport to AH
    {
      name: "Teleport(0) → AH, xcDOT, AccountKey20 on dest",
      fn: () => xcm["transferAssetsUsingTypeAndThenAddress(tuple(uint8,bytes[]),tuple(address,uint256)[],uint8,uint8,uint8,bytes)"].staticCall(
        destAH,
        [{ asset: xcDOT, amount: testAmount }],
        0, 0, 0,
        xcmOnDestKey20
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
