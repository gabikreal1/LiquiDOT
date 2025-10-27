/**
 * Verify XCMProxy Configuration
 * 
 * Read-only script to check XCMProxy deployment configuration
 * 
 * Usage:
 *   $env:XCMPROXY_CONTRACT="0xYourXCMProxyAddress"
 *   npx hardhat run scripts/verify-xcmproxy-config.js --network moonbase
 */

const hre = require("hardhat");

async function main() {
  const XCMPROXY_ADDRESS = process.env.XCMPROXY_CONTRACT;

  if (!XCMPROXY_ADDRESS || XCMPROXY_ADDRESS === "0x" || XCMPROXY_ADDRESS.length !== 42) {
    console.error("\n❌ Error: XCMPROXY_CONTRACT environment variable not set or invalid!");
    console.error("   Set it to your deployed XCMProxy address:");
    console.error("   $env:XCMPROXY_CONTRACT=\"0xYourXCMProxyAddress\"\n");
    process.exit(1);
  }

  console.log("\n🔗 Connecting to XCMProxy...");
  console.log(`   Address: ${XCMPROXY_ADDRESS}`);
  console.log(`   Network: ${hre.network.name}\n`);

  // Attach to deployed contract
  const XCMProxy = await hre.ethers.getContractFactory(
    "contracts/V1(Current)/XCMProxy.sol:XCMProxy"
  );
  const xcmProxy = XCMProxy.attach(XCMPROXY_ADDRESS);

  // Verify connection
  try {
    await xcmProxy.owner();
    console.log("✅ Successfully connected to XCMProxy\n");
  } catch (error) {
    console.error(`❌ Failed to connect: ${error.message}\n`);
    process.exit(1);
  }

  console.log("=".repeat(70));
  console.log("  XCMProxy Configuration Report");
  console.log("=".repeat(70));

  // ===== Role Configuration =====
  console.log("\n📋 ROLE CONFIGURATION:");
  
  const owner = await xcmProxy.owner();
  console.log(`   Owner: ${owner}`);
  
  const operator = await xcmProxy.operator();
  console.log(`   Operator: ${operator}`);
  
  const trustedXcmCaller = await xcmProxy.trustedXcmCaller();
  console.log(`   Trusted XCM Caller: ${trustedXcmCaller}`);
  
  if (trustedXcmCaller === hre.ethers.ZeroAddress) {
    console.log("   ⚠️  WARNING: No trusted XCM caller set!");
    console.log("      Set this to AssetHubVault address to enable XCM calls");
  }

  // ===== Algebra Integration =====
  console.log("\n🔷 ALGEBRA DEX INTEGRATION:");
  
  const algebraRouter = await xcmProxy.swapRouterContract();
  console.log(`   Router: ${algebraRouter}`);
  
  const algebraNFPM = await xcmProxy.nfpmContract();
  console.log(`   NFPM: ${algebraNFPM}`);
  
  const algebraQuoter = await xcmProxy.quoterContract();
  console.log(`   Quoter: ${algebraQuoter}`);

  // Check if Algebra is configured
  const algebraConfigured = 
    algebraRouter !== hre.ethers.ZeroAddress &&
    algebraNFPM !== hre.ethers.ZeroAddress &&
    algebraQuoter !== hre.ethers.ZeroAddress;

  if (!algebraConfigured) {
    console.log("\n   ⚠️  WARNING: Algebra DEX not fully configured!");
    console.log("      All four addresses must be set before creating positions");
  } else {
    console.log("\n   ✅ Algebra DEX fully configured");
  }

  // ===== XCM Precompile Configuration =====
  console.log("\n🌉 XCM PRECOMPILE CONFIGURATION:");
  
  const xcmPrecompile = await xcmProxy.xTokensPrecompile();
  console.log(`   XTokens Precompile: ${xcmPrecompile}`);
  
  if (xcmPrecompile === hre.ethers.ZeroAddress) {
    console.log("   ⚠️  WARNING: XTokens precompile not set!");
    console.log("      Set this before sending XCM messages");
  }

  const assetHubParaId = await xcmProxy.assetHubParaId();
  console.log(`   Asset Hub ParaID: ${assetHubParaId}`);
  
  if (assetHubParaId === 0) {
    console.log("   ⚠️  WARNING: Asset Hub ParaID not set!");
    console.log("      Set this to 1000 for Asset Hub");
  }

  const xcmTransactor = await xcmProxy.xcmTransactorPrecompile();
  console.log(`   XCM Transactor: ${xcmTransactor}`);
  
  if (xcmTransactor === hre.ethers.ZeroAddress) {
    console.log("   ℹ️  XCM Transactor not set (optional for basic transfers)");
  }

  // ===== Contract State =====
  console.log("\n⚙️  CONTRACT STATE:");
  
  const paused = await xcmProxy.paused();
  console.log(`   Paused: ${paused}`);
  
  if (paused) {
    console.log("   ⚠️  WARNING: Contract is PAUSED!");
    console.log("      Operations will be blocked until unpaused");
  }

  const testMode = await xcmProxy.testMode();
  console.log(`   Test Mode: ${testMode}`);
  
  if (testMode) {
    console.log("   ✅ Test mode ENABLED - XCM calls will be skipped");
    console.log("      This is CORRECT for testnet testing");
  } else {
    console.log("   ⚠️  Production mode - XCM calls will be attempted");
    console.log("      Make sure XCM is properly configured!");
  }

  // ===== Contract Balance =====
  console.log("\n💰 CONTRACT BALANCE:");
  
  const balance = await hre.ethers.provider.getBalance(XCMPROXY_ADDRESS);
  console.log(`   Balance: ${hre.ethers.formatEther(balance)} ETH`);

  if (balance === 0n) {
    console.log("   ℹ️  Contract has no balance (expected for new deployment)");
  }

  // ===== Position Tracking =====
  console.log("\n📊 POSITION TRACKING:");
  
  const positionCounter = await xcmProxy.positionCounter();
  console.log(`   Position Counter: ${positionCounter}`);
  
  if (positionCounter === 0n) {
    console.log("   ℹ️  No positions created yet");
  } else {
    console.log(`   ℹ️  ${positionCounter} position(s) created`);
  }

  // ===== Summary & Warnings =====
  console.log("\n" + "=".repeat(70));
  console.log("  CONFIGURATION STATUS");
  console.log("=".repeat(70));

  const issues = [];
  const warnings = [];

  // Critical issues
  if (!algebraConfigured) {
    issues.push("Algebra DEX not fully configured");
  }
  if (trustedXcmCaller === hre.ethers.ZeroAddress) {
    issues.push("No trusted XCM caller set");
  }
  if (paused) {
    issues.push("Contract is paused");
  }

  // Warnings
  if (xcmPrecompile === hre.ethers.ZeroAddress) {
    warnings.push("XTokens precompile not set (required for production)");
  }
  if (assetHubParaId === 0) {
    warnings.push("Asset Hub ParaID not set (required for production)");
  }
  if (!testMode) {
    warnings.push("Test mode disabled - XCM will be attempted");
  }

  if (issues.length > 0) {
    console.log("\n❌ CRITICAL ISSUES:");
    issues.forEach(issue => console.log(`   - ${issue}`));
  }

  if (warnings.length > 0) {
    console.log("\n⚠️  WARNINGS:");
    warnings.forEach(warning => console.log(`   - ${warning}`));
  }

  if (issues.length === 0 && warnings.length === 0) {
    console.log("\n✅ All checks passed!");
  } else if (issues.length === 0) {
    console.log("\n✅ Ready for testnet testing (with test mode)");
  }

  console.log("\n" + "=".repeat(70) + "\n");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
