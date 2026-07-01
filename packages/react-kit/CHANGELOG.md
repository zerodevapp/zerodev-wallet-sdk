# @zerodev/wallet-react-kit

## 0.0.1-alpha.4

### Patch Changes

- Adapt to doorway-kms backend auth changes:
  - getAuthenticators and getUserWallet now use GET with an X-Timestamp + stamp header (new `timestamp` stamp position) to match StampCheckUser
  - OTP code length and the magic-link URL template are now configured per-project on the backend; drop the client-supplied `otpCodeCustomization` /
    `emailCustomization`, the magic-link `redirectURL`, and react-kit's `magicLinkBaseUrl`
- Updated dependencies
  - @zerodev/wallet-core@0.0.1-alpha.24
  - @zerodev/wallet-react@0.0.1-alpha.27

## 0.0.1-alpha.3

### Patch Changes

- Updated dependencies
  - @zerodev/wallet-core@0.0.1-alpha.23
  - @zerodev/wallet-react@0.0.1-alpha.26

## 0.0.1-alpha.2

### Patch Changes

- Updated dependencies
  - @zerodev/wallet-core@0.0.1-alpha.22
  - @zerodev/wallet-react@0.0.1-alpha.25

## 0.0.1-alpha.1

### Patch Changes

- Updated dependencies
  - @zerodev/wallet-core@0.0.1-alpha.21
  - @zerodev/wallet-react@0.0.1-alpha.24

## 0.0.1-alpha.0

### Patch Changes

- feat: initial react-kit release
- Updated dependencies
  - @zerodev/wallet-core@0.0.1-alpha.20
  - @zerodev/wallet-react@0.0.1-alpha.23
