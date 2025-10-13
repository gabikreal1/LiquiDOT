/**
 * Configure XCMProxy after deployment
 * 
 * This script configures the XCMProxy contract with:
 * - Algebra DEX integrations
 * - XCM parameters
 * - Operator
 * - Trusted caller (AssetHub)
 * - Supported tokens
 * 
 * Usage:
 *   XCMPROXY_ADDRESS=0x... ASSETHUB_ADDRESS=0x... OPERATOR=0x... \
 *   npx hardhat run scripts/configure-xcmproxy.js --network moonbase
 */

const { ethers } = require("hardhat");

async function main() {
  console.log("\n⚙️  Configuring XCMProxy on Moonbase Alpha...\n");

  // Get configuration from environment
  const XCMPROXY_ADDRESS = process.env.XCMPROXY_ADDRESS;
  const ASSETHUB_ADDRESS = process.env.ASSETHUB_ADDRESS;
  const OPERATOR_ADDRESS = process.env.OPERATOR_ADDRESS;
  const TEST_MODE = process.env.TEST_MODE === "true";

  // Algebra DEX addresses (update these with actual Moonbase deployments)
  const ALGEBRA_QUOTER = process.env.ALGEBRA_QUOTER || ethers.ZeroAddress;
  const ALGEBRA_ROUTER = process.env.ALGEBRA_ROUTER || ethers.ZeroAddress;
  const ALGEBRA_NFPM = process.env.ALGEBRA_NFPM || ethers.ZeroAddress;

  // Token addresses
  const WDEV_ADDRESS = process.env.WDEV_ADDRESS;  // Wrapped DEV

  if (!XCMPROXY_ADDRESS) {
    console.error("❌ XCMPROXY_ADDRESS environment variable required");
    process.exit(1);
  }

  const [deployer] = await ethers.getSigners();
  console.log("Configuring from:", deployer.address);
  console.log("XCMProxy address:", XCMPROXY_ADDRESS);

  // Connect to deployed contract
  const xcmProxy = await ethers.getContractAt(
    "contracts/V1(Current)/XCMProxy.sol:XCMProxy",
    XCMPROXY_ADDRESS
  );

  // Verify ownership
  const owner = await xcmProxy.owner();
  console.log("Contract owner:", owner);
  
  if (owner.toLowerCase() !== deployer.address.toLowerCase()) {
    console.error("❌ Deployer is not the owner! Owner is:", owner);
    process.exit(1);
  }

  // 1. Set Algebra DEX Integrations
  if (ALGEBRA_QUOTER !== ethers.ZeroAddress && ALGEBRA_ROUTER !== ethers.ZeroAddress) {
    console.log("\n1️⃣  Setting Algebra DEX integrations...");
    
    const currentQuoter = await xcmProxy.quoterContract();
    const currentRouter = await xcmProxy.swapRouterContract();
    
    if (currentQuoter === ALGEBRA_QUOTER && currentRouter === ALGEBRA_ROUTER) {
      console.log("   ✓ Algebra integrations already set");
    } else {
      const tx1 = await xcmProxy.setIntegrations(ALGEBRA_QUOTER, ALGEBRA_ROUTER);
      await tx1.wait();
      console.log("   ✅ Algebra Quoter:", ALGEBRA_QUOTER);
      console.log("   ✅ Algebra Router:", ALGEBRA_ROUTER);
    }

    // Set NFPM
    if (ALGEBRA_NFPM !== ethers.ZeroAddress) {
      const currentNFPM = await xcmProxy.nfpmContract();
      if (currentNFPM === ALGEBRA_NFPM) {
        console.log("   ✓ NFPM already set");
      } else {
        const tx2 = await xcmProxy.setNFPM(ALGEBRA_NFPM);
        await tx2.wait();
        console.log("   ✅ Algebra NFPM:", ALGEBRA_NFPM);
      }
    }
  } else {
    console.log("\n1️⃣  ⚠️  Skipping Algebra integration (addresses not provided)");
    console.log("   Set ALGEBRA_QUOTER, ALGEBRA_ROUTER, ALGEBRA_NFPM env vars");
  }

  // 2. Set XCM Parameters
  console.log("\n2️⃣  Setting XCM parameters...");
  
  const XTOKENS_PRECOMPILE = "0x0000000000000000000000000000000000000804";
  const ASSET_HUB_PARA_ID = 1000;
  const DEFAULT_DEST_WEIGHT = 6000000000n;

  const currentXTokens = await xcmProxy.xTokensPrecompile();
  if (currentXTokens === XTOKENS_PRECOMPILE) {
    console.log("   ✓ xTokens precompile already set");
  } else {
    const tx3 = await xcmProxy.setXTokensPrecompile(XTOKENS_PRECOMPILE);
    await tx3.wait();
    console.log("   ✅ xTokens precompile:", XTOKENS_PRECOMPILE);
  }

  const currentParaId = await xcmProxy.assetHubParaId();
  if (Number(currentParaId) === ASSET_HUB_PARA_ID) {
    console.log("   ✓ Asset Hub Para ID already set");
  } else {
    const tx4 = await xcmProxy.setAssetHubParaId(ASSET_HUB_PARA_ID);
    await tx4.wait();
    console.log("   ✅ Asset Hub Para ID:", ASSET_HUB_PARA_ID);
  }

  const currentWeight = await xcmProxy.defaultDestWeight();
  if (currentWeight === DEFAULT_DEST_WEIGHT) {
    console.log("   ✓ Default dest weight already set");
  } else {
    const tx5 = await xcmProxy.setDefaultDestWeight(DEFAULT_DEST_WEIGHT);
    await tx5.wait();
    console.log("   ✅ Default dest weight:", DEFAULT_DEST_WEIGHT.toString());
  }

  // 3. Set Operator
  console.log("\n3️⃣  Setting operator...");
  const operatorAddress = OPERATOR_ADDRESS || deployer.address;
  const currentOperator = await xcmProxy.operator();
  
  if (currentOperator === operatorAddress) {
    console.log("   ✓ Operator already set");
  } else {
    const tx6 = await xcmProxy.setOperator(operatorAddress);
    await tx6.wait();
    console.log("   ✅ Operator set:", operatorAddress);
  }

  // 4. Set Trusted XCM Caller (AssetHub)
  if (ASSETHUB_ADDRESS) {
    console.log("\n4️⃣  Setting trusted XCM caller (AssetHub)...");
    const currentCaller = await xcmProxy.trustedXcmCaller();
    
    if (currentCaller.toLowerCase() === ASSETHUB_ADDRESS.toLowerCase()) {
      console.log("   ✓ Trusted caller already set");
    } else {
      const tx7 = await xcmProxy.setTrustedXcmCaller(ASSETHUB_ADDRESS);
      await tx7.wait();
      console.log("   ✅ Trusted caller:", ASSETHUB_ADDRESS);
    }
  } else {
    console.log("\n4️⃣  ⚠️  Skipping trusted caller (ASSETHUB_ADDRESS not provided)");
  }

  // 5. Add Supported Tokens
  if (WDEV_ADDRESS) {
    console.log("\n5️⃣  Adding supported tokens...");
    const isSupported = await xcmProxy.supportedTokens(WDEV_ADDRESS);
    
    if (isSupported) {
      console.log("   ✓ WDEV already supported");
    } else {
      const tx8 = await xcmProxy.addSupportedToken(WDEV_ADDRESS);
      await tx8.wait();
      console.log("   ✅ WDEV added:", WDEV_ADDRESS);
    }
  } else {
    console.log("\n5️⃣  ⚠️  Skipping tokens (WDEV_ADDRESS not provided)");
  }

  // 6. Set Test Mode (optional)
  if (TEST_MODE) {
    console.log("\n6️⃣  Enabling test mode...");
    const isTestMode = await xcmProxy.testMode();
    
    if (isTestMode) {
      console.log("   ✓ Test mode already enabled");
    } else {
      const tx9 = await xcmProxy.setTestMode(true);
      await tx9.wait();
      console.log("   ✅ Test mode enabled");
    }
  }

  // Summary
  console.log("\n📊 Configuration Summary:");
  console.log("  Owner:", await xcmProxy.owner());
  console.log("  Operator:", await xcmProxy.operator());
  console.log("  Quoter:", await xcmProxy.quoterContract());
  console.log("  Router:", await xcmProxy.swapRouterContract());
  console.log("  NFPM:", await xcmProxy.nfpmContract());
  console.log("  xTokens:", await xcmProxy.xTokensPrecompile());
  console.log("  Asset Hub Para ID:", await xcmProxy.assetHubParaId());
  console.log("  Default Weight:", (await xcmProxy.defaultDestWeight()).toString());
  console.log("  Trusted Caller:", await xcmProxy.trustedXcmCaller());
  console.log("  Test Mode:", await xcmProxy.testMode());
  console.log("  Paused:", await xcmProxy.paused());

  if (WDEV_ADDRESS) {
    console.log("  WDEV Supported:", await xcmProxy.supportedTokens(WDEV_ADDRESS));
  }

  console.log("\n✅ XCMProxy Configuration Complete!\n");

  // Next steps
  console.log("📝 Remember to:");
  console.log("1. Update AssetHub with this address as executor");
  console.log("2. Fund XCMProxy with gas for operations");
  console.log("3. Test with small amounts first");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("\n❌ Configuration failed:", error);
    process.exit(1);
  });
