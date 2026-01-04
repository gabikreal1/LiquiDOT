/**
 * Debug script to test executePendingInvestment step by step
 */

const { ethers } = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
    const [deployer] = await ethers.getSigners();
    console.log("Testing with account:", deployer.address);

    // Load bootstrap config
    const bootstrapPath = path.join(__dirname, "../deployments/moonbase_bootstrap.json");
    const bootstrap = JSON.parse(fs.readFileSync(bootstrapPath, "utf8"));

    const PROXY_ADDRESS = bootstrap.xcmProxy.address;
    const POOL_ADDRESS = bootstrap.pool.address;
    const TOKEN0 = bootstrap.pool.token0; // TOKB
    const TOKEN1 = bootstrap.pool.token1; // TOKA
    const BASE_TOKEN = TOKEN1; // TOKA
    
    console.log("\n📊 Configuration:");
    console.log(`   Proxy: ${PROXY_ADDRESS}`);
    console.log(`   Pool: ${POOL_ADDRESS}`);
    console.log(`   Token0 (TOKB): ${TOKEN0}`);
    console.log(`   Token1 (TOKA): ${TOKEN1}`);

    // Get contracts
    const XCMProxy = await ethers.getContractFactory("contracts/V1(Current)/XCMProxy.sol:XCMProxy");
    const proxy = XCMProxy.attach(PROXY_ADDRESS);
    
    const token0 = await ethers.getContractAt("IERC20", TOKEN0);
    const token1 = await ethers.getContractAt("IERC20", TOKEN1);
    const pool = await ethers.getContractAt("IAlgebraPool", POOL_ADDRESS);

    // Check pool state
    const globalState = await pool.globalState();
    const currentTick = globalState[1];
    const tickSpacing = await pool.tickSpacing();
    console.log(`\n🎯 Pool State:`);
    console.log(`   Current Tick: ${currentTick}`);
    console.log(`   Tick Spacing: ${tickSpacing}`);
    console.log(`   Pool Liquidity: ${await pool.liquidity()}`);

    // Step 1: Create a pending position
    const assetHubPositionId = ethers.keccak256(
        ethers.toUtf8Bytes(`debug-test-${Date.now()}`)
    );
    
    // Use the same amounts as in the test
    const amount0Desired = ethers.parseEther("0.5");
    const amount1Desired = ethers.parseEther("0.5");
    
    console.log(`\n📝 Creating pending position...`);
    console.log(`   Position ID: ${assetHubPositionId}`);
    console.log(`   Amount0 (TOKB): ${ethers.formatEther(amount0Desired)}`);
    console.log(`   Amount1 (TOKA): ${ethers.formatEther(amount1Desired)}`);

    const investmentParams = ethers.AbiCoder.defaultAbiCoder().encode(
        ["address", "address", "uint256[]", "int24", "int24", "address", "uint16"],
        [
            POOL_ADDRESS,
            BASE_TOKEN,
            [amount0Desired, amount1Desired],
            -50, // lowerRangePercent
            50,  // upperRangePercent
            deployer.address,
            5000 // slippageBps (50%)
        ]
    );

    // Note: receiveAssets expects the token to be the one sent, not the pool token order
    // The pending position will store the token sent and try to swap if needed
    const receiveTx = await proxy.receiveAssets(
        assetHubPositionId,
        BASE_TOKEN, // TOKA is sent
        deployer.address,
        ethers.parseEther("1.0"),
        investmentParams
    );
    await receiveTx.wait();
    console.log(`   ✓ Pending position created`);

    // Check pending position
    const pending = await proxy.pendingPositions(assetHubPositionId);
    console.log(`\n📋 Pending Position Details:`);
    console.log(`   Exists: ${pending.exists}`);
    console.log(`   Token: ${pending.token}`);
    console.log(`   Base Asset: ${pending.baseAsset}`);
    console.log(`   Amount: ${ethers.formatEther(pending.amount)}`);
    console.log(`   Pool ID: ${pending.poolId}`);
    console.log(`   User: ${pending.user}`);
    console.log(`   Lower Range %: ${pending.lowerRangePercent}`);
    console.log(`   Upper Range %: ${pending.upperRangePercent}`);
    console.log(`   Slippage BPS: ${pending.slippageBps}`);
    // pending.amounts might not be directly accessible as an array
    // Let's check what we actually get
    console.log(`   Amounts: ${JSON.stringify(pending.amounts)}`);

    // Fund the proxy with both tokens
    console.log(`\n💰 Funding proxy with tokens...`);
    
    const proxyBalance0 = await token0.balanceOf(PROXY_ADDRESS);
    const proxyBalance1 = await token1.balanceOf(PROXY_ADDRESS);
    console.log(`   Proxy Token0 balance: ${ethers.formatEther(proxyBalance0)}`);
    console.log(`   Proxy Token1 balance: ${ethers.formatEther(proxyBalance1)}`);

    // Transfer tokens to proxy if needed
    if (proxyBalance0 < amount0Desired) {
        const fundTx0 = await token0.transfer(PROXY_ADDRESS, amount0Desired);
        await fundTx0.wait();
        console.log(`   ✓ Funded proxy with ${ethers.formatEther(amount0Desired)} Token0`);
    }
    
    if (proxyBalance1 < amount1Desired) {
        const fundTx1 = await token1.transfer(PROXY_ADDRESS, amount1Desired);
        await fundTx1.wait();
        console.log(`   ✓ Funded proxy with ${ethers.formatEther(amount1Desired)} Token1`);
    }

    // Check balances again
    const proxyBalance0After = await token0.balanceOf(PROXY_ADDRESS);
    const proxyBalance1After = await token1.balanceOf(PROXY_ADDRESS);
    console.log(`   Proxy Token0 balance after: ${ethers.formatEther(proxyBalance0After)}`);
    console.log(`   Proxy Token1 balance after: ${ethers.formatEther(proxyBalance1After)}`);

    // Try to calculate tick range first (this is what the contract does)
    console.log(`\n🔢 Calculating tick range...`);
    try {
        const [bottomTick, topTick] = await proxy.calculateTickRange(POOL_ADDRESS, -50, 50);
        console.log(`   Bottom Tick: ${bottomTick}`);
        console.log(`   Top Tick: ${topTick}`);
    } catch (error) {
        console.log(`   ❌ calculateTickRange failed: ${error.message}`);
    }

    // Try to execute
    console.log(`\n🚀 Executing pending investment...`);
    try {
        const tx = await proxy.executePendingInvestment(assetHubPositionId, { gasLimit: 5000000 });
        const receipt = await tx.wait();
        console.log(`   ✓ Execution successful!`);
        console.log(`   Gas used: ${receipt.gasUsed.toString()}`);
        
        // Check position counter
        const counter = await proxy.positionCounter();
        console.log(`   Position counter: ${counter}`);
    } catch (error) {
        console.log(`   ❌ Execution failed: ${error.message}`);
        
        // Try static call to get the revert reason
        try {
            await proxy.executePendingInvestment.staticCall(assetHubPositionId);
        } catch (staticError) {
            console.log(`   Static call error: ${staticError.message}`);
            if (staticError.data) {
                console.log(`   Error data: ${staticError.data}`);
            }
        }
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
