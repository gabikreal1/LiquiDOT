/**
 * Deploy ONLY the updated XCMProxy contract to Moonbase Alpha,
 * wiring it to the existing Algebra DEX suite and test tokens.
 *
 * Usage:
 *   npx hardhat run scripts/deploy-xcmproxy-only.js --network moonbase
 */
const { ethers } = require("hardhat");
const fs = require("fs");
const path = require("path");

const BOOTSTRAP_PATH = path.join(__dirname, "../deployments/moonbase_bootstrap.json");

async function main() {
  const [deployer] = await ethers.getSigners();
  const network = await ethers.provider.getNetwork();
  const balance = await ethers.provider.getBalance(deployer.address);

  console.log("\n=== Deploy Updated XCMProxy to Moonbase Alpha ===");
  console.log(`Deployer: ${deployer.address}`);
  console.log(`Balance:  ${ethers.formatEther(balance)} DEV`);
  console.log(`Chain:    ${network.chainId}\n`);

  // Load existing bootstrap for Algebra addresses + tokens
  const bootstrap = JSON.parse(fs.readFileSync(BOOTSTRAP_PATH, "utf8"));
  const algebra = bootstrap.algebra;
  const supportedTokens = bootstrap.supportedTokens || [];
  const poolAddress = bootstrap.pool?.address;

  console.log("Existing infrastructure:");
  console.log(`  Quoter: ${algebra.quoter}`);
  console.log(`  Router: ${algebra.router}`);
  console.log(`  NFPM:   ${algebra.nfpm}`);
  console.log(`  Pool:   ${poolAddress}`);
  console.log(`  Tokens: ${supportedTokens.join(", ")}\n`);

  // Step 1: Deploy XCMProxy
  console.log("1. Deploying XCMProxy...");
  const XCMProxy = await ethers.getContractFactory("contracts/V1(Current)/XCMProxy.sol:XCMProxy");
  const proxy = await XCMProxy.deploy(deployer.address, { gasLimit: 15_000_000 });
  await proxy.waitForDeployment();
  const proxyAddress = await proxy.getAddress();
  console.log(`   Deployed at: ${proxyAddress}\n`);

  // Step 2: Configure integrations
  console.log("2. Configuring integrations...");
  let tx;

  tx = await proxy.setIntegrations(algebra.quoter, algebra.router);
  await tx.wait();
  console.log("   Set Quoter + Router");

  tx = await proxy.setNFPM(algebra.nfpm);
  await tx.wait();
  console.log("   Set NFPM");

  // Step 3: Configure XCM
  console.log("3. Configuring XCM...");
  tx = await proxy.setXcmPrecompile("0x000000000000000000000000000000000000081A");
  await tx.wait();
  console.log("   Set XCM precompile (PalletXcm)");

  tx = await proxy.setXcmTransactorPrecompile("0x0000000000000000000000000000000000000806");
  await tx.wait();
  console.log("   Set XCM Transactor precompile");

  tx = await proxy.setAssetHubParaId(420420422);
  await tx.wait();
  console.log("   Set Asset Hub ParaId = 420420422");

  tx = await proxy.setDefaultSlippageBps(100);
  await tx.wait();
  console.log("   Set default slippage = 100 bps (1%)");

  // Step 4: Enable test mode
  console.log("4. Enabling test mode...");
  tx = await proxy.setTestMode(true);
  await tx.wait();
  console.log("   Test mode enabled");

  // Step 5: Add supported tokens
  console.log("5. Adding supported tokens...");
  for (const token of supportedTokens) {
    tx = await proxy.addSupportedToken(token);
    await tx.wait();
    console.log(`   Added ${token}`);
  }

  // Step 6: Seed contract with test tokens for position execution
  console.log("6. Seeding contract with test tokens...");
  const seedAmount = ethers.parseEther("1000");
  const ERC20_ABI = ["function mint(address,uint256)", "function balanceOf(address) view returns (uint256)", "function symbol() view returns (string)"];

  for (const tokenAddr of supportedTokens) {
    const token = new ethers.Contract(tokenAddr, ERC20_ABI, deployer);
    try {
      const sym = await token.symbol();
      tx = await token.mint(proxyAddress, seedAmount);
      await tx.wait();
      const bal = await token.balanceOf(proxyAddress);
      console.log(`   ${sym}: minted ${ethers.formatEther(seedAmount)}, balance = ${ethers.formatEther(bal)}`);
    } catch (e) {
      console.log(`   ${tokenAddr}: mint failed (${e.message?.slice(0, 60)})`);
    }
  }

  // Step 7: Update bootstrap file
  console.log("7. Updating moonbase_bootstrap.json...");
  bootstrap.xcmProxy = {
    address: proxyAddress,
    operator: deployer.address,
    testMode: true,
    assetHubParaId: 420420422,
    defaultSlippageBps: 100,
    previousAddress: bootstrap.xcmProxy?.address || null,
    seedTarget: seedAmount.toString(),
    seededBalances: supportedTokens.map((t, i) => ({
      label: bootstrap.tokens?.[i]?.symbol || `TOKEN${i}`,
      token: t,
      balance: seedAmount.toString(),
      decimals: 18,
      status: "seeded",
    })),
  };
  bootstrap.generatedAt = new Date().toISOString();

  fs.writeFileSync(BOOTSTRAP_PATH, JSON.stringify(bootstrap, null, 2));
  console.log("   Bootstrap file updated\n");

  // Summary
  console.log("=== Deployment Complete ===");
  console.log(`XCMProxy: ${proxyAddress}`);
  console.log(`Network:  Moonbase Alpha (${network.chainId})`);
  console.log(`Test Mode: true`);
  console.log(`Tokens:   ${supportedTokens.length} supported`);
  console.log(`Pool:     ${poolAddress}\n`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Deployment failed:", error);
    process.exit(1);
  });
