const { ethers } = require("hardhat");

async function main() {
    console.log("\n╔════════════════════════════════════════════════════════════╗");
    console.log("║      Deploying XcmExecuteAdapter (V4 / Weight First)      ║");
    console.log("╚════════════════════════════════════════════════════════════╝\n");

    const [deployer] = await ethers.getSigners();
    console.log("   Deployer:", deployer.address);
    console.log("   Balance:", ethers.formatUnits(await ethers.provider.getBalance(deployer.address), 18), "DOT");

    // 1. Deploy XcmExecuteAdapter
    console.log("\n   Deploying XcmExecuteAdapter...");
    const AdapterFactory = await ethers.getContractFactory("XcmExecuteAdapter");
    const adapter = await AdapterFactory.deploy();
    await adapter.waitForDeployment();
    const adapterAddress = await adapter.getAddress();

    console.log("   ✅ XcmExecuteAdapter Deployed at:", adapterAddress);
    console.log("   (Please update VAULT configuration with this address)");
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
