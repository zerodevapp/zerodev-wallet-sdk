/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_ZERODEV_PROJECT_ID: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
