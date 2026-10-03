// Mobile Jest configuration: masterplan/01_specs.md §8 plus 04_mobile_specs.md §10.1.
// Step 67 moved it out of package.json so later rows never edit package.json (P1, P6).
// Mocks live in jest.setup.ts. Skia compositions are mocked per test file at module level
// (the N-1 precedent); their maths are tested as pure TypeScript.
/** @type {import('jest').Config} */
module.exports = {
  preset: 'jest-expo',
  setupFilesAfterEnv: ['./jest.setup.ts'],
  transformIgnorePatterns: [
    // §10.1: @noble/* is ESM only (VM-15), so it joins the transform allowlist.
    // D69 (F-70-3, step 75): standard-navigation, an ESM-only dependency of expo-router 57, joins it
    // too, so any suite can import the `expo-router` entry without a module mock.
    // D111 (step 75b): victory-native 42 depends on the ESM-only d3-* packages and internmap
    // (`"type": "module"`, `exports.default` → src/index.js), so they join it as well.
    'node_modules/(?!((jest-)?react-native|@react-native(-community)?)|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|react-native-svg|heroui-native|uniwind|@shopify/.*|@gorhom/.*|lucide-react-native|victory-native|d3-.*|internmap|@dems/.*|@noble/.*|standard-navigation)',
  ],
  moduleNameMapper: {
    // Under the react-native export condition Jest would pick lucide's untransformed ESM build (M18-6).
    '^lucide-react-native$':
      '<rootDir>/../../node_modules/lucide-react-native/dist/cjs/lucide-react-native.js',
  },
};
