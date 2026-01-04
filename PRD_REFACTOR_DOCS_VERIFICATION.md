# PRD — Refactor: Documentation + Verification Pipeline (Paseo/AssetHub Claims)

Date: 2025-12-22
Owner: LiquiDOT Team
Status: Draft

## 1) Summary
LiquiDOT documentation currently mixes:

- repo facts (what the code does)
- ecosystem expectations (what chains usually support)
- runtime-specific claims (what Paseo Asset Hub supports right now)

This PRD introduces a documentation and verification pipeline so that:

- every runtime-dependent claim is either **cited** or explicitly marked **“verify on chain”**
- the repo includes small scripts/endpoints to verify the key assumptions
- reviewers can reproduce a proof bundle (tx hashes, runtime version, contracts addresses)

## 2) Goals
1. **Make docs reviewer-safe**: no unverified claims presented as facts.
2. **Make verification repeatable**: scripts + checklists rather than tribal knowledge.
3. **Keep docs close to code**: tie claims to files/functions/addresses.

## 3) Non-goals
- Building an indexer.
- Guaranteeing that verification is possible without any chain transactions.

## 4) Proposed documentation standard

### 4.1 Document taxonomy
Each doc page section must be labeled:

- **Repo Fact** — validated by code in this repo (link file paths)
- **Network Claim** — runtime-dependent; must include one of:
  - citation (runtime source / official docs)
  - tx hash evidence
  - “verification procedure” block

### 4.2 “Assumptions manifest”
Introduce a single versioned manifest file per deployment:

- `deployments/<network>/assumptions.json`

Contains:
- rpc endpoints
- runtime specVersion
- contract addresses
- precompile/host function addresses
- ABI kind
- evidence links (tx hashes)

### 4.3 Verification checklist pages
Add GitBook pages for:

- How to verify XCM send capability from a contract
- How to verify inbound XCM `Transact` call into revive contract
- How to verify settlement events on Asset Hub

## 5) Tooling

### 5.1 Backend diagnostics endpoint (already started)
Standardize and document:

- `GET /api/blockchain/diagnostics`

Extend later to include:
- chain ids
- rpc connectivity from backend
- deployed contract addresses

### 5.2 Verification scripts
Add lightweight scripts (Node/TS) that:

- query runtime version and chain metadata
- check code presence at addresses (where applicable)
- read configured precompile addresses from contracts

### 5.3 CI gates
Add non-flaky CI checks:

- markdown lint
- link check (internal links)
- “assumptions manifest exists for documented deployments”

Avoid CI that requires live chain access by default.

## 6) Acceptance criteria
- New/updated docs include Repo Fact vs Network Claim labeling.
- At least one assumptions manifest exists for Paseo deployments once available.
- Docs include a verification procedure for:
  - Asset Hub XCM send
  - inbound `Transact` (if supported)
- No network-dependent claim is left uncategorized.

## 7) Open questions
- Where should manifests live (root `deployments/` vs `SmartContracts/deployments/`)?
- Do we want a “proof bundle generator” script to zip manifests + tx hashes + addresses?
