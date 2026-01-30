const { ethers } = require("hardhat");
const { getMoonbaseTestConfig } = require("./test/XCMProxy/testnet/config");

async function main() {
    const moonbase = getMoonbaseTestConfig();
    const POOL_ID = moonbase.poolAddress;
    console.log(`Checking pool at ${POOL_ID}...`);

    const code = await ethers.provider.getCode(POOL_ID);
    if (code === "0x") {
        console.log("❌ No code at pool address!");
    } else {
        console.log("✅ Code found at pool address.");
    }

    try {
        const pool = await ethers.getContractAt("IAlgebraPool", POOL_ID);
        const globalState = await pool.globalState();
        console.log("✅ globalState() call successful:", globalState);
        
        const tickSpacing = await pool.tickSpacing();
        console.log("✅ tickSpacing() call successful:", tickSpacing);
    } catch (error) {
        console.log("❌ globalState() or tickSpacing() call failed:", error.message);
    }
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
