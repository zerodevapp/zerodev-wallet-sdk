#!/usr/bin/env bash
# Seed Kernel v3.3 (7702) singletons onto the local Anvil by copying runtime
# bytecode from a chain where they're live (Arbitrum Sepolia).
# Idempotent: safe to re-run. Requires: curl, jq.
set -euo pipefail

LOCAL="${LOCAL_RPC:-http://localhost:18545}"
SRC="${SRC_RPC:-https://sepolia-rollup.arbitrum.io/rpc}"

# For 7702 we need the delegation impl + the entrypoint hook. The ECDSA
# validator (0xd9AB5096...0390) and EntryPoint v0.7 are already on the stack.
ADDRS=(
  "0xd6CEDDe84be40893d153Be9d467CD6aD37875b28"  # Kernel v3.3 impl / 7702 delegation
  "0xb230f0A1C7C95fa11001647383c8C7a8F316b900"  # OnlyEntryPoint hook
)

getCode() { # rpc addr
  curl -s -X POST "$1" -H 'content-type: application/json' \
    -d "{\"jsonrpc\":\"2.0\",\"id\":1,\"method\":\"eth_getCode\",\"params\":[\"$2\",\"latest\"]}" \
    | jq -r '.result'
}
setCode() { # addr code
  curl -s -X POST "$LOCAL" -H 'content-type: application/json' \
    -d "{\"jsonrpc\":\"2.0\",\"id\":1,\"method\":\"anvil_setCode\",\"params\":[\"$1\",\"$2\"]}" \
    | jq -r '.error.message // "ok"'
}

for a in "${ADDRS[@]}"; do
  echo "→ $a"
  code=$(getCode "$SRC" "$a")
  if [ -z "$code" ] || [ "$code" = "0x" ] || [ "$code" = "null" ]; then
    echo "  ✗ source has no code — aborting"; exit 1
  fi
  echo "  source bytecode: $(( (${#code} - 2) / 2 )) bytes"
  echo "  anvil_setCode: $(setCode "$a" "$code")"
  local_len=$(( ($(getCode "$LOCAL" "$a" | wc -c) - 3) / 2 ))
  echo "  ✓ local now has ~${local_len} bytes"
done
echo "Done. (Ephemeral — re-run after an Anvil restart, or bake into --dump-state.)"
