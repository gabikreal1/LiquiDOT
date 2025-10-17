// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.20;

contract MockAlgebraPool {
    address private immutable _token0;
    address private immutable _token1;
    int24 private immutable _spacing;
    uint160 private _price;
    int24 private _tick;

    constructor(address token0_, address token1_, int24 spacing_, uint160 price_, int24 tick_) {
        _token0 = token0_;
        _token1 = token1_;
        _spacing = spacing_;
        _price = price_;
        _tick = tick_;
    }

    function setState(uint160 price_, int24 tick_) external {
        _price = price_;
        _tick = tick_;
    }

    function token0() external view returns (address) {
        return _token0;
    }

    function token1() external view returns (address) {
        return _token1;
    }

    function tickSpacing() external view returns (int24) {
        return _spacing;
    }

    function globalState()
        external
        view
        returns (uint160 price, int24 tick, uint16 lastFee, uint8 pluginConfig, uint16 communityFee, bool unlocked)
    {
        return (_price, _tick, 0, 0, 0, true);
    }
}
