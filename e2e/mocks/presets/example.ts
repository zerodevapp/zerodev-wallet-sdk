import type { MockRequest } from '../types.js'

/**
 * Starter preset showing the shape. Because the browser is proxied, `url` is
 * matched against the REAL destination URL; a catch-all regex matches any host
 * and lets the JSON-RPC `method` in the body do the disambiguation.
 *
 * Fill real presets from captured traffic (DevTools → copy response). Note:
 * static JSON-RPC responses don't echo the request `id`; if a flow validates
 * it, capture per-call or extend the layer to template the id.
 */
export const example: MockRequest[] = [
  {
    // Any RPC endpoint: report a fixed balance (0.01 ETH) for eth_getBalance.
    url: /.*/,
    method: 'POST',
    payload: { method: 'eth_getBalance' },
    response: { jsonrpc: '2.0', id: 1, result: '0x2386f26fc10000' },
  },
]
