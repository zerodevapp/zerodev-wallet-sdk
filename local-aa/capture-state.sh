#!/usr/bin/env bash
# Capture the current Anvil state into anvil-state.json — plain SerializableState
# JSON, the format `anvil --load-state` reads directly. Run against a KNOWN-GOOD
# node (ecosystem deployed + Kernel v3.3 set-code + test accounts funded).
#
# We read it via the anvil_dumpState RPC (the only option for the docker node,
# whose startup command we don't control). That RPC returns gzip-hex, so we
# decode + gunzip once here, at capture time, and store the JSON.
set -euo pipefail
RPC="${ANVIL_RPC:-http://localhost:18545}"
OUT="$(cd "$(dirname "$0")" && pwd)/anvil-state.json"
curl -s -m 60 -X POST "$RPC" -H 'content-type: application/json' \
  -d '{"jsonrpc":"2.0","id":1,"method":"anvil_dumpState","params":[]}' \
| python3 -c "
import sys, json, gzip
hx = json.load(sys.stdin)['result']
hx = hx[2:] if hx.startswith('0x') else hx
open('$OUT', 'wb').write(gzip.decompress(bytes.fromhex(hx)))
"
echo "wrote $OUT ($(wc -c < "$OUT") bytes)"
