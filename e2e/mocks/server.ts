import {
  generateCACertificate,
  getLocal,
  type Mockttp,
  type RequestRuleBuilder,
} from 'mockttp'
import { orderMocks } from './orderMocks.js'
import type { MockRequest, UnmatchedPolicy } from './types.js'

/** Default proxy port. The Playwright mocked config points the browser here. */
export const DEFAULT_MOCK_PORT = 8080

/**
 * Start Mockttp as an HTTP(S) proxy. HTTPS is intercepted with a
 * runtime-generated CA; clients accept it by ignoring TLS errors (Playwright
 * `ignoreHTTPSErrors` / the launched manual browser) rather than installing it.
 *
 * @param port omit for an OS-assigned free port (used by tests).
 */
export async function startMockServer(port?: number): Promise<Mockttp> {
  const https = await generateCACertificate()
  const server = getLocal({ https })
  await server.start(port)
  return server
}

export async function stopMockServer(server: Mockttp): Promise<void> {
  await server.stop()
}

/** Clear all rules without stopping the process (per-test teardown). */
export async function reset(server: Mockttp): Promise<void> {
  await server.reset()
}

function ruleFor(server: Mockttp, mock: MockRequest): RequestRuleBuilder {
  switch (mock.method) {
    case 'GET':
      return server.forGet(mock.url)
    case 'POST':
      return server.forPost(mock.url)
    case 'PUT':
      return server.forPut(mock.url)
    case 'PATCH':
      return server.forPatch(mock.url)
    case 'DELETE':
      return server.forDelete(mock.url)
  }
}

/**
 * Register `mocks` as proxy rules (highest priority first, so first-match-wins
 * lets an override beat a preset baseline), then a fallback for everything
 * else per `unmatched`.
 */
export async function applyMocks(
  server: Mockttp,
  mocks: MockRequest[],
  unmatched: UnmatchedPolicy = 'passthrough',
): Promise<void> {
  for (const mock of orderMocks(mocks)) {
    let rule = ruleFor(server, mock)
    if (mock.payload) rule = rule.withJsonBodyIncluding(mock.payload)
    await rule.thenJson(mock.status ?? 200, mock.response)
  }

  if (unmatched === 'block') {
    await server.forUnmatchedRequest().thenCallback(async (req) => {
      const body = await req.body.getText().catch(() => '')
      console.warn(
        `[mock] blocked unmatched ${req.method} ${req.url}${body ? ` body=${body}` : ''}`,
      )
      return {
        statusCode: 501,
        json: { error: 'No mock matched', method: req.method, url: req.url },
      }
    })
  } else {
    await server.forUnmatchedRequest().thenPassThrough()
  }
}

// --- Shared singleton, started once per Playwright run in globalSetup ---

let shared: Mockttp | undefined

export async function startSharedServer(
  port: number = DEFAULT_MOCK_PORT,
): Promise<Mockttp> {
  shared = await startMockServer(port)
  return shared
}

export function getMockServer(): Mockttp {
  if (!shared) {
    throw new Error(
      'Mock server not started. It is started in the Playwright globalSetup.',
    )
  }
  return shared
}

export async function stopSharedServer(): Promise<void> {
  if (shared) {
    await stopMockServer(shared)
    shared = undefined
  }
}
