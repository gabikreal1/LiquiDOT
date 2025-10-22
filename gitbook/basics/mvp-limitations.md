---
icon: triangle-exclamation
---

# MVP Limitations

Understanding the current scope and limitations of LiquiDOT's MVP (Minimum Viable Product) is important for setting proper expectations. This page outlines what the initial release **will NOT** include.

## Overview

The MVP focuses on proving the core concept: **automated cross-chain liquidity management with user-defined risk parameters**. Many advanced features are intentionally deferred to future releases to ensure rapid delivery and focused development.

## Feature Limitations

### ❌ No Partial Withdrawals

**Current:** Only full liquidations and rebalancing are supported

Users cannot partially exit positions or withdraw a percentage of their LP. When a position is liquidated, the entire position is closed and returned to Asset Hub.

**Why:**
* Simplifies smart contract logic
* Reduces gas costs
* Fewer edge cases to test

**Future:** Partial withdrawal functionality planned for v2.0

**Workaround:** Split initial deposits across multiple positions for granular control

---

### ❌ Single Chain DEX Integration

**Current:** MVP limited to Moonbeam Algebra pools only

The initial release supports only:
* **Moonbeam Parachain** (Moonbase Alpha testnet)
* **Algebra Integral DEX** protocol
* **Selected pools** with sufficient liquidity

**Why:**
* Focus development effort
* Prove concept on one chain first
* Simplify testing and deployment

**Future:** Multi-chain expansion planned (Hydration, Acala, etc.)

**Impact:** Users limited to Moonbeam-based liquidity opportunities

---

### ❌ Basic Investment Logic

**Current:** Simple rule-based investment decisions

The Investment Decision Worker uses straightforward criteria:
* APY above user threshold → invest
* TVL minimum met → invest
* User asset preferences matched → invest
* Max allocation limits respected → invest

**No:**
* AI/ML predictive models
* Complex optimization algorithms
* Market sentiment analysis
* Sophisticated risk modeling

**Why:**
* Faster development
* Easier to test and verify
* More predictable behavior
* Lower computational requirements

**Future:** Enhanced decision algorithms with ML in Phase 3

**Impact:** Less sophisticated optimization than potential future versions

---

### ❌ No zkProof Validations

**Current:** Investment decisions computed off-chain without on-chain verification

The Investment Decision Worker runs as a trusted backend service. There's no cryptographic proof that decisions are optimal or follow user preferences precisely.

**Why:**
* zkSNARK implementation is complex and time-consuming
* Requires specialized cryptography expertise
* Not critical for MVP security (user funds still protected)
* Backend service is open source and auditable

**Future:** zk-SNARK verification planned for Phase 3 (full decentralization)

**Impact:** Users must trust the backend service execution

---

### ❌ API-Dependent Pool Data

**Current:** Only DEXes with reliable API access supported

LiquiDOT requires DEXes to provide:
* REST or GraphQL APIs
* Real-time pool data
* Historical analytics
* Price feeds

**No support for:**
* DEXes without APIs
* On-chain-only data parsing
* Manual data entry

**Why:**
* Real-time monitoring requires fast data access
* On-chain queries too slow for 24/7 monitoring
* API data is structured and reliable

**Future:** Hybrid approach with on-chain fallback

**Impact:** Some DEXes cannot be integrated initially

---

### ❌ Limited Asset Support

**Current:** Restricted to major assets with established infrastructure

Supported assets must have:
* Reliable price oracles (CoinGecko, CoinMarketCap)
* Sufficient liquidity (>$100k TVL in pools)
* XCM compatibility for cross-chain transfers
* Established trading history

**Not supported:**
* Newly launched tokens
* Low-liquidity assets
* Exotic pairs
* Experimental tokens

**Why:**
* Risk management
* Oracle reliability
* Liquidity requirements for efficient execution

**Future:** Gradual expansion as ecosystem matures

**Impact:** Cannot LP in all possible token pairs

---

### ❌ No Governance Token

**Current:** Centralized decision-making by core team

Protocol decisions are made by the core team:
* Parameter adjustments (fee rates, thresholds)
* New parachain additions
* Protocol upgrades
* Emergency actions

**No:**
* DAO governance structure
* Community voting
* Governance token (LIQD)
* Decentralized treasury

**Why:**
* Faster iteration during MVP phase
* Avoid regulatory complexity
* Focus on core functionality

**Future:** DAO transition planned for 2026 (Phase 3)

**Impact:** Users cannot vote on protocol changes

---

### ❌ Single Strategy Type

**Current:** Only automated LP range management

LiquiDOT MVP focuses exclusively on:
* Concentrated liquidity positions
* Asymmetric range management
* Stop-loss/take-profit automation

