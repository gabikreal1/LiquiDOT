// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity >=0.8.0;

/**
 * @title IAlgebraMintCallback
 * @notice Interface for the Algebra Mint Callback
 */
interface IAlgebraMintCallback {
    /**
     * @notice Called to `msg.sender` after minting liquidity to a position
     * @dev In the implementation, must pay any token0 or token1 owed for the liquidity
     * The amount of token0/token1 due depends on bottomTick, topTick, the amount of liquidity, and the current price
     * @param amount0 The amount of token0 due to the pool for the minted liquidity
     * @param amount1 The amount of token1 due to the pool for the minted liquidity
     * @param data Any data passed through by the caller via the mint call
     */
    function algebraMintCallback(
        uint256 amount0,
        uint256 amount1,
        bytes calldata data
    ) external;
} 