// ESLint 9+ flat config for Expo. See https://docs.expo.dev/guides/using-eslint
const expoConfig = require('eslint-config-expo/flat')

module.exports = [
  ...expoConfig,
  {
    ignores: [
      'node_modules/**',
      '.expo/**',
      'dist/**',
      'build/**',
      '*.config.js',
      'babel.config.js',
    ],
  },
]
