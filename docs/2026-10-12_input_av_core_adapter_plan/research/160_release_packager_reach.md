# Row 160 - can the release packager reach apps/input-av? (S13-14 (e) / AD-12)

Tier T3. Read-only. Date 2026-10-12. Agent: data-analyst. Requirement: AD-12, security item S13-14 (e).
Method: read the packaging scripts and the root and workspace `package.json` files, and grep their sources for `input-av`. Nothing under `apps/input-av/` was opened, listed or stat-ed. No packager or build was run. No `.env` was read.

## Answer: NO

The release packager cannot reach `apps/input-av`. It has no include rule that names, globs or walks that path. Every file it copies or hashes comes from a fixed allow-list of named paths, and `apps/input-av` is not on it. There is no exclude rule for it and none is needed, because the design is allow-list only.

## Rule by rule (all paths relative to the repository root)

1. **Allow-list of build inputs.** `scripts/release/build-web-packages.ts:133-150`, `INPUT_ROOTS`, has 16 entries. They are `apps/core-web/{src,public,index.html,vite.config.ts,package.json}`, `packages/shared/{src,assets,theme,openapi,package.json}`, `apps/mock-core/standalone/dems-web-launcher.cjs`, the two `scripts/release/*.ts` files, `THIRD_PARTY_NOTICES.md`, `package.json` and `package-lock.json`.
   - The only directory walker is `walk()` at lines 98-108. Its only caller is the fingerprint loop at lines 164-167, which iterates `INPUT_ROOTS` and calls `walk()` on those roots only.
   - It never walks `apps/` or `ROOT`.
2. **Files that go into the packages.** Only fixed constants are copied:
   - `addApp()` at lines 508-514 copies `LAUNCHER` (line 57, `apps/mock-core/standalone/dems-web-launcher.cjs`), `MANIFEST` and `WEB_DIST` (`.cache/release/web-dist`, the output of a vite build run with cwd `apps/core-web`, lines 266-268).
   - `addLicenses()` at lines 500-506 copies `THIRD_PARTY_NOTICES.md` (line 58) and the generated licence files.
   - The runtime and SEA copies at lines 566-594 copy only Node binaries from `.cache`.
3. **Gate.** Lines 246-257 run typecheck, lint and tests only with cwd `apps/core-web` and `apps/mock-core`, or with `-w @dems/core-web` and `-w @dems/mock-core`.
4. **Licence collection is workspace-scoped.**
   - `scripts/release/collect-web-licenses.ts:27` sets `WORKSPACE = '@dems/core-web'`. Line 116 runs `npm ls ... -w @dems/core-web`, and lines 133-139 read the three `@fontsource-variable/*` licence files.
   - `scripts/release/gen-npm-licenses.mjs:95` runs `npm ls ... -w <workspace>`. Its workspace comes from the `--workspace` argument (header, line 6, shows `@dems/mobile`).
   - Neither script is a packager of source. Both write licence text only. The tree starts at the named workspace, and `@dems/input-av` is not among the dependencies of `core-web`, `shared`, `mock-core` or `mobile`.
5. **No dependency edge.**
   - `grep -rl input-av apps/core-web apps/mock-core apps/mobile packages scripts`, excluding `node_modules`, `android` and `dist`, returned no file.
   - `grep -n input-av package.json .gitignore` returned nothing.
   - So there is no import, relative path or package dependency from the packaged inputs to `apps/input-av`. The vite bundle cannot pull it in.
6. **Root `package.json`.**
   - There is no `pack`, `release` or `dist` script. The only release-related scripts are `build` (line 34, which names `@dems/shared`, `@dems/mock-core` and `@dems/core-web` explicitly) and `build:android` (line 35, which runs `build -w @dems/mobile`; that script is `apps/mobile/package.json:9`, an expo prebuild plus gradle in `apps/mobile`).
   - Nothing in `package.json` or in `scripts/release/` names `apps/input-av`. The web packager is run directly as `node --import tsx scripts/release/build-web-packages.ts` (header, line 4).

## What does touch the path, and why it is not a reach

- `package.json:9-12` declares `workspaces: ["packages/*", "apps/*"]`. If `apps/input-av` has a `package.json`, npm treats it as a workspace. This was not checked, because the path is off limits.
  - The glob affects `npm install` and the root `typecheck`, `lint` and `test` scripts (lines 36-38, `--workspaces`).
  - It does not affect packaging. Every packaging step above names its workspace or its paths.
  - A workspace is not copied into a package unless something in `INPUT_ROOTS` or a dependency edge points at it, and neither does.
- `build-web-packages.ts:123` runs `git status --porcelain` on the whole repository. `gitStatusSummary()` at lines 217-240 counts those lines by area, so an `apps/input-av` entry would appear in `BUILD-INFO` as a count (line 226).
  - That is a path string in a log. No file content is read or copied.
  - `release/` is git-ignored (preflight, line 117), so the output stays out of git.

## Residual and proposal

- Residual, not a yes: the answer holds for the packager as it is today. A future edit that adds an `apps/input-av/...` path to `INPUT_ROOTS`, or an import from `core-web` or `shared` into `apps/input-av`, would change it.
- Does the answer require a new row? No, because the answer is no (blueprint row 160: "if yes, a row is proposed").
- Optional hardening, for the controller to take or leave: the first row that edits `scripts/release/` could add a one-line fail-closed assertion in `fingerprint()` that no `INPUT_ROOTS` entry starts with `apps/input-av`. This is not required for S13-14 (e). It is a DRIVER suggestion, not a decision.

## Unproven

Static reading only. The packager was not run, as the row forbids. Whether `apps/input-av` is an npm workspace was not checked, because the path was not opened.
