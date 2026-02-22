const { ethers } = require("hardhat");

const XTOKENS = "0x0000000000000000000000000000000000000804";
const xcDOT = "0xFfFFfFff1FcaCBd218EDc0EbA20Fc2308C778080";
const XCMPROXY = "0x0cfb7CE7D66C7CdAe5827074C5f5A62223a0c230";

async function main() {
  const [signer] = await ethers.getSigners();

  // Check what selector the contract's IXTokens.transfer uses
  const contractIface = new ethers.Interface([
    "function transfer(address token, uint256 amount, bytes dest, uint64 destWeight)",
  ]);
  const contractSelector = contractIface.getFunction("transfer").selector;
  console.log("Contract IXTokens selector (bytes dest):", contractSelector);

  // Check what the actual Moonbeam xTokens precompile expects
  const precompileIface = new ethers.Interface([
    "function transfer(address currencyAddress, uint256 amount, tuple(uint8 parents, bytes[] interior) destination, uint64 weight)",
  ]);
  const precompileSelector = precompileIface.getFunction("transfer").selector;
  console.log("Precompile selector (Multilocation):", precompileSelector);

  console.log("\nSelectors match:", contractSelector === precompileSelector);

  // Also check the transferMultiasset variant
  const v2Iface = new ethers.Interface([
    "function transfer(address currencyAddress, uint256 amount, tuple(uint8 parents, bytes[] interior) destination, uint64 weight)",
    "function transferMultiasset(tuple(uint8 parents, bytes[] interior) asset, uint256 amount, tuple(uint8 parents, bytes[] interior) destination, uint64 weight)",
  ]);
  console.log("V2 transfer selector:", v2Iface.getFunction("transfer").selector);

  // Now try calling xTokens directly with the correct interface
  console.log("\n=== Direct xTokens precompile call ===");

  const xcDotToken = new ethers.Contract(xcDOT, [
    "function balanceOf(address) view returns (uint256)",
    "function approve(address, uint256) returns (bool)",
  ], signer);

  const balance = await xcDotToken.balanceOf(XCMPROXY);
  console.log("XCMProxy xcDOT balance:", ethers.formatUnits(balance, 10));

  // We can't call xTokens directly for the contract's tokens (they belong to the contract)
  // But let's see if we have any xcDOT in OUR wallet
  const signerBal = await xcDotToken.balanceOf(signer.address);
  console.log("Signer xcDOT balance:", ethers.formatUnits(signerBal, 10));

  // Let's check what functions the xTokens precompile supports
  // by encoding a test call with the correct selector
  const destination = {
    parents: 1,
    interior: [
      ethers.solidityPacked(["bytes1", "bytes4"], ["0x00", ethers.toBeHex(1000, 4)]),
      ethers.solidityPacked(
        ["bytes1", "bytes1", "bytes20"],
        ["0x03", "0x00", signer.address]
      ),
    ],
  };
  console.log("\nDestination:");
  console.log("  parents:", destination.parents);
  console.log("  interior[0] (Parachain):", destination.interior[0]);
  console.log("  interior[1] (AccountKey20):", destination.interior[1]);

  // Try to simulate with the correct interface on a tiny amount from signer
  if (signerBal > 0n) {
    const xtokens = new ethers.Contract(XTOKENS, [
      "function transfer(address currencyAddress, uint256 amount, tuple(uint8 parents, bytes[] interior) destination, uint64 weight)",
    ], signer);

    const testAmount = 1000n; // 0.0000001 DOT - dust
    console.log("\nSimulating direct xTokens.transfer with", testAmount.toString(), "raw units...");
    try {
      await xtokens.transfer.staticCall(xcDOT, testAmount, destination, 6000000000n);
      console.log("Simulation PASSED");
    } catch (e) {
      console.log("Simulation FAILED:", e.reason || e.message?.substring(0, 300));
    }
  } else {
    console.log("\nSigner has no xcDOT to test with.");
  }
}

main().catch(e => { console.error(e); process.exit(1); });
