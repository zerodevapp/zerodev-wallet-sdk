const { getDefaultConfig } = require('expo/metro-config')
const path = require('path')

const config = getDefaultConfig(__dirname)
const packagesDir = path.resolve(__dirname, '../../packages')
const appPackageJson = path.resolve(__dirname, 'package.json')

// Packages that must resolve to a single copy to avoid duplicate
// React contexts. pnpm creates separate .pnpm entries with different
// peer-dep hashes for the app vs workspace packages.
const singletonPackages = new Set([
  'react',
  'wagmi',
  // @wagmi/core is not explicitly used in the app but to make this work we needed to add it to package.json dependencies.
  '@wagmi/core',
  '@tanstack/react-query',
])

const originalResolveRequest = config.resolver.resolveRequest
config.resolver.resolveRequest = (context, moduleName, platform) => {
  // Only redirect imports originating from workspace packages
  // (e.g. packages/react/), not from within .pnpm dependency trees.
  if (
    singletonPackages.has(moduleName) &&
    context.originModulePath.startsWith(packagesDir)
  ) {
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
