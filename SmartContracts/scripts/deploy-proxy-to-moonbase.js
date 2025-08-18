const {ethers} = require("hardhat");

async function main() {
  console.log("Deploying XCMProxy to Moonbase...");

  // Get the contract factory
  const XCMProxy = await ethers.getContractFactory("XCMProxy");

  // Deploy with explicit owner
  const [deployer] = await ethers.getSigners();
  const proxy = await XCMProxy.deploy(deployer.address);
  await proxy.waitForDeployment();

  console.log(`XCMProxy deployed to Moonbeam Mainnet at: ${await proxy.getAddress()}`);
  console.log("IMPORTANT: After deploying AILiquidityProvider to Asset Hub, you'll need to update the owner of this proxy.");
  console.log(`Run this command to save the proxy address to your .env file:`);
  console.log(`echo "MOONBEAM_PROXY_ADDRESS=${proxy.address}" >> .env`);
}

// Execute the deployment
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  }); 