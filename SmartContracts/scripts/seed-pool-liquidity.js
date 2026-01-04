/**
 * Script to provide initial liquidity to the TOKA/TOKB pool on Moonbase Alpha.
 * This seeds the Algebra pool with liquidity so that tests can execute successfully.
 * 
 * Usage:
 *   npx hardhat run scripts/seed-pool-liquidity.js --network moonbase
 */

const { ethers } = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
    const [deployer] = await ethers.getSigners();
    console.log("Seeding pool liquidity with account:", deployer.address);

    // Load bootstrap config
    const bootstrapPath = path.join(__dirname, "../deployments/moonbase_bootstrap.json");
    const bootstrap = JSON.parse(fs.readFileSync(bootstrapPath, "utf8"));

    const NFPM_ADDRESS = bootstrap.algebra.nfpm;
    const POOL_ADDRESS = bootstrap.pool.address;
    const TOKEN0 = bootstrap.pool.token0; // TOKB
    const TOKEN1 = bootstrap.pool.token1; // TOKA
    
    console.log("\n📊 Pool Configuration:");
    console.log(`   Pool: ${POOL_ADDRESS}`);
    console.log(`   Token0: ${TOKEN0}`);
    console.log(`   Token1: ${TOKEN1}`);
    console.log(`   NFPM: ${NFPM_ADDRESS}`);

    // Get contracts
    const token0 = await ethers.getContractAt("IERC20", TOKEN0);
    const token1 = await ethers.getContractAt("IERC20", TOKEN1);
    
    // Check balances
    const balance0 = await token0.balanceOf(deployer.address);
    const balance1 = await token1.balanceOf(deployer.address);
    
    console.log(`\n💰 Deployer Balances:`);
    console.log(`   Token0: ${ethers.formatEther(balance0)}`);
    console.log(`   Token1: ${ethers.formatEther(balance1)}`);

    // Amounts to provide (100 of each token)
    const amount0Desired = ethers.parseEther("100");
    const amount1Desired = ethers.parseEther("100");

    if (balance0 < amount0Desired || balance1 < amount1Desired) {
        console.error("\n❌ Insufficient token balances to seed liquidity");
        console.log(`   Need: ${ethers.formatEther(amount0Desired)} Token0, ${ethers.formatEther(amount1Desired)} Token1`);
        process.exit(1);
    }

    // Get NFPM contract - using the Algebra Integral interface with deployer field
    const NFPM_ABI = [
        "function mint((address token0, address token1, address deployer, int24 tickLower, int24 tickUpper, uint256 amount0Desired, uint256 amount1Desired, uint256 amount0Min, uint256 amount1Min, address recipient, uint256 deadline)) external payable returns (uint256 tokenId, uint128 liquidity, uint256 amount0, uint256 amount1)",
        "function positions(uint256 tokenId) external view returns (uint88 nonce, address operator, address token0, address token1, int24 tickLower, int24 tickUpper, uint128 liquidity, uint256 feeGrowthInside0LastX128, uint256 feeGrowthInside1LastX128, uint128 tokensOwed0, uint128 tokensOwed1)"
    ];
    const nfpm = new ethers.Contract(NFPM_ADDRESS, NFPM_ABI, deployer);

    // Get pool to check current tick
    const pool = await ethers.getContractAt("IAlgebraPool", POOL_ADDRESS);
    const globalState = await pool.globalState();
    const currentTick = globalState[1];
    const tickSpacing = await pool.tickSpacing();
    
    console.log(`\n🎯 Pool State:`);
    console.log(`   Current Tick: ${currentTick}`);
    console.log(`   Tick Spacing: ${tickSpacing}`);

    // Calculate tick range - wide range around current tick
    // Snap to tick spacing
    const tickLower = Math.floor(Number(currentTick) / Number(tickSpacing)) * Number(tickSpacing) - Number(tickSpacing) * 100;
    const tickUpper = Math.floor(Number(currentTick) / Number(tickSpacing)) * Number(tickSpacing) + Number(tickSpacing) * 100;
    
    console.log(`   Tick Range: ${tickLower} to ${tickUpper}`);

    // Approve NFPM to spend tokens
    console.log("\n🔐 Approving tokens...");
    
    const approve0Tx = await token0.approve(NFPM_ADDRESS, amount0Desired);
    await approve0Tx.wait();
    console.log(`   ✓ Token0 approved`);
    
    const approve1Tx = await token1.approve(NFPM_ADDRESS, amount1Desired);
    await approve1Tx.wait();
    console.log(`   ✓ Token1 approved`);

    // Mint liquidity position
    console.log("\n🌊 Minting liquidity position...");
    
    const deadline = Math.floor(Date.now() / 1000) + 3600; // 1 hour from now
    
    const mintParams = {
        token0: TOKEN0,
        token1: TOKEN1,
        deployer: ethers.ZeroAddress, // Required for Algebra Integral
        tickLower: tickLower,
        tickUpper: tickUpper,
        amount0Desired: amount0Desired,
        amount1Desired: amount1Desired,
        amount0Min: 0, // Accept any amount (for testing)
        amount1Min: 0, // Accept any amount (for testing)
        recipient: deployer.address,
        deadline: deadline
    };

    try {
        const mintTx = await nfpm.mint(mintParams, { gasLimit: 5000000 });
        const receipt = await mintTx.wait();
        
        console.log(`   ✓ Liquidity minted!`);
        console.log(`   Transaction: ${receipt.hash}`);
        
        // Parse events to get position details
        // Look for Transfer event or IncreaseLiquidity
        console.log(`   Gas used: ${receipt.gasUsed.toString()}`);
        
    } catch (error) {
        console.error("\n❌ Mint failed:", error.message);
        
        // Try to get more details
        if (error.data) {
            console.log("Error data:", error.data);
        }
        process.exit(1);
    }

    // Check pool liquidity after
    const poolLiquidityAfter = await pool.liquidity();
    console.log(`\n📊 Pool Liquidity After: ${poolLiquidityAfter.toString()}`);

    // Update bootstrap with new liquidity info
    bootstrap.pool.liquidity = poolLiquidityAfter.toString();
    fs.writeFileSync(bootstrapPath, JSON.stringify(bootstrap, null, 2));
    console.log(`\n✅ Bootstrap config updated with new liquidity!`);
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
