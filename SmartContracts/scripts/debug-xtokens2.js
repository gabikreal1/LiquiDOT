const { ethers } = require("hardhat");

const XTOKENS = "0x0000000000000000000000000000000000000804";
const xcDOT = "0xFfFFfFff1FcaCBd218EDc0EbA20Fc2308C778080";

async function main() {
  const [signer] = await ethers.getSigners();

  const xtokens = new ethers.Contract(XTOKENS, [
    "function transfer(address currencyAddress, uint256 amount, tuple(uint8 parents, bytes[] interior) destination, uint64 weight)",
  ], signer);

  const testAmount = 1000n;
  // Parachain junction: 0x00 + uint32 BE paraId
  const parachainJunction = ethers.solidityPacked(["bytes1", "bytes4"], ["0x00", ethers.toBeHex(1000, 4)]);

  // CORRECT ORDER: 0x03 + 20-byte-address + network_byte (network goes LAST)
  const networkVariants = [
    { name: "AccountKey20 key+net=None(0x00)",
      bytes: ethers.solidityPacked(["bytes1", "bytes20", "bytes1"], ["0x03", signer.address, "0x00"]) },
    { name: "AccountKey20 key+net=ByGenesis(0x01)",
      bytes: ethers.solidityPacked(["bytes1", "bytes20", "bytes1"], ["0x03", signer.address, "0x01"]) },
    { name: "AccountKey20 key+net=Polkadot(0x02)",
      bytes: ethers.solidityPacked(["bytes1", "bytes20", "bytes1"], ["0x03", signer.address, "0x02"]) },
    { name: "AccountKey20 key+net=Kusama(0x03)",
      bytes: ethers.solidityPacked(["bytes1", "bytes20", "bytes1"], ["0x03", signer.address, "0x03"]) },
    { name: "AccountKey20 key only (no network byte)",
      bytes: ethers.solidityPacked(["bytes1", "bytes20"], ["0x03", signer.address]) },
  ];

  // AccountId32: 0x01 + 32-byte-account + network_byte
  const addrPadded = ethers.zeroPadValue(signer.address, 32);
  const accountId32Variants = [
    { name: "AccountId32 key+net=None(0x00)",
      bytes: ethers.solidityPacked(["bytes1", "bytes32", "bytes1"], ["0x01", addrPadded, "0x00"]) },
    { name: "AccountId32 key+net=Polkadot(0x02)",
      bytes: ethers.solidityPacked(["bytes1", "bytes32", "bytes1"], ["0x01", addrPadded, "0x02"]) },
    { name: "AccountId32 key only (no network byte)",
      bytes: ethers.solidityPacked(["bytes1", "bytes32"], ["0x01", addrPadded]) },
  ];

  console.log("Signer:", signer.address);
  console.log("Parachain junction:", parachainJunction);
  console.log("");

  console.log("Testing AccountKey20 variants (network byte AFTER address)...\n");
  for (const v of networkVariants) {
    const dest = { parents: 1, interior: [parachainJunction, v.bytes] };
    try {
      await xtokens.transfer.staticCall(xcDOT, testAmount, dest, 6000000000n);
      console.log(`  [PASS] ${v.name}`);
      console.log(`         bytes: ${v.bytes}`);
    } catch (e) {
      const reason = e.reason || e.message?.substring(0, 120);
      console.log(`  [FAIL] ${v.name}: ${reason}`);
    }
  }

  console.log("\nTesting AccountId32 variants (network byte AFTER account)...\n");
  for (const v of accountId32Variants) {
    const dest = { parents: 1, interior: [parachainJunction, v.bytes] };
    try {
      await xtokens.transfer.staticCall(xcDOT, testAmount, dest, 6000000000n);
      console.log(`  [PASS] ${v.name}`);
      console.log(`         bytes: ${v.bytes}`);
    } catch (e) {
      const reason = e.reason || e.message?.substring(0, 120);
      console.log(`  [FAIL] ${v.name}: ${reason}`);
    }
  }
}

main().catch(e => { console.error(e); process.exit(1); });
