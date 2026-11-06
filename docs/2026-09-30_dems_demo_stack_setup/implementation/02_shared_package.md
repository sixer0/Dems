---
task_id: 2026-09-30_dems_demo_stack_setup
blueprint_row: 15
agent: coder-execution
narrative_tier: 3
status: complete
date: 2026-10-01
spec: masterplan/01_specs.md §1.4 (@dems/shared), §1.5, §2.1-§2.10, §8 (S-1, S-2)
---

# Row 15: `packages/shared` (`@dems/shared`)

## Installed (rule R-2, `npm install --save-exact … -w @dems/shared`, workspace-local cache)

`npm ls --workspaces --depth=0`:

```
`-- @dems/shared@0.1.0 -> ./packages/shared
  +-- @types/node@26.6.3
  +-- @types/react@19.2.18 overridden
  +-- oxlint@1.86.0
  +-- react@19.2.3 overridden
  +-- tsx@4.23.15
  +-- typescript@6.0.3
  +-- vitest@5.0.3
  `-- zod@4.6.5
```

All eight pins match §1.4. `peerDependencies.react = 19.2.3` set by hand. ("overridden" = the root `overrides` apply, as intended by SD-04.)

## Files (all under `/Users/gsp-budi/Documents/DEMS/packages/shared/`)

| File | Content |
|---|---|
| `package.json` | `@dems/shared` 0.1.0, private, ESM; exports `.`, `./domain`, `./api`, `./realtime`, `./tokens`, `./sim`, both theme CSS files, `./package.json`; scripts per §1.5 |
| `tsconfig.json` | extends `../../tsconfig.base.json`; `jsx: react-jsx`, `types: ["node"]` |
| `vitest.config.ts` | node environment, `test/**/*.test.ts` |
| `src/domain/ids.ts` | `EntityId<T>` branded string + `entityId()` cast helper |
| `src/domain/entities.ts` | 24 entity interfaces (§2.2), `ENTITY_NAMES` tuple, `EntityByName` map; compile-time proof that the tuple and map list the same names |
| `src/domain/enums.ts` | 24 enumerations of §2.3 as `const` objects + union types + `…Label` maps (book display text); extras: `StorageRecordingLabel` (READY → "OK"), `LedLongLabel` (RECORD/NETWORK), `TIME_SOURCE_PRIORITY`, `VideoTrackId`/`AudioTrackId` |
| `src/api/constants.ts` | The 14 constants of §2.4 (+ `API_VERSION`) |
| `src/api/health.ts` | `HealthResponse` + `HealthResponseSchema` (zod 4), compile-time shape equality check |
| `src/api/realtime-messages.ts` | `Heartbeat`, `WsServerMessage`, `HeartbeatSchema`, `WsServerMessageSchema` (`z.discriminatedUnion('type', …)`), compile-time shape checks |
| `src/realtime/heartbeat-client.ts` | `createHeartbeatClient()` (framework-free state machine of §2.6), `reconnectDelayMs()`, `SocketLike`/`SocketFactory` types |
| `src/realtime/heartbeat-context.tsx` | `HeartbeatProvider` (props `url?`, `socketFactory?`, `onResync?`), one client per app |
| `src/realtime/use-heartbeat.ts` | `useHeartbeat()` via `useSyncExternalStore` |
| `src/tokens/tokens.ts` | **Single token source** (§2.7): palette, derived, status text/soft, kit colour map, extra colours, fonts, typography, spacing, radius, stroke, elevation, kit shadows, motion |
| `src/tokens/status-tones.ts` | `StatusTone`, `toneChipProps()`, `toneHex`, `BADGES`, `TAGS`, `INDICATORS`, 12 enumeration tone maps (§2.8) |
| `src/sim/index.ts` | **Placeholder** for the in-browser simulator (D19); `export {}` only, with a header stating the purity rule |
| `src/index.ts`, `src/*/index.ts` | Barrels. Root `.` is framework-free (no React), so mock-core never loads React |
| `scripts/gen-theme.ts` | Generator; exports `generateTheme()`; writes both CSS files when run |
| `theme/heroui-web.css` | Generated (3,049 bytes) |
| `theme/heroui-native.css` | Generated (4,480 bytes) |
| `test/theme.test.ts` | S-1 (palette coverage, selectors, variants, **no-drift** check) |
| `test/schemas.test.ts` | S-2 (valid samples parse; `type:'nope'`, `seq:-1`, bad ISO time, wrong service rejected) |
| `test/heartbeat-client.test.ts` | State machine: CONNECTING→LIVE→STALE→LIVE→OFFLINE→CONNECTING→LIVE, one `onResync`, backoff table, invalid-message drop, snapshot identity |

