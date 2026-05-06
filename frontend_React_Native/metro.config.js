// @ts-check
const { getDefaultConfig } = require('expo/metro-config');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

const upstreamResolveRequest = config.resolver.resolveRequest;

/**
 * react-native-svg declares `"react-native": "src/index.ts"`, so Metro prefers
 * the Fabric/src graph. That path imports `react-native/Libraries/Utilities/codegenNativeComponent`,
 * which on web resolves through react-native-web and is undefined there — runtime:
 * "(0 , _reactNativeWebDistIndex.codegenNativeComponent) is not a function".
 * For web, use the compiled `lib/module` entry so `./ReactNativeSVG` resolves to
 * `ReactNativeSVG.web.js` (DOM/WebShape) instead of fabric codegen.
 */
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (platform === 'web' && moduleName === 'react-native-svg') {
    return {
      type: 'sourceFile',
      filePath: require.resolve('react-native-svg/lib/module/index.js'),
    };
  }
  if (typeof upstreamResolveRequest === 'function') {
    return upstreamResolveRequest(context, moduleName, platform);
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
