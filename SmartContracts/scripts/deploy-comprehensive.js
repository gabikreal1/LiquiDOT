const { ethers } = require("hardhat");
const fs = require("fs");
const path = require("path");

// Deployment configuration
const DEPLOYMENT_CONFIG = {
  assetHubChopsticks: {
    networkName: "assetHubChopsticks",
    contracts: ["MockERC20", "AssetHubVault"],
    mockTokens: [
      { name: "DOT", symbol: "DOT", decimals: 10, supply: "1000000" },
      { name: "USDC", symbol: "USDC", decimals: 6, supply: "1000000" }
    ]
  },
  moonbaseChopsticks: {
    networkName: "moonbaseChopsticks", 
    contracts: ["XCMProxy", "MockERC20"],
    mockTokens: [
      { name: "GLMR", symbol: "GLMR", decimals: 18, supply: "1000000" },
      { name: "USDT", symbol: "USDT", decimals: 6, supply: "1000000" }
    ]
  }
};

class DeploymentManager {
  constructor(network) {
    this.network = network;
    this.deployments = {};
    this.deploymentsDir = path.join(__dirname, "../deployments");
    this.deploymentFile = path.join(this.deploymentsDir, `${network}.json`);
    
    // Ensure deployments directory exists
    if (!fs.existsSync(this.deploymentsDir)) {
      fs.mkdirSync(this.deploymentsDir, { recursive: true });
    }
    
    // Load existing deployments
    this.loadDeployments();
  }

  loadDeployments() {
    if (fs.existsSync(this.deploymentFile)) {
      try {
        this.deployments = JSON.parse(fs.readFileSync(this.deploymentFile, "utf8"));
        console.log(`📁 Loaded existing deployments for ${this.network}`);
      } catch (error) {
        console.log(`⚠️  Error loading deployments: ${error.message}`);
        this.deployments = {};
      }
    } else {
      this.deployments = {};
    }
  }

  saveDeployments() {
    const deploymentData = {
      network: this.network,
      chainId: this.deployments.chainId || null,
      timestamp: new Date().toISOString(),
      contracts: this.deployments.contracts || {},
      transactions: this.deployments.transactions || []
    };

    fs.writeFileSync(this.deploymentFile, JSON.stringify(deploymentData, null, 2));
    console.log(`💾 Saved deployments to ${this.deploymentFile}`);
  }

  async recordDeployment(contractName, contract, constructorArgs = []) {
    const [deployer] = await ethers.getSigners();
    const network = await ethers.provider.getNetwork();
    
    const deploymentRecord = {
      address: await contract.getAddress(),
      deployer: deployer.address,
      blockNumber: contract.deploymentTransaction()?.blockNumber,
      transactionHash: contract.deploymentTransaction()?.hash,
      timestamp: new Date().toISOString(),
      constructorArgs,
      gasUsed: contract.deploymentTransaction()?.gasLimit?.toString()
    };

    if (!this.deployments.contracts) {
      this.deployments.contracts = {};
    }
    
    if (!this.deployments.transactions) {
      this.deployments.transactions = [];
    }

    this.deployments.chainId = Number(network.chainId);
    this.deployments.contracts[contractName] = deploymentRecord;
    this.deployments.transactions.push({
      type: "deployment",
      contract: contractName,
      ...deploymentRecord
    });

    console.log(`📝 Recorded deployment: ${contractName} at ${deploymentRecord.address}`);
    return deploymentRecord;
  }

  getContractAddress(contractName) {
    return this.deployments.contracts?.[contractName]?.address;
  }
}

async function deployMockERC20(manager, tokenConfig) {
  console.log(`🪙 Deploying MockERC20: ${tokenConfig.name}...`);
  
  const MockERC20 = await ethers.getContractFactory("MockERC20");
  const initialSupply = ethers.parseUnits(tokenConfig.supply, tokenConfig.decimals);
  
  const mockToken = await MockERC20.deploy(
    tokenConfig.name,
    tokenConfig.symbol, 
    tokenConfig.decimals,
    initialSupply
  );
  
  await mockToken.waitForDeployment();
  
  const contractName = `MockERC20_${tokenConfig.symbol}`;
  await manager.recordDeployment(contractName, mockToken, [
    tokenConfig.name,
    tokenConfig.symbol,
    tokenConfig.decimals, 
    initialSupply.toString()
  ]);
  
  console.log(`✅ ${tokenConfig.name} (${tokenConfig.symbol}) deployed at: ${await mockToken.getAddress()}`);
  return mockToken;
}

