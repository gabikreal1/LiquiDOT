// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

import "../IAlgebraPool.sol";

contract MockAlgebraPool is IAlgebraPool {
    address private _token0;
    address private _token1;
    int24 private _tickSpacing;
    uint128 private _globalLiquidity;
    int24 private _currentTick;

    struct PosKey { address owner; int24 bottomTick; int24 topTick; }
    mapping(bytes32 => uint128) private _liquidityByPos;

    constructor(address token0_, address token1_, int24 tickSpacing_) {
        _token0 = token0_;
        _token1 = token1_;
        _tickSpacing = tickSpacing_;
        _currentTick = 0;
    }

    function _posKey(address owner, int24 bottomTick, int24 topTick) private pure returns (bytes32) {
        return keccak256(abi.encode(owner, bottomTick, topTick));
    }

    function burn(
        int24 bottomTick,
        int24 topTick,
        uint128 amount
    ) external override returns (uint256 amount0, uint256 amount1) {
        bytes32 key = _posKey(msg.sender, bottomTick, topTick);
        uint128 liq = _liquidityByPos[key];
        require(liq >= amount, "insufficient liquidity");
        _liquidityByPos[key] = liq - amount;
        _globalLiquidity -= amount;
        // Simplified amounts: 1:1 with liquidity
        amount0 = amount;
        amount1 = amount;
    }

    function mint(
        address /*sender*/,
        address recipient,
        int24 bottomTick,
        int24 topTick,
        uint128 liquidityDesired,
        bytes calldata /*data*/
    ) external override returns (uint256 amount0, uint256 amount1) {
        bytes32 key = _posKey(recipient, bottomTick, topTick);
        _liquidityByPos[key] += liquidityDesired;
        _globalLiquidity += liquidityDesired;
        // Simplified amounts: 1:1 with liquidity
        amount0 = liquidityDesired;
        amount1 = liquidityDesired;
    }

    function globalState() external view override returns (
        uint160 sqrtPriceX96,
        int24 tick,
        uint128 liquidity
    ) {
        sqrtPriceX96 = 79228162514264337593543950336; // ~1.0 in Q64.96
        tick = _currentTick;
        liquidity = _globalLiquidity;
    }

    function token0() external view override returns (address) { return _token0; }
    function token1() external view override returns (address) { return _token1; }
    function tickSpacing() external view override returns (int24) { return _tickSpacing; }
    function maxLiquidityPerTick() external pure override returns (uint128) { return type(uint128).max; }

    function positions(
        address owner,
        int24 bottomTick,
        int24 topTick
    ) external view override returns (
        uint128 liquidity,
        uint256 feeGrowthInside0LastX128,
        uint256 feeGrowthInside1LastX128
    ) {
        bytes32 key = _posKey(owner, bottomTick, topTick);
        liquidity = _liquidityByPos[key];
        feeGrowthInside0LastX128 = 0;
        feeGrowthInside1LastX128 = 0;
    }
}


