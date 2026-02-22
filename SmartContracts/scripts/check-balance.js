const { ethers } = require("hardhat");
async function main() {
  const [deployer] = await ethers.getSigners();
  const balance = await ethers.provider.getBalance(deployer.address);
  console.log("Deployer:", deployer.address);
  console.log("Balance:", ethers.formatEther(balance), "DEV");
  console.log("Network:", (await ethers.provider.getNetwork()).chainId.toString());
}
main().catch(console.error);
