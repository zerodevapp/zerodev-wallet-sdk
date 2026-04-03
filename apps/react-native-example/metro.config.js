// Learn more https://docs.expo.io/guides/customizing-metro
const path = require('path')
const { getDefaultConfig } = require('expo/metro-config')
const { withNativeWind } = require('nativewind/metro')

const projectRoot = __dirname
const monorepoRoot = path.resolve(projectRoot, '../..')

const config = getDefaultConfig(projectRoot)

// 1. Watch all files in the monorepo
config.watchFolders = [monorepoRoot]

// 2. Resolve packages from both project and monorepo root node_modules
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(monorepoRoot, 'node_modules'),
]

// 3. Apply NativeWind wrapper
const finalConfig = withNativeWind(config, {
  input: './global.css',
})

// 4. Singleton resolver — force a single copy of critical packages.
//    In pnpm monorepos each workspace package can get its own copy of
//    shared deps.  We pre-resolve from the app's node_modules so every
//    import throughout the bundle uses the same instance.
const singletonModules = [
  'react',
  'react/jsx-runtime',
  'react/jsx-dev-runtime',
  'nativewind/jsx-runtime',
  'nativewind/jsx-dev-runtime',
  'react-native-css-interop/jsx-runtime',
  'react-native-css-interop/jsx-dev-runtime',
  'react-native',
]

const resolvedSingletons = {}
for (const mod of singletonModules) {
  try {
    resolvedSingletons[mod] = require.resolve(mod, { paths: [projectRoot] })
  } catch (_e) {
    // not every subpath exists on every platform
  }
}

// On web, react-native must resolve to react-native-web.
let resolvedRNWeb
try {
  resolvedRNWeb = require.resolve('react-native-web', { paths: [projectRoot] })
} catch (_e) {}

const wrappedResolveRequest = finalConfig.resolver?.resolveRequest
finalConfig.resolver.resolveRequest = (context, moduleName, platform) => {
  // Web: map react-native → react-native-web (same single copy for all packages)
  if (platform === 'web' && moduleName === 'react-native' && resolvedRNWeb) {
    return { filePath: resolvedRNWeb, type: 'sourceFile' }
  }

  if (resolvedSingletons[moduleName]) {
    return { filePath: resolvedSingletons[moduleName], type: 'sourceFile' }
  }

  if (wrappedResolveRequest) {
    return wrappedResolveRequest(context, moduleName, platform)
  }
  return context.resolveRequest(context, moduleName, platform)
}

module.exports = finalConfig
