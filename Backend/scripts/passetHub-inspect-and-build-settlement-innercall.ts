/*
  Passet Hub metadata inspector + settlement innerCall builder.

  What it does:
  - Connects to PASSET_HUB_WS via polkadot-js
  - Prints runtime version/spec
  - Checks availability of pallets/calls used for Transact settlement
  - Builds SCALE-encoded innerCall hex for:
      - revive.call(...)
      - utility.forceBatch([...]) (if available)

  Usage (run from Backend/):
    PASSET_HUB_WS=wss://... \
    ASSET_HUB_VAULT=0x... \
    POSITION_ID=0x... (bytes32) \
    AMOUNT=12345 \
    node --loader ts-node/esm scripts/passetHub-inspect-and-build-settlement-innercall.ts

  Notes:
  - This script is metadata-driven: it does not hardcode pallet indices.
  - It intentionally prints informative errors when pallet/call names differ.
*/

import { ApiPromise, WsProvider } from '@polkadot/api';
import { Interface } from 'ethers';

type HexString = `0x${string}`;

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required env var: ${name}`);
  return v;
}

function isHexString(v: string): v is HexString {
  return /^0x[0-9a-fA-F]*$/.test(v);
}

function asHex(name: string, v: string): HexString {
  if (!isHexString(v)) throw new Error(`${name} must be hex, got: ${v}`);
  return v as HexString;
}

function optionalBool(v: string | undefined): boolean {
  if (!v) return false;
  return ['1', 'true', 'yes', 'y'].includes(v.toLowerCase());
}

async function main() {
  const ws = requireEnv('PASSET_HUB_WS');
  const assetHubVault = requireEnv('ASSET_HUB_VAULT');
  const positionId = asHex('POSITION_ID', requireEnv('POSITION_ID'));
  const amountStr = requireEnv('AMOUNT');
  const includeMapAccount = optionalBool(process.env.INCLUDE_MAP_ACCOUNT);

  if (!/^0x[0-9a-fA-F]{40}$/.test(assetHubVault)) {
    throw new Error(`ASSET_HUB_VAULT must be an EVM address (0x + 40 hex chars), got: ${assetHubVault}`);
  }
  const amount = BigInt(amountStr);

  const provider = new WsProvider(ws);
  const api = await ApiPromise.create({ provider });

  try {
    const rv = api.runtimeVersion;
    // eslint-disable-next-line no-console
    console.log('Runtime:', {
      specName: rv.specName.toString(),
      specVersion: rv.specVersion.toNumber(),
      implName: rv.implName.toString(),
      implVersion: rv.implVersion.toNumber(),
      transactionVersion: rv.transactionVersion.toNumber(),
    });

    const hasRevive = !!api.tx['revive'];
    const hasUtility = !!api.tx['utility'];

    // eslint-disable-next-line no-console
    console.log('Pallets present:', { revive: hasRevive, utility: hasUtility });

    if (!hasRevive) {
      throw new Error(`No revive pallet found in metadata (api.tx.revive is undefined).`);
    }

    const reviveAny = api.tx['revive'] as any;
    const reviveCall = reviveAny['call'];
    const reviveMapAccount = reviveAny['mapAccount'];

    // eslint-disable-next-line no-console
    console.log('revive calls present:', {
      call: typeof reviveCall === 'function',
      mapAccount: typeof reviveMapAccount === 'function',
    });

    // Build the EVM calldata for AssetHubVault.settleLiquidation(bytes32,uint256)
    // NOTE: This is EVM ABI calldata used as the payload for revive.call.
    const vaultIface = new Interface([
      'function settleLiquidation(bytes32 positionId,uint256 receivedAmount)',
    ]);
    const evmCalldata = vaultIface.encodeFunctionData('settleLiquidation', [positionId, amount]) as HexString;

    // eslint-disable-next-line no-console
    console.log('EVM calldata:', { evmCalldata, bytes: (evmCalldata.length - 2) / 2 });

    // ----- Try to construct revive.call(...) in a runtime-agnostic way -----
    // We don’t know the exact revive.call signature across runtimes.
    // So we introspect metadata and attempt a best-effort call creation.
    const reviveCallMeta = api.tx.revive.call.meta;
    // eslint-disable-next-line no-console
    console.log('revive.call meta args:', reviveCallMeta.args.map((a) => ({ name: a.name.toString(), type: a.type.toString() })));

    // Heuristic argument mapping:
    // Common patterns are something like:
    //   call(dest: H160/AccountId, value: Balance, gasLimit/weight, storageDepositLimit?, inputData: Bytes)
    // We will attempt a couple of candidate layouts.

    const candidates: Array<{ label: string; args: unknown[] }> = [];

    // Candidate A: (dest, value, gasLimit, storageDepositLimit, inputData)
    candidates.push({
      label: 'A(dest,value,gasLimit,storageDepositLimit,inputData)',
      args: [assetHubVault, 0, 1_000_000_000n, null, evmCalldata],
    });

    // Candidate B: (dest, value, gasLimit, storageDepositLimit, inputData) but gasLimit as WeightV2-like object
    candidates.push({
      label: 'B(dest,value,gasLimitWeight,storageDepositLimit,inputData)',
      args: [assetHubVault, 0, { refTime: 1_000_000_000n, proofSize: 0n }, null, evmCalldata],
    });

    // Candidate C: (dest, value, gasLimit, inputData)
    candidates.push({
      label: 'C(dest,value,gasLimit,inputData)',
      args: [assetHubVault, 0, 1_000_000_000n, evmCalldata],
    });

    let reviveCallExtrinsic: any | null = null;
    let reviveCallUsed: string | null = null;

    for (const c of candidates) {
      try {
        reviveCallExtrinsic = (api.tx as any).revive.call(...c.args);
        reviveCallUsed = c.label;
        break;
      } catch (e: any) {
        // eslint-disable-next-line no-console
        console.log(`revive.call candidate failed (${c.label}): ${e?.message ?? e}`);
      }
    }

    if (!reviveCallExtrinsic) {
      throw new Error('Failed to construct revive.call extrinsic with all candidates. Use the printed meta args to update the builder.');
    }

    const reviveInnerCallHex = reviveCallExtrinsic.method.toHex() as HexString;
    // eslint-disable-next-line no-console
    console.log('revive.call constructed with:', reviveCallUsed);
    // eslint-disable-next-line no-console
    console.log('innerCallHex (revive.call only):', reviveInnerCallHex);

    // ----- Optionally wrap in utility.forceBatch -----
    const utilityAny = hasUtility ? (api.tx['utility'] as any) : null;
    const forceBatch = utilityAny?.forceBatch;
    const batchAll = utilityAny?.batchAll;
    const batch = utilityAny?.batch;

    const canMap = typeof reviveMapAccount === 'function';

    if (hasUtility && (typeof forceBatch === 'function' || typeof batchAll === 'function' || typeof batch === 'function')) {
      const calls: any[] = [];

      if (includeMapAccount) {
        if (!canMap) {
          // eslint-disable-next-line no-console
          console.log('INCLUDE_MAP_ACCOUNT was set, but revive.mapAccount is not available on this runtime. Skipping.');
        } else {
          try {
            calls.push((api.tx as any).revive.mapAccount());
          } catch (e: any) {
            // eslint-disable-next-line no-console
            console.log(`revive.mapAccount() construct failed: ${e?.message ?? e}`);
          }
        }
      }

      calls.push(reviveCallExtrinsic);

      const batchFn = (typeof forceBatch === 'function' && forceBatch) || (typeof batchAll === 'function' && batchAll) || batch;
      const batchLabel =
        batchFn === forceBatch ? 'utility.forceBatch' : batchFn === batchAll ? 'utility.batchAll' : 'utility.batch';

      const batched = batchFn(calls);
      const batchedInnerCallHex = batched.method.toHex() as HexString;

      // eslint-disable-next-line no-console
      console.log('innerCallHex (batched):', { batchLabel, batchedInnerCallHex });
    } else {
      // eslint-disable-next-line no-console
      console.log('utility batching not available on this runtime; only revive.call innerCall produced.');
    }

    // Bonus: print revive.mapAccount meta if present
    if (canMap) {
      const meta = (api.tx as any).revive.mapAccount.meta;
      // eslint-disable-next-line no-console
      console.log('revive.mapAccount meta args:', meta.args.map((a: any) => ({ name: a.name.toString(), type: a.type.toString() })));
    }
  } finally {
    await api.disconnect();
  }
}

main().catch((e) => {
  // eslint-disable-next-line no-console
  console.error(e);
  process.exit(1);
});