**Not supported:**
* Yield farming strategies
* Lending protocol integration
* Staking automation
* Options strategies
* Derivatives
* Cross-DEX arbitrage

**Why:**
* Focused MVP scope
* Prove one strategy well
* Avoid complexity

**Future:** Multi-strategy support in Phase 3

**Impact:** Limited to LP-only strategies

---

### ❌ No Impermanent Loss Calculations

**Current:** No IL tracking or warnings

Users must independently understand impermanent loss risks. The platform does not:
* Calculate IL in real-time
* Warn about high IL risk
* Display IL vs HODL comparison
* Suggest IL mitigation strategies

**Why:**
* Complex calculations
* Requires detailed historical data
* Not critical for MVP functionality

**Future:** IL dashboard planned for Phase 2

**Workaround:** Use external IL calculators (e.g., dailydefi.org/tools/impermanent-loss-calculator)

**Impact:** Users need to understand IL risks independently

---

### ❌ No 24/7 Guaranteed Uptime

**Current:** Backend monitoring may experience maintenance downtime

The Stop-Loss Worker and Investment Decision Worker are centralized services that may experience:
* Scheduled maintenance windows
* Unexpected outages
* Infrastructure issues
* Cloud provider problems

**No SLA guarantees** during MVP phase

**Why:**
* Single server architecture
* No redundancy during MVP
* Cost optimization

**Future:** High-availability infrastructure in Phase 2

**Mitigation:**
* Emergency liquidation via Asset Hub admin
* Notification system for downtime
* Position recovery mechanisms

**Impact:** Stop-loss triggers may be delayed during outages

---

### ❌ No Position NFTs / Share Tokens

**Current:** Positions are non-transferable records in Asset Hub contract

User positions exist only as internal mappings in the Asset Hub Vault Contract. There are no:
* **ERC-721 Position NFTs** - Cannot transfer positions to other users
* **ERC-4626 Vault Shares** - No fractional ownership or secondary market
* **Composability** - Positions cannot be used as collateral or in other protocols

**Why:**
* Simpler MVP implementation
* Reduces smart contract complexity
* Avoids additional testing burden
* Not critical for core functionality

**Future:** Position NFTs and share tokens planned for Phase 3

**Impact:**
* Cannot sell positions to other users
* Cannot use positions as collateral
* No composability with other DeFi protocols
* Each position is tied to depositing wallet

---

### ❌ No Tax Reporting Integration

**Current:** Users responsible for their own tax calculations

LiquiDOT does not provide:
* Automated tax reports
* Cost basis tracking
* Realized gain/loss calculations
* Integration with tax software
* Jurisdiction-specific reporting

**Why:**
* Complex regulatory landscape
* Varies by jurisdiction
* Not core to MVP functionality
* Requires legal expertise

**Future:** Potential partnership with crypto tax providers

**Workaround:** Export transaction history and use external tax tools (CoinTracker, Koinly, etc.)

**Impact:** Manual tax tracking required

---

## Security Limitations

### ⚠️ No Professional Audit (Yet)

**Current:** Code reviewed by team but not professionally audited

While we follow best practices (OpenZeppelin libraries, comprehensive testing), the MVP has not undergone:
* Professional security audit by firms like Trail of Bits, ConsenSys Diligence, etc.
* Economic security analysis
* Formal verification

**Why:**
* Audits are expensive ($50k-$150k)
* MVP deployed on testnet initially
* Seeking funding for mainnet audit

**Future:** Professional audit before mainnet deployment

**Mitigation:**
* Open-source code for community review
* Bug bounty program (planned)
* Gradual TVL scaling

**Impact:** Higher risk during early phases

---

### ⚠️ Centralized Backend Services

**Current:** Backend workers run as centralized services

The Investment Decision Worker and Stop-Loss Worker are:
* Centralized Node.js services
* Single points of failure
* Require trust in operators

**Future:** Decentralization via zk-SNARKs and keeper networks

**Impact:** Service dependency and trust assumptions

---

## Performance Limitations

### ⏱️ Liquidation Latency

**Current:** Stop-loss may take 12-60 seconds to execute

The monitoring loop runs every 12 seconds (Moonbeam block time), plus:
* Detection time: 12s average
* Transaction submission: 5-10s
* Liquidation execution: 10-30s
* Return to Asset Hub: 12-24s

**Total:** 39-76 seconds from price breach to user credit

**Why:**
* Backend polling architecture
* Blockchain confirmation times
* XCM message latency

**Future:** Optimized with keeper network and faster detection

**Impact:** May miss optimal exit price in volatile markets

---

### 📊 Data Update Frequency

**Current:** Pool data updated every 60 seconds

Analytics and price data refreshed every minute, which means:
* Position metrics may lag slightly
* Investment decisions based on slightly stale data
* Dashboard shows ~1 minute delayed data

