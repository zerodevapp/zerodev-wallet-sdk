#!/usr/bin/env bash
# Restore the snapshot into a RUNNING Anvil via the anvil_loadState RPC.
# Use with the docker stack: after `make dev` (re)starts, the anvil's in-memory
# state is wiped and the deployer only re-adds the base ecosystem — this re-applies
# our Kernel v3.3 set-code + funded accounts on top. The bundler stays pointed at
# the same node, so nothing else changes.
#
# anvil_loadState only accepts gzip-hex, so we compress the JSON snapshot on the
# fly here (the one place the conversion is unavoidable).
set -euo pipefail
RPC="${ANVIL_RPC:-http://localhost:18545}"
JSON="$(cd "$(dirname "$0")" && pwd)/anvil-state.json"
python3 - "$JSON" "$RPC" <<'PY'
import sys, json, gzip, urllib.request
raw = open(sys.argv[1], "rb").read()
hx = "0x" + gzip.compress(raw).hex()
req = urllib.request.Request(
    sys.argv[2],
    data=json.dumps({"jsonrpc": "2.0", "id": 1, "method": "anvil_loadState", "params": [hx]}).encode(),
    headers={"content-type": "application/json"},
)
res = json.load(urllib.request.urlopen(req, timeout=60))
print("anvil_loadState:", res.get("result", res))
PY
