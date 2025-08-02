const { ethers } = require("hardhat");
const { ApiPromise, WsProvider } = require('@polkadot/api');

// Change to SmartContracts directory for Hardhat
process.chdir('../SmartContracts');

async function testLocalSetup() {
  console.log("🧪 Testing LiquiDOT local development setup...\n");

  // Test 1: Check if local nodes are running
  console.log("1️⃣ Testing local node connectivity...");
  
  try {
    // Test Asset Hub local node
    const assetHubProvider = new WsProvider('ws://localhost:9944');
    const assetHubApi = await ApiPromise.create({ provider: assetHubProvider });
    
    const assetHubChain = await assetHubApi.rpc.system.chain();
    const assetHubVersion = await assetHubApi.rpc.system.version();
    
    console.log("✅ Asset Hub Local Node:");
    console.log("   Chain:", assetHubChain.toString());
    console.log("   Version:", assetHubVersion.toString());
    console.log("   RPC URL: ws://localhost:9944");
    
    await assetHubApi.disconnect();
  } catch (error) {
    console.log("❌ Asset Hub local node not accessible:", error.message);
  }

  try {
    // Test Moonbeam local node
    const moonbeamProvider = new WsProvider('ws://localhost:9945');
    const moonbeamApi = await ApiPromise.create({ provider: moonbeamProvider });
    
    const moonbeamChain = await moonbeamApi.rpc.system.chain();
    const moonbeamVersion = await moonbeamApi.rpc.system.version();
    
    console.log("✅ Moonbeam Local Node:");
    console.log("   Chain:", moonbeamChain.toString());
    console.log("   Version:", moonbeamVersion.toString());
    console.log("   RPC URL: ws://localhost:9945");
    
    await moonbeamApi.disconnect();
  } catch (error) {
    console.log("❌ Moonbeam local node not accessible:", error.message);
  }

  // Test 2: Check Hardhat network connectivity
  console.log("\n2️⃣ Testing Hardhat network connectivity...");
  
  try {
    const [signer] = await ethers.getSigners();
    const balance = await signer.getBalance();
    const address = await signer.getAddress();
    
    console.log("✅ Hardhat Network:");
    console.log("   Signer Address:", address);
    console.log("   Balance:", ethers.utils.formatEther(balance), "ETH");
  } catch (error) {
    console.log("❌ Hardhat network not accessible:", error.message);
  }

  // Test 3: Test contract deployment to local nodes
  console.log("\n3️⃣ Testing contract deployment to local nodes...");
  
  try {
    // Test deployment to Asset Hub local
    console.log("   Testing Asset Hub local deployment...");
    const assetHubVault = await ethers.getContractFactory("AssetHubVault");
    const vault = await assetHubVault.deploy();
    await vault.deployed();
    console.log("   ✅ Asset Hub Vault deployed to:", vault.address);
  } catch (error) {
    console.log("   ❌ Asset Hub local deployment failed:", error.message);
  }

  try {
    // Test deployment to Moonbeam local
    console.log("   Testing Moonbeam local deployment...");
    const xcmProxy = await ethers.getContractFactory("XCMProxy");
    const proxy = await xcmProxy.deploy();
    await proxy.deployed();
    console.log("   ✅ XCM Proxy deployed to:", proxy.address);
  } catch (error) {
    console.log("   ❌ Moonbeam local deployment failed:", error.message);
  }

  // Test 4: Check database connectivity
  console.log("\n4️⃣ Testing database connectivity...");
  
  try {
    const { Client } = require('pg');
    const client = new Client({
      host: 'localhost',
      port: 5432,
      database: 'liquidot_dev',
      user: 'liquidot_user',
      password: 'liquidot_password'
    });
    
    await client.connect();
    const result = await client.query('SELECT NOW()');
    console.log("✅ PostgreSQL Database:");
    console.log("   Connected successfully");
    console.log("   Current time:", result.rows[0].now);
    await client.end();
  } catch (error) {
    console.log("❌ PostgreSQL not accessible:", error.message);
  }

  // Test 5: Check Redis connectivity
  console.log("\n5️⃣ Testing Redis connectivity...");
  
  try {
    const redis = require('redis');
    const client = redis.createClient({
      url: 'redis://localhost:6379'
    });
    
    await client.connect();
    await client.ping();
    console.log("✅ Redis Cache:");
    console.log("   Connected successfully");
    await client.disconnect();
  } catch (error) {
    console.log("❌ Redis not accessible:", error.message);
  }

  // Test 6: Check XCM Relayer
  console.log("\n6️⃣ Testing XCM Relayer...");
  
  try {
    const response = await fetch('http://localhost:8000/health');
    if (response.ok) {
      console.log("✅ XCM Relayer:");
      console.log("   Service is running");
    } else {
      console.log("❌ XCM Relayer not responding properly");
    }
  } catch (error) {
    console.log("❌ XCM Relayer not accessible:", error.message);
  }

  console.log("\n🎯 Test Summary:");
  console.log("   If all tests passed, your local development environment is ready!");
  console.log("   If some tests failed, check the service status with: docker-compose ps");
  console.log("   For logs: docker-compose logs -f [service-name]");
}

// Run the test
testLocalSetup()
  .then(() => {
    console.log("\n✅ Local setup test completed!");
    process.exit(0);
  })
  .catch((error) => {
    console.error("\n❌ Test failed:", error);
    process.exit(1);
  }); 