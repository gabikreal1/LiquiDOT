/**
 * Configure XCMProxy for testnet testing
 * Ensures contract is ready for safe testnet operations
 */

const hre = require("hardhat");

async function main() {
  const PROXY_ADDRESS = process.env.XCMPROXY_CONTRACT;
  
  if (!PROXY_ADDRESS) {
    throw new Error("Set XCMPROXY_CONTRACT environment variable");
  }

  const [signer] = await hre.ethers.getSigners();
  console.log(`\n�� Configuring XCMProxy at: ${PROXY_ADDRESS}`);
  console.log(`Using account: ${signer.address}\n`);

  const XCMProxy = await hre.ethers.getContractFactory("contracts/V1(Current)/XCMProxy.sol:XCMProxy");
  const proxy = XCMProxy.attach(PROXY_ADDRESS);

  // 1. Unpause if paused
  const isPaused = await proxy.paused();
  if (isPaused) {
    console.log("📍 Unpausing contract...");
    const tx = await proxy.unpause();
    await tx.wait();
    console.log("✅ Contract unpaused\n");
  } else {
    console.log("✅ Contract not paused\n");
  }

  // 2. Enable test mode
  const testMode = await proxy.testMode();
  if (!testMode) {
    console.log("📍 Enabling test mode...");
    const tx = await proxy.setTestMode(true);
    await tx.wait();
    console.log("✅ Test mode enabled\n");
  } else {
    console.log("✅ Test mode already enabled\n");
  }

  // 3. Add WETH as supported token
  const WETH_MOONBASE = "0x1436aE0dF0A8663F18c0Ec51d7e2E46591730715";
  const isSupported = await proxy.supportedTokens(WETH_MOONBASE);
  
  if (!isSupported) {
    console.log("📍 Adding WETH as supported token...");
    const tx = await proxy.addSupportedToken(WETH_MOONBASE);
    await tx.wait();
    console.log("✅ WETH added to supported tokens\n");
  } else {
    console.log("✅ WETH already supported\n");
  }

  // Summary
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("✅ XCMProxy configured for testnet");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");
  console.log("Run tests with:");
  console.log("npx hardhat test test/XCMProxy/testnet/*.test.js --network moonbase\n");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
