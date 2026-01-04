// Helper for Paseo Asset Hub transactions
// This chain requires explicit gas estimation to avoid "Invalid Transaction" errors

const { ethers } = require("hardhat");

/**
 * Wait for a specified time
 * @param {number} ms - milliseconds to wait
 */
async function wait(ms = 2000) {
  await new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Execute a deposit with proper gas limit for Paseo Asset Hub
 * @param {Contract} vault - The vault contract
 * @param {Signer} user - The user signer
 * @param {BigInt} amount - Amount to deposit
 * @returns {Promise<TransactionReceipt>}
 */
async function safeDeposit(vault, user, amount) {
  // Use a fixed high gas limit - Paseo doesn't like estimateGas via hardhat
  const tx = await vault.connect(user).deposit({ 
    value: amount, 
    gasLimit: 500000 
  });
  const receipt = await tx.wait();
  await wait(2000); // Wait for state propagation
  return receipt;
}

/**
 * Execute a withdraw with proper gas limit for Paseo Asset Hub
 * @param {Contract} vault - The vault contract
 * @param {Signer} user - The user signer
 * @param {BigInt} amount - Amount to withdraw
 * @returns {Promise<TransactionReceipt>}
 */
async function safeWithdraw(vault, user, amount) {
  const tx = await vault.connect(user).withdraw(amount, { gasLimit: 500000 });
  const receipt = await tx.wait();
  await wait(2000);
  return receipt;
}

/**
 * Execute dispatchInvestment with proper gas limit
 */
async function safeDispatchInvestment(vault, operator, params) {
  const tx = await vault.connect(operator).dispatchInvestment(
    params.user,
    params.chainId,
    params.poolId,
    params.baseAsset,
    params.amount,
    params.lowerRange,
    params.upperRange,
    params.destination,
    params.xcmMessage,
    { gasLimit: 1000000 }
  );
  const receipt = await tx.wait();
  await wait(2000);
  return receipt;
}

/**
 * Execute confirmExecution with proper gas limit
 */
async function safeConfirmExecution(vault, caller, positionId, remotePositionId, liquidity) {
  const tx = await vault.connect(caller).confirmExecution(
    positionId,
    remotePositionId,
    liquidity,
    { gasLimit: 500000 }
  );
  const receipt = await tx.wait();
  await wait(2000);
  return receipt;
}

/**
 * Execute settleLiquidation with proper gas limit
 */
async function safeSettleLiquidation(vault, caller, positionId, receivedAmount) {
  const tx = await vault.connect(caller).settleLiquidation(
    positionId,
    receivedAmount,
    { gasLimit: 500000 }
  );
  const receipt = await tx.wait();
  await wait(2000);
  return receipt;
}

/**
 * Execute pause with proper gas limit
 */
async function safePause(vault, admin) {
  const tx = await vault.connect(admin).pause({ gasLimit: 500000 });
  const receipt = await tx.wait();
  await wait(2000);
  return receipt;
}

/**
 * Execute unpause with proper gas limit
 */
async function safeUnpause(vault, admin) {
  const tx = await vault.connect(admin).unpause({ gasLimit: 500000 });
  const receipt = await tx.wait();
  await wait(2000);
  return receipt;
}

/**
 * Execute emergencyLiquidatePosition with proper gas limit
 */
async function safeEmergencyLiquidate(vault, emergency, chainId, positionId, value = 0n) {
  const tx = await vault.connect(emergency).emergencyLiquidatePosition(
    chainId,
    positionId,
    { gasLimit: 500000, value }
  );
  const receipt = await tx.wait();
  await wait(2000);
  return receipt;
}

module.exports = {
  wait,
  safeDeposit,
  safeWithdraw,
  safeDispatchInvestment,
  safeConfirmExecution,
  safeSettleLiquidation,
  safePause,
  safeUnpause,
  safeEmergencyLiquidate
};
