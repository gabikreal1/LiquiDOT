/**
 * Test NFPM Liquidity Provision
 * 
 * Tests adding liquidity via NonfungiblePositionManager using NFPMLiquidityProvider helper
 */

const { ethers } = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  console.log("\n╔════════════════════════════════════════════════════════════╗");
  console.log("║        Test NFPM Liquidity Provision                       ║");
  console.log("╚════════════════════════════════════════════════════════════╝\n");

  const [provider] = await ethers.getSigners();
  const network = await ethers.provider.getNetwork();
  
  console.log(`Network: ${network.name} (${network.chainId})`);
  console.log(`Provider: ${provider.address}\n`);

  // Load Algebra deployment
  const algebraDeploymentFile = path.join(__dirname, `../deployments/${network.name}_algebra.json`);
  const algebraDeployment = JSON.parse(fs.readFileSync(algebraDeploymentFile, "utf8"));
  
  const factoryAddress = algebraDeployment.contracts.factory;
  const nfpmAddress = algebraDeployment.contracts.nfpm;
  const poolDeployerAddress = algebraDeployment.contracts.poolDeployer;

  console.log("Algebra Contracts:");
  console.log(`  Factory: ${factoryAddress}`);
  console.log(`  NFPM: ${nfpmAddress}`);
  console.log(`  PoolDeployer: ${poolDeployerAddress}\n`);

  // ===== STEP 1: Deploy Tokens =====
  console.log("STEP 1: Deploy Test Tokens");
  console.log("=".repeat(60));
  
  const TestERC20 = await ethers.getContractFactory("TestERC20");
  
  const tokenA = await TestERC20.deploy("Token A", "TKA");
  await tokenA.waitForDeployment();
  const tokenAAddress = await tokenA.getAddress();
  console.log(`✅ TokenA: ${tokenAAddress}`);

  const tokenB = await TestERC20.deploy("Token B", "TKB");
  await tokenB.waitForDeployment();
  const tokenBAddress = await tokenB.getAddress();
  console.log(`✅ TokenB: ${tokenBAddress}`);

  // Sort tokens
  const [token0Address, token1Address] = tokenAAddress.toLowerCase() < tokenBAddress.toLowerCase()
    ? [tokenAAddress, tokenBAddress]
    : [tokenBAddress, tokenAAddress];
  
  const token0 = token0Address === tokenAAddress ? tokenA : tokenB;
  const token1 = token1Address === tokenAAddress ? tokenA : tokenB;

  console.log(`\nSorted: token0=${token0Address.slice(0,10)}... < token1=${token1Address.slice(0,10)}...\n`);

  // ===== STEP 2: Create & Initialize Pool =====
  console.log("STEP 2: Create & Initialize Pool");
  console.log("=".repeat(60));

  const factory = await ethers.getContractAt(
    ["function createPool(address,address,bytes) external returns (address)",
     "function poolByPair(address,address) external view returns (address)"],
    factoryAddress
  );

  console.log("📦 Creating pool...");
  const createTx = await factory.createPool(token0Address, token1Address, "0x");
  await createTx.wait();

  const poolAddress = await factory.poolByPair(token0Address, token1Address);
  console.log(`✅ Pool: ${poolAddress}`);

  const pool = await ethers.getContractAt(
    ["function initialize(uint160) external",
     "function globalState() external view returns (uint160,int24,uint16,uint8,uint16,bool)"],
    poolAddress
  );

  console.log("📦 Initializing at 1:1 price...");
  const sqrtPrice = BigInt("79228162514264337593543950336");
  await (await pool.initialize(sqrtPrice)).wait();
  
  const state = await pool.globalState();
  console.log(`✅ Initialized at tick ${state[1]}\n`);

  // ===== STEP 3: Deploy NFPM Helper =====
  console.log("STEP 3: Deploy NFPMLiquidityProvider Helper");
  console.log("=".repeat(60));

  const NFPMLiquidityProvider = await ethers.getContractFactory("NFPMLiquidityProvider");
  const nfpmHelper = await NFPMLiquidityProvider.deploy();
  await nfpmHelper.waitForDeployment();
  const helperAddress = await nfpmHelper.getAddress();
  console.log(`✅ Helper deployed: ${helperAddress}\n`);

  // ===== STEP 4: Mint Liquidity via NFPM =====
  console.log("STEP 4: Mint Liquidity via NFPM");
  console.log("=".repeat(60));

  const amount = ethers.parseEther("10000");
  console.log(`📦 Minting ${ethers.formatEther(amount)} of each token...`);
  await (await token0.mint(provider.address, amount)).wait();
  await (await token1.mint(provider.address, amount)).wait();

  console.log("📦 Approving helper...");
  await (await token0.approve(helperAddress, ethers.MaxUint256)).wait();
  await (await token1.approve(helperAddress, ethers.MaxUint256)).wait();

  console.log("\n📦 Minting position via NFPM...");
  const tickLower = -86400;
  const tickUpper = 86400;
  const amount0 = ethers.parseEther("5000");
  const amount1 = ethers.parseEther("5000");

  console.log(`   Tick range: [${tickLower}, ${tickUpper}]`);
  console.log(`   Amount0: ${ethers.formatEther(amount0)}`);
  console.log(`   Amount1: ${ethers.formatEther(amount1)}`);

  try {
    const mintTx = await nfpmHelper.mintPosition(
      nfpmAddress,
      token0Address,
      token1Address,
      poolDeployerAddress,
      tickLower,
      tickUpper,
      amount0,
      amount1,
      provider.address,
      { gasLimit: 5000000 }
    );

    console.log("\n⏳ Waiting for confirmation...");
    const receipt = await mintTx.wait();
    console.log(`✅ Position minted! Tx: ${receipt.hash}`);

    // Find Transfer event to get NFT token ID
    const transferTopic = ethers.id("Transfer(address,address,uint256)");
    const transferEvent = receipt.logs.find(log => log.topics[0] === transferTopic);
    
    let tokenId;
    if (transferEvent) {
      tokenId = ethers.toBigInt(transferEvent.topics[3]);
      console.log(`✅ NFT Position ID: ${tokenId}`);

      // Get position details from NFPM
      const nfpm = await ethers.getContractAt(
        ["function positions(uint256) external view returns (uint88,address,address,address,address,int24,int24,uint128,uint256,uint256,uint128,uint128)"],
        nfpmAddress
      );

      const position = await nfpm.positions(tokenId);
      console.log(`\n📊 Position Details:`);
      console.log(`   Token0: ${position[2]}`);
      console.log(`   Token1: ${position[3]}`);
      console.log(`   Deployer: ${position[4]}`);
      console.log(`   Tick Lower: ${position[5]}`);
      console.log(`   Tick Upper: ${position[6]}`);
      console.log(`   Liquidity: ${position[7]}`);
    }

    // Save result
    const result = {
      network: network.name,
      pool: poolAddress,
      token0: token0Address,
      token1: token1Address,
      nftTokenId: tokenId ? tokenId.toString() : "unknown",
      txHash: receipt.hash,
      timestamp: new Date().toISOString()
    };

    const outputFile = path.join(__dirname, "../deployments/test-nfpm-result.json");
    fs.writeFileSync(outputFile, JSON.stringify(result, null, 2));

    console.log("\n╔════════════════════════════════════════════════════════════╗");
    console.log("║           NFPM LIQUIDITY SUCCESS! 🎉                       ║");
    console.log("╚════════════════════════════════════════════════════════════╝");
    console.log(`\n✅ NFPM Position NFT ID: ${tokenId}`);
    console.log(`✅ Pool: ${poolAddress}`);
    console.log(`✅ Token0: ${token0Address}`);
    console.log(`✅ Token1: ${token1Address}`);
    console.log(`\n🎯 NFPM liquidity provision is now working!`);
    console.log(`🎯 You can use this NFPMLiquidityProvider contract in production!`);

    return result;

  } catch (error) {
    console.error("\n❌ NFPM mint failed:", error.message);
    
    if (error.data) {
      console.error("Error data:", error.data);
    }

    // Try to understand the error
    console.log("\n🔍 Debugging info:");
    console.log(`   Helper has callback: algebraMintCallback`);
    console.log(`   NFPM address: ${nfpmAddress}`);
    console.log(`   PoolDeployer: ${poolDeployerAddress}`);
    
    throw error;
  }
}

if (require.main === module) {
  main()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error("\n❌ Test failed");
      process.exit(1);
    });
}

module.exports = { main };