**Why:**
* API rate limits
* Server resource optimization
* Sufficient for MVP use case

**Future:** Real-time WebSocket feeds for instant updates

**Impact:** Minimal but data is not perfectly real-time

---

## Scalability Limitations

### 👥 User Capacity

**MVP Target:** 100-500 concurrent users

The current infrastructure is designed for MVP scale, not mass adoption:
* Single backend server
* PostgreSQL database on one instance
* Limited concurrent request handling

**Why:**
* Appropriate for MVP phase
* Cost-effective for testing
* Will scale with growth

**Future:** Auto-scaling infrastructure in Phase 2

**Impact:** May need waiting list if popularity exceeds capacity

---

### 💰 Position Limits

**Current:** Recommended max 5-10 active positions per user

While technically unlimited, performance considerations suggest limiting:
* Active positions per user
* Total protocol positions
* Concurrent liquidations

**Why:**
* Backend monitoring efficiency
* Database query performance
* Gas cost management

**Future:** Optimized for 100+ positions per user

**Impact:** Power users may need to self-manage position count

---

## User Experience Limitations

### 📱 No Mobile App

**Current:** Web-only interface

The MVP is a web application with no:
* Native iOS app
* Native Android app
* Mobile-optimized features (push notifications, biometrics)

**Why:**
* Focus on core functionality
* Web app works on mobile browsers
* Native apps require separate development effort

**Future:** Native mobile apps in Phase 3

**Workaround:** Use mobile web browser (responsive design)

---

### 🔔 Limited Notifications

**Current:** No real-time alerts

Users are not notified about:
* Position liquidations
* Stop-loss triggers
* Rebalancing events
* System maintenance

**Why:**
* Notification infrastructure not built
* Focus on core functionality

**Future:** Email, SMS, and push notifications in Phase 2

**Workaround:** Check dashboard regularly

---

### 📊 Basic Analytics

**Current:** Simple position tracking

The dashboard shows:
* Current positions
* P&L
* Basic performance metrics

**Not included:**
* Advanced charts and visualizations
* Performance attribution
* Comparative analysis
* Historical trend analysis

**Future:** Comprehensive analytics dashboard in Phase 2

---

## What IS Included in MVP

Despite limitations, the MVP includes powerful core features:

✅ **Cross-chain LP management** via XCM  
✅ **Automated stop-loss** and take-profit  
✅ **Asymmetric range support** (e.g., -5%/+10%)  
✅ **User-defined strategies** with risk preferences  
✅ **Real-time position monitoring**  
✅ **Automatic liquidation** and asset return  
✅ **Secure custody** on Asset Hub  
✅ **Algebra DEX integration** on Moonbeam  
✅ **Web dashboard** for position management  
✅ **Complete testnet deployment**  

## Managing Expectations

### For Users

**MVP is ideal for:**
* Early adopters willing to provide feedback
* Users comfortable with testnet experimentation
* Those seeking automated LP management on Moonbeam
* Community members wanting to shape the product

**MVP is NOT for:**
* Risk-averse users requiring perfect uptime
* Those needing advanced features immediately
* Users expecting institutional-grade tooling
* Production use with significant capital (testnet only initially)

### For Developers

**MVP is great for:**
* Learning cross-chain DeFi architecture
* Contributing to open-source Polkadot projects
* Building integrations with early protocols
* Experimenting with XCM

**MVP has limitations:**
* Not production-ready for forks
* Requires enhancements for institutional use
* May need optimization for high volume
* Documentation still evolving

## Timeline for Improvements

| Limitation | Planned Resolution | Timeline |
|------------|-------------------|----------|
| Single chain support | Multi-parachain | Q2 2025 |
| Basic investment logic | Enhanced algorithms | Q3 2025 |
| No zkProofs | zk-SNARK integration | Q3-Q4 2025 |
| No position NFTs | ERC-721 implementation | Q3-Q4 2025 |
| No governance | DAO launch | 2026 |
| Centralized backend | Keeper network | Q4 2025 |
| No IL tracking | IL dashboard | Q2 2025 |
| Limited notifications | Full alert system | Q2 2025 |
| No professional audit | Security audit | Pre-mainnet |

## Conclusion

These limitations are **intentional trade-offs** to enable rapid MVP delivery and focused development. As LiquiDOT grows and secures additional funding, we'll systematically address each limitation according to our [Roadmap](roadmap.md).

**The MVP proves the core concept** while establishing foundation for comprehensive future development.

## Next Steps

* [Roadmap](roadmap.md) - See the full development plan
* [Architecture](architecture.md) - Understand current implementation
* [Quickstart](../getting-started/quickstart.md) - Try the MVP
* [Team](team.md) - Meet the builders
