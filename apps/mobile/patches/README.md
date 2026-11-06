# Library source patches (apps/mobile)

One patch, decision D247 (note `docs/2026-10-07_dems_real_capture_sealing/implementation/178_fix_wave_q_n_native.md`).

## `react-native-reanimated+4.5.1.patch` (Android only)

**Why.** On React Native 0.86 the library retries its whole registry of animated props on every event that is
dispatched inside a draw pass (`NodesManager.kt` `onEventDispatch` -> `performNonLayoutOperations`). For every
registry entry whose native view no longer exists, `NativeProxy.synchronouslyUpdateUIProps` caught a
`RetryableMountingLayerException` and logged it with its stack (about 190 frames) on the UI thread. The events
are `react-native-svg`'s per-icon layout events, so one screen mount cost (icons) x (dead tags) stacks; in an
app process that had lived for an hour a recording screen stood still for tens of seconds (finding CT-01).

**What.** One file, `android/src/main/java/com/swmansion/reanimated/NativeProxy.kt`: before the synchronous
update the tag is checked with React Native's own `MountingManager.getViewExists` (the exact precondition of
that exception); a tag without a mounted view is skipped, counted, and reported in one `I/Reanimated
DEMS-PATCH skipped N ...` line at most every 5 s; a failure that still happens is logged in one line without
a stack. The C++ registry is not touched: its entries belong to the library, and a view that is not mounted
YET must still get its props once it is. iOS has no such path (`REANodesManager.mm` messages a nil view).

**How it is applied.** `apps/mobile/scripts/apply-patches.sh` (POSIX sh, the system `patch` tool; no
dependency) is the root `postinstall` script. It refuses any installed version other than exactly 4.5.1,
detects an applied patch, and fails loudly when a hunk does not apply. The Android build cannot miss it:
`apps/mobile/plugins/with-dems-library-patches.js` adds the Gradle task `demsCheckLibraryPatches` (a
dependency of `preBuild`) that fails every variant when the version differs or the marker
`DEMS-PATCH react-native-reanimated+4.5.1` is absent from the library source. An install with
`--ignore-scripts` skips `postinstall`: run `npm run patches:apply -w @dems/mobile` by hand afterwards (the
Gradle guard says so if it is forgotten). The patch needs a native build to take effect; Metro does not serve it.

**How to drop it when the library is upgraded.** Read the new version's `NativeProxy.kt`
(`synchronouslyUpdateUIProps`): if it no longer logs a throwable per failed tag (or checks the view first),
delete the patch file, the `postinstall` line of the root `package.json`, the two `patches:*` scripts of
`apps/mobile/package.json`, `plugins/with-dems-library-patches.js` with its `app.json` entry, and the
`library source patches` block of `src/components/media/brand-media.test.ts`. If it still does, re-make the
diff against the new source, rename the file to the new version and change the version in the script, the
plugin and the test (three places, pinned to each other by that test). Then prebuild and build.
