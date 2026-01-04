import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

import { ethers } from 'ethers';

const ROOT = process.cwd();

function requireEnv(name) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env var: ${name}`);
  return v;
}

function normalizeAddress(addr) {
  return ethers.getAddress(addr);
}

const ASSET_HUB_RPC = requireEnv('ASSET_HUB_RPC');
const MOONBEAM_RPC = requireEnv('MOONBEAM_RPC');

const ASSETHUB_VAULT = normalizeAddress(requireEnv('ASSETHUB_VAULT'));
const MOONBEAM_XCMPROXY = normalizeAddress(requireEnv('MOONBEAM_XCMPROXY'));

const OUT_PATH = process.env.OUT_PATH || path.join(ROOT, 'deployments', 'paseo', 'assumptions.generated.json');

// Minimal ABI fragments (read-only)
const assetHubVaultAbi = [
  'function XCM_PRECOMPILE() view returns (address)',
  'function XCM_SENDER() view returns (address)',
  'function xcmPrecompileFrozen() view returns (bool)',
  'function xcmSenderFrozen() view returns (bool)',
];

const xcmProxyAbi = [
  'function xTokensPrecompile() view returns (address)',
  'function xcmTransactorPrecompile() view returns (address)',
  'function assetHubParaId() view returns (uint32)',
  'function xcmConfigFrozen() view returns (bool)',
];

async function main() {
  const assetProvider = new ethers.JsonRpcProvider(ASSET_HUB_RPC);
  const moonProvider = new ethers.JsonRpcProvider(MOONBEAM_RPC);

  const [assetNet, moonNet] = await Promise.all([assetProvider.getNetwork(), moonProvider.getNetwork()]);

  const assetVault = new ethers.Contract(ASSETHUB_VAULT, assetHubVaultAbi, assetProvider);
  const moonProxy = new ethers.Contract(MOONBEAM_XCMPROXY, xcmProxyAbi, moonProvider);

  const [xcmPrecompile, xcmSender, xcmPrecompileFrozen, xcmSenderFrozen] = await Promise.all([
    assetVault.XCM_PRECOMPILE(),
    assetVault.XCM_SENDER(),
    assetVault.xcmPrecompileFrozen(),
    assetVault.xcmSenderFrozen(),
  ]);

  const [xTokensPrecompile, xcmTransactorPrecompile, assetHubParaId, xcmConfigFrozen] = await Promise.all([
    moonProxy.xTokensPrecompile(),
    moonProxy.xcmTransactorPrecompile(),
    moonProxy.assetHubParaId(),
    moonProxy.xcmConfigFrozen(),
  ]);

  const manifest = {
    generatedAt: new Date().toISOString(),
    network: {
      name: 'generated',
      notes: 'Generated from live RPC + on-chain contract reads. Add tx hashes under evidence manually or extend this script.',
    },
    chains: {
      assetHub: {
        rpc: ASSET_HUB_RPC,
        chainId: Number(assetNet.chainId),
      },
      moonbeam: {
        rpc: MOONBEAM_RPC,
        chainId: Number(moonNet.chainId),
      },
    },
    contracts: {
      assetHubVault: {
        address: ASSETHUB_VAULT,
        config: {
          xcmPrecompile,
          xcmSender,
          xcmPrecompileFrozen,
          xcmSenderFrozen,
        },
      },
      xcmProxy: {
        address: MOONBEAM_XCMPROXY,
        config: {
          xTokensPrecompile,
          xcmTransactorPrecompile,
          assetHubParaId: Number(assetHubParaId),
          xcmConfigFrozen,
        },
      },
    },
    evidence: {
      links: [],
      txHashes: [],
    },
  };

  await fs.mkdir(path.dirname(OUT_PATH), { recursive: true });
  await fs.writeFile(OUT_PATH, JSON.stringify(manifest, null, 2) + '\n', 'utf8');

  // eslint-disable-next-line no-console
  console.log(`Wrote assumptions manifest: ${OUT_PATH}`);
}

main().catch((e) => {
  // eslint-disable-next-line no-console
  console.error(e);
  process.exit(1);
});
