const { getDefaultConfig } = require('expo/metro-config')
const path = require('path')

const config = getDefaultConfig(__dirname)
const packagesDir = path.resolve(__dirname, '../../packages')
const appPackageJson = path.resolve(__dirname, 'package.json')

// Required so Metro honors `package.json` "exports" maps and our conditional
// `react-native` entries in @zerodev/wallet-react and @zerodev/wallet-core
// resolve correctly.
config.resolver.unstable_enablePackageExports = true
config.resolver.unstable_conditionNames = [
  ...(config.resolver.unstable_conditionNames ?? []),
  'react-native',
  'import',
]

// Packages that must resolve to a single copy to avoid duplicate
// React contexts. pnpm creates separate .pnpm entries with different
// peer-dep hashes for the app vs workspace packages.
// Only redirected when imported from workspace packages (packages/*).
const workspaceSingletons = new Set([
  'wagmi',
  '@wagmi/core',
  '@tanstack/react-query',
])

// Packages that must resolve to the app's copy globally — safe because
// they are leaf packages with no internal dependencies that would break.
// `@zerodev/wallet-react` and `@zerodev/wallet-core` are in this set
// because the connector holds Zustand state reachable from hooks —
// duplicate copies under different pnpm `.pnpm` hashes would split
// auth/session state across the app.
const globalSingletons = new Set([
  'react',
  'react-dom',
  'react-native',
  'tslib',
  '@zerodev/wallet-react',
  '@zerodev/wallet-core',
])

// Check if moduleName matches or is a sub-path of any package in the set
// e.g. "react-dom/client" matches "react-dom"
function matchesSingleton(moduleName, singletonSet) {
  for (const pkg of singletonSet) {
    if (moduleName === pkg || moduleName.startsWith(pkg + '/')) return true
  }
  return false
}

const originalResolveRequest = config.resolver.resolveRequest
config.resolver.resolveRequest = (context, moduleName, platform) => {
  const fromWorkspace =
    matchesSingleton(moduleName, workspaceSingletons) &&
    context.originModulePath.startsWith(packagesDir)

  if (fromWorkspace || matchesSingleton(moduleName, globalSingletons)) {
    return context.resolveRequest(
      { ...context, originModulePath: appPackageJson },
      moduleName,
      platform,
    )
  }

  if (originalResolveRequest) {
    return originalResolveRequest(context, moduleName, platform)
  }
  return context.resolveRequest(context, moduleName, platform)
}

module.exports = config
