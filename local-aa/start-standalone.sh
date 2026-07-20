#!/usr/bin/env bash
# Boot a STANDALONE Anvil preloaded with the snapshot — no docker, no deployer,
# no set-code step. The full ERC-4337 ecosystem + Kernel v3.3 + funded accounts
# come up instantly. For hermetic local dev and Playwright fixtures.
#
# `anvil --load-state` reads the plain JSON snapshot directly (no conversion).
# The docker bundler points at the docker anvil, so to use this standalone node
# you must also run a bundler against it (port 18545 here matches the stack).
set -euo pipefail
DIR="$(cd "$(dirname "$0")" && pwd)"
exec anvil \
  --port "${ANVIL_PORT:-18545}" \
  --chain-id 31337 \
  --code-size-limit 100000 \
  --load-state "$DIR/anvil-state.json"
