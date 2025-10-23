---
description: (Not yet live) Release Q4 2025
icon: bolt
layout:
  width: default
  title:
    visible: true
  description:
    visible: true
  tableOfContents:
    visible: true
  outline:
    visible: true
  pagination:
    visible: true
  metadata:
    visible: true
---

# Quickstart

Get started with LiquiDOT in minutes. This guide will walk you through setting up your first automated liquidity position.

## Prerequisites

Before you begin, make sure you have:

* A Polkadot-compatible wallet (e.g., Polkadot.js, Talisman, SubWallet)
* Testnet tokens:
  * **Moonbase DEV** - Get from [Moonbeam Faucet](https://faucet.moonbeam.network/)
  * **Paseo PAS** - Get from [Paseo Faucet](https://faucet.polkadot.io/)
* Basic understanding of liquidity provision

{% hint style="info" %}
Currently, LiquiDOT is in MVP phase and operates on testnets. Mainnet deployment is planned for future releases.
{% endhint %}

## Step 1: Connect Your Wallet

1. Navigate to [liquidot.xyz](https://liquidot.xyz) (coming soon)
2. Click **Connect Wallet**
3. Select your preferred wallet provider
4. Approve the connection request

## Step 2: Deposit Funds

1. Go to the **Dashboard**
2. Click **Deposit**
3. Enter the amount you want to deposit in PAS
4. Confirm the transaction in your wallet

Your funds will be securely held in the Asset Hub Vault Contract.

## Step 3: Configure Your Strategy

1. Navigate to **Strategy Settings**
2. Choose your risk profile:
   * **Conservative** - Lower risk, stable returns
   * **Moderate** - Balanced risk/reward
   * **Aggressive** - Higher risk, maximum returns
3. Set your preferences:
   * **Minimum APY** - Your target annual percentage yield
   * **Max Allocation Per Pool** - Maximum percentage per LP position
   * **Stop Loss** - Automatic exit threshold (e.g., -5%)
   * **Take Profit** - Profit-taking threshold (e.g., +15%)
4. Select your preferred assets
5. Click **Save Strategy**

## Step 4: Monitor Your Positions

Once your strategy is configured, LiquiDOT will automatically:

* Analyze available liquidity pools across parachains
* Execute optimal LP positions based on your preferences
* Monitor positions in real-time
* Trigger stop-loss or take-profit when thresholds are met
* Rebalance positions to maximize returns

You can track everything from your **Dashboard**:

* Active positions and their performance
* Historical returns
* Upcoming rebalancing actions
* Risk metrics

## Next Steps

<table data-view="cards"><thead><tr><th></th><th></th><th data-hidden data-card-target data-type="content-ref"></th></tr></thead><tbody><tr><td><strong>📚 Learn the Architecture</strong></td><td>Understand how LiquiDOT works under the hood</td><td><a href="../basics/architecture.md">architecture.md</a></td></tr><tr><td><strong>⚙️ Advanced Configuration</strong></td><td>Fine-tune your strategy parameters</td><td><a href="../basics/risk-parameters.md">risk-parameters.md</a></td></tr><tr><td><strong>🔍 Monitor Positions</strong></td><td>Learn to track and analyze your LP positions</td><td><a href="../basics/monitoring-positions.md">monitoring-positions.md</a></td></tr></tbody></table>

## Getting Help

* Check our [FAQ](../basics/faq.md)
* Join our [Discord community](https://discord.gg/liquidot)
* Review the [Video Tutorial](https://youtube.com/liquidot)
* Read the [User Guide](../basics/creating-position.md)

{% hint style="success" %}
Congratulations! You're now ready to start automated liquidity provision with LiquiDOT.
{% endhint %}
