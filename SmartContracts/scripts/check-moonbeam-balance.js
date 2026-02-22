const { ethers } = require("hardhat");

const XCMPROXY = "0x0cfb7CE7D66C7CdAe5827074C5f5A62223a0c230";
const xcDOT = "0xFfFFfFff1FcaCBd218EDc0EbA20Fc2308C778080";
const WGLMR = "0xAcc15dC74880C9944775448304B263D191c6077F";

// The returnAssets tx
const RETURN_TX = "0xe94cc5a08bc2d4708b83a4681bd89063e5e9843f95a411006979f2d884cdc0ae";

async function main() {
  const provider = (await ethers.getSigners())[0].provider;

  // Check current balances
  const xcDotToken = new ethers.Contract(xcDOT, [
    "function balanceOf(address) view returns (uint256)",
  ], provider);
  const wglmrToken = new ethers.Contract(WGLMR, [
    "function balanceOf(address) view returns (uint256)",
  ], provider);

  const [xcDotBal, wglmrBal] = await Promise.all([
    xcDotToken.balanceOf(XCMPROXY),
    wglmrToken.balanceOf(XCMPROXY),
  ]);

  console.log("=== XCMProxy contract balances (Moonbeam) ===");
  console.log("xcDOT:", ethers.formatUnits(xcDotBal, 10));
  console.log("WGLMR:", ethers.formatUnits(wglmrBal, 18));

  // Check the returnAssets tx receipt
  console.log("\n=== returnAssets TX receipt ===");
  const receipt = await provider.getTransactionReceipt(RETURN_TX);
  console.log("Status:", receipt.status === 1 ? "SUCCESS" : "REVERTED");
  console.log("Gas used:", receipt.gasUsed.toString());
  console.log("Logs count:", receipt.logs.length);

  for (const log of receipt.logs) {
    console.log("\nLog from:", log.address);
    console.log("  Topics:", log.topics.map(t => t.substring(0, 18) + "..."));
    console.log("  Data:", log.data.substring(0, 66) + (log.data.length > 66 ? "..." : ""));

    // Try to decode XcmTransferAttempt event
    try {
      const iface = new ethers.Interface([
        "event XcmTransferAttempt(address indexed token, bytes dest, uint256 amount, bool success, bytes errorData)",
        "event AssetsReturned(address indexed token, address indexed user, bytes destination, uint256 amount, uint256 positionId)",
        "event Transfer(address indexed from, address indexed to, uint256 value)",
        "event Approval(address indexed owner, address indexed spender, uint256 value)",
      ]);
      const parsed = iface.parseLog({ topics: log.topics, data: log.data });
      if (parsed) {
        console.log("  Decoded:", parsed.name);
        for (const [key, val] of Object.entries(parsed.args)) {
          if (isNaN(Number(key))) {
            const v = typeof val === 'bigint' ? val.toString() : val;
            console.log(`    ${key}: ${v}`);
          }
        }
      }
    } catch {}
  }
}

main().catch(e => { console.error(e); process.exit(1); });
