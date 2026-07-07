# E2E Tests

## Two-mode testing strategy

Browser tests run in two modes controlled by the `USE_REAL_EMAIL` environment variable.

| | Mock mode (`USE_REAL_EMAIL=false`) | Real-email mode (`USE_REAL_EMAIL=true`) |
|---|---|---|
| **When** | PR CI, local development | Nightly scheduled run |
| **Email** | Intercepted via `page.route()` | mail.tm temporary inbox |
| **Auth session** | Fake JWT (never hits backend) | Real session from ZeroDev KMS |
| **Signing** | Fake signature stub | Real ZeroDev KMS signing |
| **Wallet address** | Indeterminate (no real account) | Real counterfactual address |
| **Project config** | Not enforced | Enforced (chains, sponsorship) |
| **Speed** | Fast, no network waits | Slower, dependent on external services |

### What mock mode does NOT cover

Mock mode verifies UI flow and component wiring. It deliberately bypasses:

- **Session validation** — the fake JWT is never checked against the database; user/org do not exist.
- **Project configuration** — allowed chains, permitted operations, and gas sponsorship rules are never evaluated.
- **Cryptographic signing** — the returned signature is a deterministic stub; it is not valid for any message and is not tied to any key or wallet address.
- **Real wallet address** — no account is created; wallet address is meaningless in mock mode.

These gaps exist because mocking auth cascades: once auth is mocked the backend rejects all subsequent authenticated requests, so signing endpoints must also be mocked. This is an accepted tradeoff — the nightly real-email run covers correctness end-to-end.

### What mock mode does cover

- OTP entry form renders and accepts input
- Magic-link entry form renders and accepts input
- Error states (wrong code, expired session) — by adjusting fixture responses
- Post-auth UI (wallet address display, sign message, logout flow)
- Component composition in `@zerodev/wallet-react-kit`

## Directory structure

```
e2e/
├── browser/           # Playwright tests (UI + integration)
│   ├── otp.spec.ts
│   ├── magic-link.spec.ts
│   └── post-auth.spec.ts
├── integration/       # Vitest tests against real backend (no UI)
├── fixtures/
│   ├── auth.ts                      # Playwright fixture extensions (OTP, magic-link, authenticated sessions)
│   ├── test-otp-bundle.json         # Pre-signed EncryptionTargetEnvelope for mock mode
│   ├── test-signer-public-key.txt   # enclaveQuorumPublic hex for the test key pair
│   └── README.md                    # Fixture regeneration instructions
├── helpers/
│   ├── mock-backend.ts              # page.route() intercepts for auth + signing
│   ├── mock-session.ts              # Fake session JWT builder
│   └── env-utils.ts                 # isRealEmail() helper
└── scripts/
    └── generate-test-otp-bundle.ts  # One-time fixture generator
```

## Running tests locally

```bash
# Mock mode (default — no email service needed)
pnpm test:e2e:headed

# Real-email mode
USE_REAL_EMAIL=true pnpm test:e2e:headed
```

`USE_REAL_EMAIL` unset is treated as `false` — mock mode is the default so tests work out of the box without any configuration.

## CI workflows

- **`ci.yml`** calls `test.yml` with `use_real_email: false` on every PR and push to `main`/`develop`.
- **`scheduled-tests.yml`** calls `test.yml` with `use_real_email: true` daily at 08:00 UTC.

## Fixture maintenance

The pre-signed OTP bundle in `e2e/fixtures/` must be regenerated when `encryptOtpAttempt` validation logic or the `EncryptionTargetEnvelope` shape changes. See [`e2e/fixtures/README.md`](fixtures/README.md) for instructions.
