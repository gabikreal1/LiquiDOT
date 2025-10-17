// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.20;

import "@cryptoalgebra/integral-periphery/contracts/interfaces/INonfungiblePositionManager.sol";

contract MockNFPM {
    uint256 private _nextTokenId = 1;
    mapping(uint256 => uint128) public liquidities;

    function mint(INonfungiblePositionManager.MintParams calldata params)
        external
        payable
        returns (uint256 tokenId, uint128 liquidity, uint256 amount0, uint256 amount1)
    {
        tokenId = _nextTokenId++;
        liquidity = uint128(params.amount0Desired + params.amount1Desired);
        liquidities[tokenId] = liquidity;

        amount0 = params.amount0Desired;
        amount1 = params.amount1Desired;
    }

    function decreaseLiquidity(INonfungiblePositionManager.DecreaseLiquidityParams calldata params)
        external
        payable
        returns (uint256 amount0, uint256 amount1)
    {
        uint128 stored = liquidities[params.tokenId];
        require(stored >= params.liquidity, "insufficient liquidity");
        liquidities[params.tokenId] = stored - params.liquidity;
        amount0 = params.liquidity / 2;
        amount1 = params.liquidity / 2;
    }

    function collect(INonfungiblePositionManager.CollectParams calldata)
        external
        payable
        returns (uint256 amount0, uint256 amount1)
    {
        return (0, 0);
    }

    function burn(uint256 tokenId) external payable {
        delete liquidities[tokenId];
    }
}