## Verification

### `tsc --noEmit` (row-15 column) — PASS

```
> @dems/shared@0.1.0 build
> tsx scripts/gen-theme.ts && tsc --noEmit

wrote /Users/gsp-budi/Documents/DEMS/packages/shared/theme/heroui-web.css (3049 bytes)
wrote /Users/gsp-budi/Documents/DEMS/packages/shared/theme/heroui-native.css (4480 bytes)
build exit=0

> @dems/shared@0.1.0 typecheck
> tsc --noEmit
typecheck exit=0
```

Root `npm run typecheck` → exit 0 (the "No workspaces found" of row 14 is gone).

### Entity list matches §21.3 in `research/01_explore.md` (row-15 column) — PASS

Script: parse the §21.3 table rows of `01_explore.md`, strip non-letters, compare index by index with the `ENTITY_NAMES` tuple.

```
book (24): Device, HardwareRevision, SoftwareRelease, Operator, Role, AuthenticationEvent, Session, CaseReference, Subject/Witness metadata, VideoTrack, AudioTrack, TrackHealthEvent, EvidenceObject, Manifest, SignatureRecord, AuditEvent, ExportEvent, TamperEvent, Certificate, KeyReference, ProvisioningRecord, HealthSnapshot, StorageDevice, TimeSourceState
ours (24): Device, HardwareRevision, SoftwareRelease, Operator, Role, AuthenticationEvent, Session, CaseReference, SubjectWitnessMetadata, VideoTrack, AudioTrack, TrackHealthEvent, EvidenceObject, Manifest, SignatureRecord, AuditEvent, ExportEvent, TamperEvent, Certificate, KeyReference, ProvisioningRecord, HealthSnapshot, StorageDevice, TimeSourceState
MATCH: same 24 names in the same order
```

### Tokens import cleanly from a throwaway TypeScript check (row-15 column) — PASS

A throwaway project in the session scratchpad (`tokens_check/`, `node_modules` symlinked to the workspace, `tsconfig` extending `tsconfig.base.json`) imports through the **package exports** (`@dems/shared/tokens`, `/domain`, `/api`, `.`) with literal-type assertions (`const gold: '#FFC86B' = palette.gold`, `luxe: readonly [number, number, number, number]`).

```
throwaway tsc exit=0
{"gold":"#FFC86B","luxe":[0.22,1,0.36,1],"tone":"success","chip":{"color":"default","className":"bg-sealed-soft text-sealed-text border-sealed/40"},"springGentle":{"stiffness":170,"damping":26,"mass":1},"elevation1":"0 0 0 1px #FFC86B2E, 0 0 12px 0 #FFC86B1A","entities":24,"session":9,"live":"Live","ws":"ws://127.0.0.1:4400/ws","schema":"function","client":"function"}
throwaway run exit=0
```

### Lint and tests

```
oxlint 1.86.0: Found 0 warnings and 0 errors. Finished in 3ms on 22 files with 96 rules using 10 threads.

 RUN  v5.0.3 /Users/gsp-budi/Documents/DEMS/packages/shared
 Test Files  3 passed (3)
      Tests  14 passed (14)
```

(oxlint prints nothing when piped through npm; the counts above are from a direct `oxlint --format=default .` run. A `debugger;` probe file confirmed it reports violations.)

### Spec hypotheses closed here

| # | Hypothesis | Result |
|---|---|---|
| H-S1 | `erasableSyntaxOnly` exists in TS 6.0.3 | **Confirmed.** The flag is accepted, and a probe `export enum Bad { A }` fails with `error TS1294: This syntax is not allowed when 'erasableSyntaxOnly' is enabled.` No fallback needed |
| H-S5 | zod 4 API names `z.iso.datetime()`, `z.int()` | **Confirmed.** Used in both schemas; typecheck and S-2 pass (a non-ISO `serverTime` is rejected). No fallback needed |
| G-7 (03) | RN colour parsing and `oklch()` | Avoided by design: every token is sRGB hex |

## Decisions and deviations

