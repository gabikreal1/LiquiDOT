const { ethers } = require("hardhat");

const XTOKENS = "0x0000000000000000000000000000000000000804";
const xcDOT = "0xFfFFfFff1FcaCBd218EDc0EbA20Fc2308C778080";

async function main() {
  const [signer] = await ethers.getSigners();

  const xcDotToken = new ethers.Contract(xcDOT, [
    "function balanceOf(address) view returns (uint256)",
  ], signer);
  const bal = await xcDotToken.balanceOf(signer.address);
  console.log("Signer:", signer.address);
  console.log("xcDOT balance:", ethers.formatUnits(bal, 10), `(${bal} raw)\n`);

  // Try transferMultiasset — specify asset as relay DOT MultiLocation
  const xtokens = new ethers.Contract(XTOKENS, [
    "function transfer(address currencyAddress, uint256 amount, tuple(uint8 parents, bytes[] interior) destination, uint64 weight)",
    "function transferMultiasset(tuple(uint8 parents, bytes[] interior) asset, uint256 amount, tuple(uint8 parents, bytes[] interior) destination, uint64 weight)",
  ], signer);

  // Asset location for DOT = relay chain native token: {parents: 1, interior: []}
  // On Polkadot relay chain, DOT is the native token at location (1, Here)
  const dotAsset = { parents: 1, interior: [] };

  // Alternative: DOT on Polkadot = {parents: 1, interior: [PalletInstance(10)]} (Balances pallet)
  const palletInstance10 = ethers.solidityPacked(["bytes1", "bytes1"], ["0x04", "0x0a"]); // PalletInstance(10)
  const dotAssetPallet = { parents: 1, interior: [palletInstance10] };

  // Parachain junction for Asset Hub
  const parachainJunction = ethers.solidityPacked(
    ["bytes1", "bytes4"],
    ["0x00", ethers.toBeHex(1000, 4)]
  );

  // AccountKey20 with network=None
  const accountKey20 = ethers.solidityPacked(
    ["bytes1", "bytes20", "bytes1"],
    ["0x03", signer.address, "0x00"]
  );

  // AccountId32 with network=None
  const addrPadded = ethers.zeroPadValue(signer.address, 32);
  const accountId32 = ethers.solidityPacked(
    ["bytes1", "bytes32", "bytes1"],
    ["0x01", addrPadded, "0x00"]
  );

  const testAmount = 10000000000n; // 1 DOT

  // ====== transferMultiasset tests ======
  const tests = [
    {
      name: "transferMultiasset: asset=DOT(1,Here) → ParaId 1000 + AccountKey20",
      fn: () => xtokens.transferMultiasset.staticCall(dotAsset, testAmount,
        { parents: 1, interior: [parachainJunction, accountKey20] }, 6000000000n),
    },
    {
      name: "transferMultiasset: asset=DOT(1,Here) → ParaId 1000 + AccountId32",
      fn: () => xtokens.transferMultiasset.staticCall(dotAsset, testAmount,
        { parents: 1, interior: [parachainJunction, accountId32] }, 6000000000n),
    },
    {
      name: "transferMultiasset: asset=DOT(1,Here) → Relay + AccountKey20",
      fn: () => xtokens.transferMultiasset.staticCall(dotAsset, testAmount,
        { parents: 1, interior: [accountKey20] }, 6000000000n),
    },
    {
      name: "transferMultiasset: asset=DOT(1,PalletInstance(10)) → ParaId 1000 + AccountKey20",
      fn: () => xtokens.transferMultiasset.staticCall(dotAssetPallet, testAmount,
        { parents: 1, interior: [parachainJunction, accountKey20] }, 6000000000n),
    },
    // ====== transfer with xcDOT address ======
    {
      name: "transfer(xcDOT addr): → Relay + AccountKey20 (no parachain)",
      fn: () => xtokens.transfer.staticCall(xcDOT, testAmount,
        { parents: 1, interior: [accountKey20] }, 6000000000n),
    },
    // ====== try to send to self on Moonbeam (sanity check) ======
    {
      name: "transfer(xcDOT addr): → self on Moonbeam (parents=0, AccountKey20)",
      fn: () => xtokens.transfer.staticCall(xcDOT, testAmount,
        { parents: 0, interior: [accountKey20] }, 6000000000n),
    },
  ];

  for (const t of tests) {
    console.log(`=== ${t.name} ===`);
    try {
      const result = await t.fn();
      console.log("  [PASS]", result);
    } catch (e) {
      const msg = e.message || "";
      // Extract the meaningful error
      const moduleMatch = msg.match(/Module\(ModuleError\s*\{[^}]+\}/);
      const revertMatch = msg.match(/revert\s+(.*?)$/);
      if (moduleMatch) {
        console.log("  [FAIL]", moduleMatch[0]);
      } else if (revertMatch) {
        console.log("  [FAIL]", revertMatch[1]?.substring(0, 200));
      } else {
        console.log("  [FAIL]", msg.substring(0, 200));
      }
    }
    console.log("");
  }
}

main().catch(e => { console.error(e); process.exit(1); });
