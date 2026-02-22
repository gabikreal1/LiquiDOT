const { ethers } = require("hardhat");

const TX_HASH = "0x4f0b3e32252e38c56e164f2fdcc9f8ebf2520f1f1fe05729e30a73c3027de001";
const xcDOT = "0xFfFFfFff1FcaCBd218EDc0EbA20Fc2308C778080";

async function main() {
  const [signer] = await ethers.getSigners();
  const provider = signer.provider;

  const receipt = await provider.getTransactionReceipt(TX_HASH);
  console.log("TX Status:", receipt.status === 1 ? "SUCCESS" : "REVERTED");
  console.log("Gas used:", receipt.gasUsed.toString());
  console.log("Logs count:", receipt.logs.length);

  for (let idx = 0; idx < receipt.logs.length; idx++) {
    const log = receipt.logs[idx];
    console.log(`\nLog[${idx}]:`);
    console.log("  Address:", log.address);
    console.log("  Topics:", log.topics);
    console.log("  Data:", log.data);

    // Try to decode known events
    const iface = new ethers.Interface([
      "event Transfer(address indexed from, address indexed to, uint256 value)",
      "event Approval(address indexed owner, address indexed spender, uint256 value)",
      "event XcmTransferAttempt(address indexed token, bytes dest, uint256 amount, bool success, bytes errorData)",
    ]);
    try {
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

  // Also get the raw transaction data to check what was sent
  const tx = await provider.getTransaction(TX_HASH);
  console.log("\n=== TX Data ===");
  console.log("To:", tx.to);
  console.log("Value:", tx.value?.toString());
  console.log("Data length:", tx.data?.length);
  console.log("Data (first 200 chars):", tx.data?.substring(0, 200));

  // Check current xcDOT balance
  const xcDotToken = new ethers.Contract(xcDOT, [
    "function balanceOf(address) view returns (uint256)",
  ], provider);
  const bal = await xcDotToken.balanceOf(signer.address);
  console.log("\nCurrent xcDOT balance:", ethers.formatUnits(bal, 10));
}

main().catch(e => { console.error(e); process.exit(1); });
