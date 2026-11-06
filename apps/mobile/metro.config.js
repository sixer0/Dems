// masterplan/01_specs.md §5.3 (vendor pattern, V28). No manual watchFolders or resolver overrides:
// Expo configures npm-workspace monorepos automatically (SD-03, SD-04 RA-5).
const { getDefaultConfig } = require('expo/metro-config');
const { withUniwindConfig } = require('uniwind/metro');

module.exports = withUniwindConfig(getDefaultConfig(__dirname), {
  cssEntryFile: './src/global.css',
  dtsFile: './src/uniwind-types.d.ts',
});