| # | Item | Decision | Reason |
|---|---|---|---|
| S15-1 | `tsx` CLI inside the agent sandbox | `tsx scripts/gen-theme.ts` fails **only inside the sandbox** with `listen EPERM … /tmp/claude-501/tsx-501/<pid>.pipe` (tsx opens an IPC unix socket). Commands that run the `tsx` CLI were re-run with the sandbox disabled; the scripts stay as specified. `node --import tsx <file>` works inside the sandbox (used for the throwaway check) | Sandbox restriction on unix-socket listen, not a code defect. Normal shells are unaffected |
| S15-2 | Extra export `./sim` + `src/sim/index.ts` placeholder | Added | Controller directive (D19 simulator comes next) |
| S15-3 | Root `.` export is framework-free | `.` exports domain, api, tokens and the heartbeat client; `HeartbeatProvider`/`useHeartbeat` only via `@dems/shared/realtime` | Keeps React out of mock-core's Node process |
| S15-4 | `onResync` wiring | A `HeartbeatProvider` prop (the provider owns the single client). Apps pass `onResync={() => queryClient.invalidateQueries({ queryKey: ['health'] })}` | §2.6 says "Both apps pass" it but does not say where; one client per app avoids two sockets |
| S15-5 | Kit slots beyond the §2.9 skeleton | Web and native also set `--surface/overlay/default/segment/field-*-foreground` (= foreground), `--success-foreground`/`--warning-foreground` (= black, per the §2.7 table) and `--accent-soft(-foreground)` (gold 15% / gold) | The kits' dark defaults for these are not the design's values (e.g. `--default-foreground: var(--snow)`); gold soft is needed for the "IN REVIEW" accent tag |
| S15-6 | `--text-*--font-weight` | Emitted in the **web** theme only (display/h1 700, h2/h3 600, label 500) | So `text-display` alone carries weight 700 on web. On React Native every weight is its own family; a font-weight on a bold family would be synthesised again on Android |
| S15-7 | Native `--radius`/`--field-radius` | Placed in the native `@theme` block, not in the `@variant` blocks | HeroUI Native declares them in `@theme` (read from `heroui-native@1.0.10/lib/module/styles/variables.css`) |
| S15-8 | Extra tests | `test/heartbeat-client.test.ts` added beyond S-1/S-2 | Proves the state machine both apps rely on; row 20 may extend it |
| S15-9 | npm 11.19.1 install-script policy | **Corrected in row 18.** npm prints "install scripts not yet covered by allowScripts" and `npm help install-scripts` says they are blocked by default, but in this setup they **did run**: `node_modules/esbuild/bin/esbuild` became the native `Mach-O 64-bit executable arm64` at 00:27:21, 2 s after `esbuild/package.json` (00:27:19); and `@shopify/react-native-skia/libs/android` existed before any approval although the tarball has 0 `libs/` entries. The warning is advisory in this npm version. Row 18 approved exactly one package, `@shopify/react-native-skia@2.6.2` (root `package.json` `allowScripts`), after reading its script (local copy of prebuilt libs from its own dependencies), so the build keeps working once npm enforces the policy | Surfaced for the controller; `allowScripts` is a new root `package.json` field |
| S15-10 | First `npm install … -w @dems/shared` saved nothing | Warning `@dems/shared in filter set, but no workspace folder present` on the very first install into a brand-new workspace; re-running the same command saved `zod 4.6.5` correctly | npm registers a new workspace folder only after one install pass. Later rows run a plain `npm install` right after creating each workspace `package.json` |

## Kit variable source (read-only inspection)

`npm pack @heroui/styles@3.2.6 heroui-native@1.0.10` into the session scratchpad (not installed): `@heroui/styles/dist/themes/default/variables.css` (the `.dark` block sits in `@layer base` inside `layer(theme)`, so the unlayered generated block wins) and `heroui-native/lib/module/styles/{variables,theme}.css` (`@layer theme { :root { @variant dark {…} } }`, soft colours derived with `color-mix` in `@theme inline static`).

## Token rev 3 (D31, applied 2026-10-01 00:52 WIB)

Source: `masterplan/02_plan.md` §6.1 and `masterplan/01_specs.md` §2.7-§2.9 rev 3 (SPEC-C20, SPEC-C21). Token **values only**; no pin, package, port or path changed.

