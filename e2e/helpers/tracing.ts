import type { Page } from '@playwright/test'

/**
 * Attaches SDK fetch tracing and browser log bridging to a Playwright page.
 *
 * Wraps window.fetch to emit [SDK] log lines for every non-internal request.
 * Must use console.log (not console.error): Next.js 15's dev overlay intercepts
 * console.error, which re-enters this wrapper on every /__nextjs fetch and causes
 * an infinite React render loop ("Maximum update depth exceeded").
 *
 * Safe to call from any fixture or test that needs network + console visibility.
 */
export async function setupPageTracing(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const log = (...args: unknown[]) => console.log('[SDK]', ...args)
    const INTERNAL_URL = /__nextjs|_next\/|webpack-hmr|hot-update/
    // Captures unhandled JS errors and promise rejections for CI diagnostics.
    window.addEventListener('unhandledrejection', (e) =>
      log('unhandledrejection:', e.reason),
    )
    window.addEventListener('error', (e) => {
      const short = String(e.filename || '')
        .split('/')
        .slice(-2)
        .join('/')
      log(
        'error:',
        e.message,
        `${short}:${e.lineno}`,
        (e.error as Error | undefined)?.stack
          ?.split('\n')
          .slice(0, 6)
          .join(' | '),
      )
    })
    const origFetch = window.fetch.bind(window)
    ;(window as Window & typeof globalThis).fetch = async (
      ...args: Parameters<typeof fetch>
    ) => {
      const a = args[0]
      const url: string =
        typeof a === 'string'
          ? a
          : a instanceof URL
            ? a.href
            : ((a as Request).url ?? '')
      if (!url || INTERNAL_URL.test(url)) return origFetch(...args)
      log('fetch→', url.split('/').slice(-3).join('/'))
      try {
        const res = await origFetch(...args)
        log('fetch←', res.status, url.split('/').slice(-2).join('/'))
        return res
      } catch (err) {
        log('fetchERR', String(err))
        throw err
      }
    }
  })
  // Bridges browser-side [SDK]/[connector]/[authStore] logs to the test runner
  // output, making mock route hits visible without a headed browser.
  page.on('console', (msg) => {
    const t = msg.type()
    const text = msg.text().slice(0, 500)
    if (t === 'error') console.log('[browser:error]', text)
    else if (
      t === 'log' &&
      (text.includes('[SDK]') ||
        text.includes('[OtpInput]') ||
        text.includes('[authStore]') ||
        text.includes('[connector]') ||
        text.includes('ZeroDevWallet') ||
        text.includes('Creating kernel'))
    ) {
      console.log('[browser:log]', text)
    }
  })
  // Surfaces uncaught page errors (e.g. thrown from event handlers) in CI logs.
  page.on('pageerror', (err) =>
    console.error(
      '[page error]',
      err.message,
      '\n[stack]',
      err.stack?.split('\n').slice(0, 8).join('\n'),
    ),
  )
  // Logs outgoing external requests (non-static, non-localhost) for mock coverage auditing.
  page.on('request', (req) => {
    const url = req.url()
    if (
      !url.match(/\.(js|css|png|ico|woff|svg|map)($|\?)/) &&
      !url.includes('webpack') &&
      !url.includes('__nextjs') &&
      !url.includes('localhost')
    ) {
      console.log('[req]', req.method(), url.split('/').slice(-3).join('/'))
    }
  })
}
