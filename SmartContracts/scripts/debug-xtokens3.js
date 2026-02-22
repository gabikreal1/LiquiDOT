const { ethers } = require("hardhat");

const XTOKENS = "0x0000000000000000000000000000000000000804";
const xcDOT = "0xFfFFfFff1FcaCBd218EDc0EbA20Fc2308C778080";

async function main() {
  const [signer] = await ethers.getSigners();

  // Check xcDOT balance first
  const xcDotToken = new ethers.Contract(xcDOT, [
    "function balanceOf(address) view returns (uint256)",
  ], signer);
  const bal = await xcDotToken.balanceOf(signer.address);
  console.log("Signer:", signer.address);
  console.log("xcDOT balance:", ethers.formatUnits(bal, 10), `(${bal} raw)`);

  const xtokens = new ethers.Contract(XTOKENS, [
    "function transfer(address currencyAddress, uint256 amount, tuple(uint8 parents, bytes[] interior) destination, uint64 weight)",
  ], signer);

  // Parachain junction: 0x00 + uint32 BE paraId
  const parachainJunction = ethers.solidityPacked(
    ["bytes1", "bytes4"],
    ["0x00", ethers.toBeHex(1000, 4)]
  );

  // AccountKey20 with network=None: 0x03 + address + 0x00
  const accountKey20 = ethers.solidityPacked(
    ["bytes1", "bytes20", "bytes1"],
    ["0x03", signer.address, "0x00"]
  );

  // AccountId32 with network=None: 0x01 + 32-byte-account + 0x00
  const addrPadded = ethers.zeroPadValue(signer.address, 32);
  const accountId32 = ethers.solidityPacked(
    ["bytes1", "bytes32", "bytes1"],
    ["0x01", addrPadded, "0x00"]
  );

  const testAmount = 10000000000n; // 1 DOT (10 decimals)

  // Test cases with FULL error output
  const tests = [
    {
      name: "AccountKey20 → ParaId 1000 (Asset Hub), net=None, 1 DOT",
      dest: { parents: 1, interior: [parachainJunction, accountKey20] },
      amount: testAmount,
    },
    {
      name: "AccountId32 → ParaId 1000 (Asset Hub), net=None, 1 DOT",
      dest: { parents: 1, interior: [parachainJunction, accountId32] },
      amount: testAmount,
    },
    {
      name: "AccountKey20 → ParaId 1000, net=None, small amount 1000",
      dest: { parents: 1, interior: [parachainJunction, accountKey20] },
      amount: 1000n,
    },
    {
      name: "AccountKey20 → Relay (parents=1), no parachain",
      dest: { parents: 1, interior: [accountKey20] },
      amount: testAmount,
    },
    {
      name: "AccountId32 → Relay (parents=1), no parachain",
      dest: { parents: 1, interior: [accountId32] },
      amount: testAmount,
    },
  ];

  for (const t of tests) {
    console.log(`\n=== ${t.name} ===`);
    console.log("  Amount:", t.amount.toString());
    console.log("  Dest parents:", t.dest.parents);
    console.log("  Dest interior:", t.dest.interior.map(x => x.substring(0, 20) + "..."));
    try {
      const result = await xtokens.transfer.staticCall(xcDOT, t.amount, t.dest, 6000000000n);
      console.log("  [PASS] Result:", result);
    } catch (e) {
      // Print FULL error for debugging
      console.log("  [FAIL]", e.message?.substring(0, 300));
      if (e.data) console.log("  Error data:", e.data);
    }
  }
}

main().catch(e => { console.error(e); process.exit(1); });