| Token | Rev 2 (built first) | Rev 3 (now) | Where |
|---|---|---|---|
| `surface` | `#1F262E` (charcoal) | `#191008` | `derived.surface` → `--surface` |
| `surface-secondary` / `field-background` | `#2A3138` / `#151A1F` | `#150E07` / `#150E07` | `derived.surfaceSecondary`, `derived.fieldBackground` |
| `surface-tertiary`, `segment` | `#353C43`, `#2A3138` | `#251C14`, `#251C14` | `derived.surfaceTertiary` (both) |
| `default` | `#353C43` | `#2B231C` | new `derived.default` |
| `overlay` | `#1F262E` | `#1F262E` (unchanged; Charcoal kept for L5) | `palette.charcoal` |
| `border` | `#FFC86B2E` | `#FF9F3D59` | `derived.border` |
| `--surface-shadow` / `shadow-glow-1` | `0 0 0 1px #FFC86B2E, 0 0 12px 0 #FFC86B1A` | `0 0 0 1px #FF9F3D59, 0 0 14px 0 #FF9F3D1F` | `elevation[1]` |
| `shadow-glow-2` | `0 0 0 1px #FFC86B52, 0 0 20px 0 #FFC86B2E` | `0 0 0 1px #FF9F3D80, 0 0 20px 0 #FF9F3D38` | `elevation[2]` |
| `--overlay-shadow` / `shadow-glow-3` | `0 0 0 1.5px #FFC86B8C, 0 0 32px 2px #FFC86B47` | `0 0 0 1.5px #FFC86BA6, 0 0 28px 2px #FF9F3D59` | `elevation[3]` |
| NEW | none | `--color-foreground-2: #D8CEC6`, `--color-charcoal: #1F262E` | `derived.foreground2`, `extraColors` |
| Badge Under Review | default | **warning** | `BADGES.UNDER_REVIEW` |
| Tag IN REVIEW | accent, soft | **warning, outline** | `TAGS.IN_REVIEW` |
| Tag EXPORTED | success, soft | **info, outline** | `TAGS.EXPORTED` |

Files changed: `src/tokens/tokens.ts`, `src/tokens/status-tones.ts`, `test/theme.test.ts` (S-1 expectations only: `--surface` now `derived.surface`, plus the rev-3 values of `--surface-secondary`, `--surface-tertiary`, `--default`, `--overlay`, `--border`, `--surface-shadow`, `--shadow-glow-3`, `--color-foreground-2`, `--color-charcoal`), and the regenerated `theme/heroui-web.css` (3,111 bytes) and `theme/heroui-native.css` (4,542 bytes).

Verification (sandbox disabled for the `tsx` step, S15-1):

```
> tsx scripts/gen-theme.ts && tsc --noEmit
wrote …/packages/shared/theme/heroui-web.css (3111 bytes)
wrote …/packages/shared/theme/heroui-native.css (4542 bytes)
build exit=0
 Test Files  4 passed (4)
      Tests  16 passed (16)
oxlint: Finished in 4ms on 24 files with 96 rules using 10 threads (0 warnings, 0 errors)

generated web block:
  --surface: #191008;
  --surface-secondary: #150E07;
  --surface-tertiary: #251C14;
  --overlay: #1F262E;
  --default: #2B231C;
  --segment: #251C14;
  --border: #FF9F3D59;
  --field-background: #150E07;
  --surface-shadow: 0 0 0 1px #FF9F3D59, 0 0 14px 0 #FF9F3D1F;
  --overlay-shadow: 0 0 0 1.5px #FFC86BA6, 0 0 28px 2px #FF9F3D59;
  --color-foreground-2: #D8CEC6;
  --color-charcoal: #1F262E;
  --shadow-glow-2: 0 0 0 1px #FF9F3D80, 0 0 20px 0 #FF9F3D38;
```

Every value equals the rev-3 skeleton in `01_specs.md` §2.9. Consumers: core-web was rebuilt and its screenshots re-taken on rev 3 (`04_core_web_app.md`); the mobile app (row 18) is built on rev 3 from the start.

Later shared additions (all additive, no contract change):

| Added in | Export | File | Why |
|---|---|---|---|
| row 17 | `HeartbeatStateIcon`, `TYPOGRAPHY_FONT_SIZE_CLASSES` | `src/tokens/status-tones.ts` | Chip icon per heartbeat state; font-size token list for `extendTailwindMerge` (S17-1) |
| row 17 | `formatClock`, `DISPLAY_UTC_OFFSET_MINUTES` (+ `test/format.test.ts`) | `src/realtime/format.ts` | UTC+07:00 `HH:mm:ss` without `Intl` (Hermes-safe) |
| row 18 | `useRetryCooldown`, `RETRY_MAX_ATTEMPTS` | `src/realtime/use-retry-cooldown.ts` | One rate-limited retry hook for both apps' error boundaries (moved from core-web) |
| row 18 | `fetchHealth()`, `HEALTH_QUERY_KEY` | `src/api/health.ts` | One validated health fetch for both apps |
| row 18 | `toneTextHex` | `src/tokens/status-tones.ts` | AA text/icon colour per tone for native icon tints |

Final root run after row 18 (sandbox disabled): `npm run build` exit 0 (themes regenerated byte-identical: 3,111 / 4,542 bytes), `npm run typecheck` exit 0, `npm run lint` exit 0, `npm test` exit 0 with shared `Test Files 4 passed (4) / Tests 16 passed (16)`.

## Rollback

`rm -rf packages/shared && npm install` (removes the workspace and its lockfile entries).

---
*Generated: 2026-10-01 00:36 WIB*
