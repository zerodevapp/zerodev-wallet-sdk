import type { MockRequest } from '../types.js'
import { example } from './example.js'

/**
 * Named preset registry. Both `withMocks` (Playwright) and the manual runner
 * (`mock:dev --preset <name>`) resolve presets from here. Keeping it a single
 * discoverable map is also the seam a future `/mock-server` skill drives.
 */
export const presets = {
  example,
} satisfies Record<string, MockRequest[]>

export type PresetName = keyof typeof presets
