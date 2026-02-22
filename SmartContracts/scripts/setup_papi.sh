#!/bin/bash
# Install polkadot-api and CLI
npm install polkadot-api @polkadot-api/descriptors

# Add chain definition for Polkadot Asset Hub
npx papi add dotah -n polkadot_asset_hub

# Generate descriptors
npx papi generate
