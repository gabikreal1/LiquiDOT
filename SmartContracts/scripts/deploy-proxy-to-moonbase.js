const hre = require("hardhat");

async function main() {
  console.log("Deploying XCMProxy to Moonbase Alpha...");

  // Get the contract factory
  const XCMProxy = await hre.ethers.getContractFactory("XCMProxy");

  // For initial deployment, we'll set a placeholder owner that will be updated later
  // This is temporary and will be updated to the Asset Hub contract's address after it's deployed
  const [deployer] = await hre.ethers.getSigners();
  const placeholderOwner = deployer.address;
  console.log(`Using placeholder owner: ${placeholderOwner}`);

  // Deploy the contract
  const proxy = await XCMProxy.deploy(placeholderOwner);
  await proxy.deployed();

  console.log(`XCMProxy deployed to Moonbase Alpha at: ${proxy.address}`);
  console.log("IMPORTANT: After deploying AILiquidityProvider to Asset Hub, you'll need to update the owner of this proxy.");
  console.log(`Run this command to save the proxy address to your .env file:`);
  console.log(`echo "PROXY_ADDRESS=${proxy.address}" >> .env`);
}

// Execute the deployment
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  }); 