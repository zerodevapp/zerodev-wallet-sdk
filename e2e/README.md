# End-to-end suites

Everything under `e2e/` needs the **deployed stack** — staging KMS, Auth Proxy,
Turnkey. Two suites, split by what drives them:

| Suite | Command | Driver | Config |
| --- | --- | --- | --- |
| `backend/` | `pnpm test:e2e:backend` | vitest in node, SDK imported from source | `vitest.backend.config.ts` |
| `browser/` | `pnpm test:e2e:browser` | playwright in chromium, built dist + QA lab | `playwright.config.ts` |

`backend/` drives protocol flows with no UI — register, OTP/magic-link verify,
session, export. `browser/` drives the same product through the app a user sees.

They are configured from **different** files, which is easy to get wrong:

- `backend/` reads the repo-root `.env` — `ZD_PROJECT_ID`, `ZD_OTP_PROJECT_ID`
  (see `.env.example`). `backend/global-setup.ts` fails fast when either is missing.
- `browser/` drives the QA lab, which playwright starts with `pnpm dev`
  (`playwright.config.ts`), so the lab's own `apps/qa-lab-testing/.env` supplies the
  `NEXT_PUBLIC_*` values. A root `.env` alone will not configure it.

## What does NOT belong here

Anything that can run without a live service. A test spanning two packages with
no network is an **integration** test: name it `*.integration.test.ts` and put it
beside the package source. That layer has no runner yet — it arrives with its
first test. `e2e/` is the expensive layer, rate-limited by staging and slow, so a
test lands here only because it genuinely cannot be written cheaper.
