// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity >=0.8.0;
pragma abicoder v2;

/**
 * @title IAlgebraPool
 * @dev Interface for Algebra Pool on Moonbase network
 */
interface IAlgebraPool {
    /**
     * @notice Burn liquidity from the sender and account tokens owed for the liquidity to the position
     * @param bottomTick The lower tick of the position for which to burn liquidity
     * @param topTick The upper tick of the position for which to burn liquidity
     * @param amount How much liquidity to burn
     * @return amount0 The amount of token0 sent to the recipient
     * @return amount1 The amount of token1 sent to the recipient
     */
    function burn(
        int24 bottomTick,
        int24 topTick,
        uint128 amount
    ) external returns (uint256 amount0, uint256 amount1);

    /**
     * @notice Adds liquidity for the given recipient/bottomTick/topTick position
     * @param sender The address which will receive potential surplus of paid tokens
     * @param recipient The address for which the liquidity will be created
     * @param bottomTick The lower tick of the position in which to add liquidity
     * @param topTick The upper tick of the position in which to add liquidity
     * @param liquidityDesired How much liquidity to add
     * @param data Any data that should be passed through to the callback
     * @return amount0 The amount of token0 that was paid to mint the given amount of liquidity
     * @return amount1 The amount of token1 that was paid to mint the given amount of liquidity
     */
    function mint(
        address sender,
        address recipient,
        int24 bottomTick,
        int24 topTick,
        uint128 liquidityDesired,
        bytes calldata data
    ) external returns (uint256 amount0, uint256 amount1);
    
    /**
     * @notice Returns the current state of the pool
     * @return sqrtPriceX96 The current price of the pool as a sqrt(token1/token0) Q64.96 value
     * @return tick The current tick of the pool, i.e. according to the last tick transition that was run
     * @return liquidity The current global liquidity of the pool
     */
    function globalState() external view returns (
        uint160 sqrtPriceX96,
        int24 tick,
        uint128 liquidity
    );
    
    /**
     * @notice The first of the two tokens of the pool, sorted by address
     * @return The token contract address
     */
    function token0() external view returns (address);
    
    /**
     * @notice The second of the two tokens of the pool, sorted by address
     * @return The token contract address
     */
    function token1() external view returns (address);
    
    /**
     * @notice The pool tick spacing
     * @dev Ticks can only be used at multiples of this value
     * @return The tick spacing
     */
    function tickSpacing() external view returns (int24);
    
    /**
     * @notice The maximum amount of liquidity per tick
     * @return The max liquidity per tick
     */
    function maxLiquidityPerTick() external view returns (uint128);
    
    /**
     * @notice Returns information about a position
     * @param owner The address of the position owner
     * @param bottomTick The lower tick boundary of the position
     * @param topTick The upper tick boundary of the position
     * @return liquidity The amount of liquidity in the position
     * @return feeGrowthInside0LastX128 Fee growth of token0 inside the position's tick boundaries
     * @return feeGrowthInside1LastX128 Fee growth of token1 inside the position's tick boundaries
     */
    function positions(
        address owner,
        int24 bottomTick,
        int24 topTick
    ) external view returns (
        uint128 liquidity,
        uint256 feeGrowthInside0LastX128,
        uint256 feeGrowthInside1LastX128
    );
} 