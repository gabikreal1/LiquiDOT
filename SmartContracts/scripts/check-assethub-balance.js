const { ethers } = require("hardhat");

async function main() {
  const [signer] = await ethers.getSigners();
  const bal = await ethers.provider.getBalance(signer.address);
  console.log("Address:", signer.address);
  console.log("Raw balance (wei):", bal.toString());
  console.log("DOT (18 dec):", ethers.formatEther(bal));
  console.log("DOT (10 dec):", ethers.formatUnits(bal, 10));

  // Also check xcDOT balance on Moonbeam's XCMProxy
  // and the XCMProxy contract balance
}

main().catch(e => { console.error(e); process.exit(1); });
