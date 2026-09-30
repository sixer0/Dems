// ESLint 9 flat config with eslint-config-expo (SPEC-C3).
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ['dist/*', 'android/*', 'ios/*', '.expo/*', 'src/uniwind-types.d.ts', 'expo-env.d.ts'],
  },
]);