async function deployAssetHubVault(manager) {
  console.log(`🏦 Deploying AssetHubVault...`);
  
  const AssetHubVault = await ethers.getContractFactory("AssetHubVault");
  const vault = await AssetHubVault.deploy();
  
  await vault.waitForDeployment();
  await manager.recordDeployment("AssetHubVault", vault);
  
  console.log(`✅ AssetHubVault deployed at: ${await vault.getAddress()}`);
  return vault;
}

async function deployXCMProxy(manager) {
  console.log(`🌉 Deploying XCMProxy...`);
  
  const XCMProxy = await ethers.getContractFactory("XCMProxy");
  const proxy = await XCMProxy.deploy();
  
  await proxy.waitForDeployment();
  await manager.recordDeployment("XCMProxy", proxy);
  
  console.log(`✅ XCMProxy deployed at: ${await proxy.getAddress()}`);
  return proxy;
}

async function setupInitialConfiguration(manager, deployedContracts, config) {
  console.log(`⚙️  Setting up initial configuration...`);
  
  if (deployedContracts.AssetHubVault && config.networkName === "assetHubChopsticks") {
    const vault = deployedContracts.AssetHubVault;
    
    // Set up proper SCALE-encoded XCM configuration for Asset Hub Vault
    try {
      console.log(`   🔧 Configuring XCM destination for Moonbase Alpha...`);
      
      // Use the built-in helper to set Moonbase as destination
      const tx1 = await vault.setDestinationToMoonbase();
      await tx1.wait();
      console.log(`   ✅ Moonbase destination configured with SCALE encoding`);
      
      // Set up allowed destination contracts
      const exampleXCMProxy = "0xf24FF3a9CF04c71Dbc94D0b566f7A27B94566cac"; // Alith address for testing
      const tx2 = await vault.setAllowedDestination(exampleXCMProxy, true);
      await tx2.wait();
      console.log(`   🔧 Allowed destination set: ${exampleXCMProxy}`);
      
      // Get encoded locations for verification
      const encodedMoonbase = await vault.getEncodedMoonbaseLocation();
      const encodedAccount = await vault.getEncodedMoonbaseAccountLocation(exampleXCMProxy);
      
      console.log(`   📝 Encoded Moonbase location: ${encodedMoonbase}`);
      console.log(`   📝 Encoded account location: ${encodedAccount}`);
      
      console.log(`   ✅ AssetHubVault XCM configuration completed with proper SCALE encoding`);
    } catch (error) {
      console.log(`   ⚠️  XCM configuration error: ${error.message}`);
    }
  }
  
  console.log(`✅ Initial configuration completed`);
}

async function main() {
  const [deployer] = await ethers.getSigners();
  const network = hre.network.name;
  
  console.log(`🚀 Starting comprehensive deployment on ${network}`);
  console.log(`👤 Deployer: ${deployer.address}`);
  console.log(`💰 Balance: ${ethers.formatEther(await ethers.provider.getBalance(deployer.address))} ETH\n`);

  // Get deployment configuration
  const config = DEPLOYMENT_CONFIG[network];
  if (!config) {
    throw new Error(`No deployment configuration found for network: ${network}`);
  }

  // Initialize deployment manager
  const manager = new DeploymentManager(network);
  const deployedContracts = {};

  try {
    // Deploy Mock ERC20 tokens
    for (const tokenConfig of config.mockTokens) {
      deployedContracts[`MockERC20_${tokenConfig.symbol}`] = await deployMockERC20(manager, tokenConfig);
    }

    // Deploy contracts based on network
    if (config.contracts.includes("AssetHubVault")) {
      deployedContracts.AssetHubVault = await deployAssetHubVault(manager);
    }

    if (config.contracts.includes("XCMProxy")) {
      deployedContracts.XCMProxy = await deployXCMProxy(manager);
    }

    // Setup initial configuration
    await setupInitialConfiguration(manager, deployedContracts, config);

    // Save all deployments
    manager.saveDeployments();

    console.log(`\n🎉 Deployment completed successfully!`);
    console.log(`📄 Deployment details saved to: deployments/${network}.json`);
    
    // Print summary
    console.log(`\n📋 Deployment Summary:`);
    Object.entries(deployedContracts).forEach(([name, contract]) => {
      console.log(`   ${name}: ${contract.target}`);
    });

  } catch (error) {
    console.error(`❌ Deployment failed:`, error);
    manager.saveDeployments(); // Save partial deployments
    process.exit(1);
  }
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
