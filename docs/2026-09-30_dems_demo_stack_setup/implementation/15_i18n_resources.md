---
task_id: 2026-09-30_dems_demo_stack_setup
step: 34
plan_row: 02_plan §4 W-03 part b; 01_specs §14.11 (SCR-05)
date: 2026-10-01
agent: coder-execution
tier: 3
status: complete
---

# Step 34: Shared i18n resources and the arithmetic `formatDate` (SCR-05)

**Outcome: PASS.** All five row-34 checks pass. The command output is in §3.
- 13 English namespace files and the `./i18n` index exist (1,083 keys).
- `en` is one plain object. A test deep-merges it with a sample mobile namespace.
- Tersangka, Saksi and Lainnya appear verbatim, with the EN glosses Suspect, Witness and Other.
- `formatDate` passes for UTC+07:00, and `format.ts` contains no `Intl`.
- The shared typecheck exits 0.

## 1. What changed

| File | Change | Lines |
|---|---|---|
| `packages/shared/src/i18n/index.ts` | new: the `./i18n` export target from step 27. Exports `en` (13 namespace keys), `EnResources`, `SharedNamespace`, `SHARED_NAMESPACES`, `DEFAULT_LANGUAGE`, `mergeResources`, `ResourceTree`, `MergedResources` and each namespace object | 94 |
| `packages/shared/src/i18n/resource-tree.ts` | new: the `ResourceTree` type, the `MergedResources<A, B>` type, and `mergeResources(base, overlay)`. The merge returns a fresh deep copy, never mutates its inputs, and skips `__proto__`, `constructor` and `prototype` | 73 |
| `packages/shared/src/i18n/en/common.ts` | new: brand, actions, statuses, subject types plus glosses, and every enum label map (§2) | 578 |
| `packages/shared/src/i18n/en/{shell,login,dashboard,session,session-new,evidence,devices,storage,network-time,security-audit,system,api-reference}.ts` | new: one namespace per web area | 63–197 each |
| `packages/shared/src/realtime/format.ts` | extended (§4) | 169 |
| `packages/shared/test/i18n.test.ts` | new: 14 tests | 249 |
| `packages/shared/test/format.test.ts` | extended from 2 to 14 tests | 145 |

Nothing else was written. `git status --short` on the owned paths lists only these files:

```
 M packages/shared/src/realtime/format.ts
 M packages/shared/test/format.test.ts
?? packages/shared/src/i18n/
?? packages/shared/test/i18n.test.ts
```

## 2. Resource shape

**One object, 13 namespaces.** Each file in `en/` maps to one top-level key of `en`. Kebab-case file names become camelCase keys.

| Key | File | Keys |
|---|---|---|
| `common` | `common.ts` | 404 |
| `shell` | `shell.ts` | 53 |
| `login` | `login.ts` | 38 |
| `dashboard` | `dashboard.ts` | 69 |
| `session` | `session.ts` | 106 |
| `sessionNew` | `session-new.ts` | 60 |
| `evidence` | `evidence.ts` | 101 |
| `devices` | `devices.ts` | 43 |
| `storage` | `storage.ts` | 33 |
| `networkTime` | `network-time.ts` | 33 |
| `securityAudit` | `security-audit.ts` | 39 |
| `system` | `system.ts` | 70 |
| `apiReference` | `api-reference.ts` | 34 |
| **Total** | | **1,083** |

**Syntax.**
- i18next JSON v4: `{{name}}` interpolation and `_one` / `_other` plurals.
- Each namespace is declared `as const satisfies ResourceTree`, so typed `t()` keys are available to the apps.
- The files hold no runtime code and do not import i18next. They load the same way in Node, the browser and Hermes.

**Wiring for steps 38 and 68/73.** Both apps use one `translation` namespace, so keys read as `t('dashboard.hero.paragraph')`, as in 01_specs §14.11:

```ts
import { en, mergeResources } from '@dems/shared/i18n';
i18next.init({ lng: 'en', fallbackLng: 'en', resources: { en: { translation: mergeResources(en, enMobile) } } });
```

Pass the `mergeResources` result, not `en` itself. i18next's deep `addResourceBundle` extends the stored object in place, and the merge returns a copy.

**Copy sources and rules.**
- Copy comes from research/04 §2, §3 and §5, and from 01_specs §14.4, §14.5 and §14.8.
- Indonesian terms are verbatim: `common.subjectType` = Tersangka / Saksi / Lainnya, with `common.subjectTypeGloss` = Suspect / Witness / Other. Also "SEDANG MEREKAM" (`devices.other.recordingLamp`, gloss "Recording in progress") and the case format `LP/YYYY/MMDD-NNNN`.
- **Mockup typo fixed:** research/04 §9 #2 → `session.actions.pauseMonitoring.title` = "Pause Monitoring".
- **D38:** "End Session" is the label on `common.actions.endSession` and on the Session Monitor button and dialog. No string matches `stop (session|recording)`, and the audit and event label for `RECORDING_STOPPED` is "Recording ended".
- **Other decisions applied:** "Start New Session" (research/04 §9 #27), the USED % wording "{{free}} free of {{total}}" (D28/Q1) and "Version {{version}} is ready to install" (§9 #19).

**Enum maps are keyed by wire values.** A page can write `t('common.enums.micState.' + state)` with no lookup table.
- **Book enums** come from `src/domain/enums.ts`. A test covers all 20 maps. Where the book gives display text (finalization steps, update steps, MIC states, network domains), the labels equal it.
- **Demo vocabulary** is keyed by step 31's in-progress `src/sim/vocabulary.ts`, read only at 02:36 WIB. It covers roles, subject types, evidence status, precheck check IDs and status, audit types and categories, event types, fault kinds, scenarios, pairing and tablet link, service, diagnostic and update states, and retention policies. No test pins these maps, for the reason in §5 H-2.

## 3. Verification (row 34 checks)

| Check | Command | Result |
|---|---|---|
| 13 namespace files and the index | `ls packages/shared/src/i18n/en/*.ts \| wc -l`; `ls packages/shared/src/i18n` | `13`; `en index.ts resource-tree.ts` |
| The index export is a plain object that deep-merges with a sample mobile namespace | `npx -w @dems/shared vitest run --maxWorkers=2 test/format.test.ts test/i18n.test.ts` | `Test Files 2 passed (2)`, `Tests 28 passed (28)` |
| Tersangka, Saksi and Lainnya verbatim | `grep -rnE "Tersangka\|Saksi\|Lainnya" packages/shared/src/i18n` | `common.ts:109 TERSANGKA: 'Tersangka'`, `:110 SAKSI: 'Saksi'`, `:111 LAINNYA: 'Lainnya'` |
| formatDate passes for UTC+07:00; no Intl in format.ts | same test run; `grep -c Intl packages/shared/src/realtime/format.ts` | pass; `0` |
| Shared typecheck | `npm run typecheck -w @dems/shared` | exit 0 |

**Extra evidence.**

| Check | Result |
|---|---|
| Full shared suite: `npx -w @dems/shared vitest run --maxWorkers=2` | 02:36 WIB: `Test Files 7 passed (7)`, `Tests 141 passed (141)`, exit 0. Final run at 02:38 WIB: `Test Files 8 passed (8)`, `Tests 156 passed (156)`; the eighth file came from a concurrent step |
| Shared lint: `oxlint` on the package and on the changed files | exit 0 |
| core-web typecheck (`formatClock` now accepts wider input) | exit 0 |
| Package export resolution from `apps/core-web` (`node --import tsx`) | `namespaces 13 common,shell,…,apiReference`; `formatDate Thu, 1 Oct 2026` |

**Runtime smoke with the pinned i18next 26.4.2**, run from `apps/core-web` against `mergeResources(en, { mobile: … })`. No file was written.

```
All core services are running and the system is ready for recording.
Saksi / Witness
End Session | Pause Monitoring
1 new alert | 3 new alerts
3.2 TB free of 4.0 TB
Home
missing keys recorded: ["dashboard.doesNotExist"]
```

This shows that nested keys, plurals, interpolation and the merged `mobile.*` key all resolve. The `missingKeyHandler` (the AC-66 mechanism) fires only for the deliberately bad key.

**What the tests assert.**

`test/i18n.test.ts`:
- There are exactly 13 files, and they match the `en` keys.
- `en` is a plain tree: every node has `Object.prototype` as its prototype, and it survives a JSON round-trip and `structuredClone`.
- The mobile merge adds 4 leaves and extends `common.actions` without replacing it. The inputs are unmodified and share no objects with the result.
- An overlay leaf wins, and a `__proto__` key is ignored with no pollution.
- The 20 book-enum maps are complete, and the book labels are kept.
- The subject types and glosses are exact.
- "SEDANG MEREKAM" and `LP/` are present.
- The "End Session" rule and the "Pause Monitoring" fix hold.
- The USED wording is correct.
- There are no empty values or stray whitespace, placeholders are well formed, and every `_one` has an `_other`.

`test/format.test.ts`:
- The `formatClock` cases are kept. Epoch-ms and `Date` input are added.
- `formatDate`:
  - top-bar date at midnight WIB: `2026-09-30T17:00:00Z` → "Thu, 1 Oct 2026", and one millisecond earlier → "Wed, 30 Sep 2026";
  - all 9 named patterns, including `[SES-]YYYYMMDD[-0017]` → `SES-20261001-0017`;
  - year, month and leap-day rollover (`2028-02-28T17:30Z` → "Tue, 29 Feb 2028 00:30");
  - ISO, epoch-ms, `Date` and `+07:00` ISO input all agree;
  - offsets 0, +330 and −600;
  - invalid input gives "—";
  - **a 2,000-sample oracle check against the ICU `Asia/Jakarta` zone over 1970–2100.** It uses `Intl` in the test only.
  - `format.ts` is read back and contains no `Intl` or `toLocale*String`.
- `formatUtcOffset` and `formatDuration` are covered.

## 4. `src/realtime/format.ts`

| Export | Contract |
|---|---|
| `formatDate(input, pattern = 'ddd, D MMM YYYY', offsetMinutes = 420)` | Tokens: `YYYY MMMM MMM MM DD D dddd ddd HH mm ss Z` and `[literal]`. English names come from constant arrays. Returns `EMPTY_DATE_TEXT` ("—") for missing or invalid input |
| `DATE_PATTERNS` | `weekdayDate`, `date`, `dateTime`, `dateTimeMinutes`, `time`, `timeMinutes`, `dayKey` (event grouping), `compact` (synthetic IDs), `zone` ("UTC+07:00") |
| `formatUtcOffset(min = 420)` | `+07:00`, `-05:30` |
| `formatDuration(ms)` | `HH:mm:ss` for session timers (hours grow past 99); negative input clamps to 0; non-finite input gives `--:--:--` |
| `formatClock(input, offset)` | Unchanged output. The input widened from `string \| null \| undefined` to `DateInput` (also epoch ms and `Date`), so the sim clock's `now()` can be passed directly. The only caller, `apps/core-web/src/features/home/home-page.tsx:181`, passes a string (graft callers) |
| `DateInput`, `EMPTY_DATE_TEXT`, `DISPLAY_UTC_OFFSET_MINUTES` | Types and constants |

- **How it works:** the instant is shifted by the offset and read back with the `Date` UTC getters. There is no time-zone database and no locale service.
- **Where it is exported:** everything is exported via `@dems/shared/realtime` (`export * from './format'`). The sim can import `../realtime/format` directly without React.

**Why not `Intl` on the web either.** Node 26.8.2 (ICU 78.3) prints `Tue, 15 Sept 2026` for `Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Jakarta' })`, and Hermes' Intl coverage differs again. The arithmetic formatter prints `Sep` on every platform.

## 5. Decisions, drift and hand-offs

**Decisions and drift.**

| # | Type | What | Why |
|---|---|---|---|
| DR-34-1 | drift (MINOR) | 01_specs §14.11 names the resource file `packages/shared/src/i18n/en.ts` and says formatting uses `Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Jakarta' })`. Built instead: `src/i18n/en/*.ts` (13 files) plus `src/i18n/index.ts` exporting `en`, and the arithmetic `formatDate` for both apps | Blueprint row 34 and SCR-05 (D37, RL-50) supersede the spec text. The public import is `@dems/shared/i18n`, as both specs intend. A relative `…/src/i18n` import resolves to the index. The `Intl` path also differs across engines (the "Sept" evidence in §4) |
| DC-34-1 | decision | `formatClock`'s input type widened to `DateInput` | Additive; the output is unchanged. The existing tests pass |
| DC-34-2 | decision | `formatUtcOffset`, `formatDuration` and `DATE_PATTERNS` added beside `formatDate` | The top bar needs "UTC+07:00" (AC-74) and both apps need the "00:18:42" timers. Without them each page and screen would write its own (duplication, step 64) |
| DC-34-3 | decision | `mergeResources` returns a deep copy and skips prototype keys | SCR-05 asks for "deep-mergeable". i18next mutates stored bundles, and the overlay comes from another workspace |
| DC-34-4 | decision | Enum-keyed maps use wire values (`SCREAMING_SNAKE`, and `fault-demo` for the scenario) | Pages call `t(prefix + value)` directly. Step 31's `SubjectType` already uses TERSANGKA / SAKSI / LAINNYA |
| DC-34-5 | decision | "Recording ended" for the RECORDING_STOPPED audit and event labels; the End Session subtitle is "End recording and seal evidence" | D38 and research/04 §9 #27: one verb pair |
| DC-34-6 | authored copy (hypothesis) | `dashboard.hero.paragraph` ("Tamper-evident audio and video capture for interview rooms, sealed with a verifiable chain of custody from the first frame.") and the non-READY ring captions | research/04 §3.1 B locates the hero paragraph but does not transcribe it. The page step may reword it |

**Hand-offs.**

| # | To | Item |
|---|---|---|
| H-1 | step 38 (shell, `apps/core-web/src/i18n.ts`) | Initialise with `resources: { en: { translation: mergeResources(en, {}) } }` so keys read `namespace.path`. For AC-66, route tests can reuse the missing-key handler pattern from §3 |
| H-2 | step 40 (CP-1), or steps 32 and 54 | The sim-vocabulary maps in `common` mirror `src/sim/vocabulary.ts` as it was while step 31 was writing it. **No test pins them yet:** that would couple this test to a file another step is still editing (P6/P11). Suggested: once 31 and 32 land, a test asserting `Object.values(AuditType)` ⊆ `keys(en.common.auditType)`, and the same for `SimEventType`, `FaultKind`, `PrecheckCheckId`, `EvidenceStatus`, `OperatorRole`, `ScenarioName`, `RetentionPolicyId`, `ServiceStatus`, `DiagnosticStatus`, `PairingState` and `TabletLinkState` |
| H-3 | steps 68 and 73 (mobile i18n) | Put mobile keys under a top-level `mobile` key and merge with `mergeResources(en, enMobile)`. `formatDate`, `formatDuration` and `DATE_PATTERNS` come from `@dems/shared/realtime`. The root barrel `src/index.ts` still re-exports only `formatClock` and `DISPLAY_UTC_OFFSET_MINUTES` (that file is not a row-34 path) |
| H-4 | page steps (one per namespace file, per the single-writer scan) | Each page step extends only its own `en/<page>.ts`. Shared words (storage legend, quick actions, device menu, enum labels) stay in `common`. `test/i18n.test.ts` enforces the 13-file set, the plain-object shape, the placeholder and plural syntax, and the copy rules |
| H-5 | step 30, or step 64 review | `packages/shared/src/tokens/tokens.ts:62` has a comment reading `("Stop Session")`. It is a comment, not UI copy, and outside this step's paths |

## 6. Parallel-run notes (P1–P12)

- **P1:** no `npm install` and no manifest edits. The `./i18n` export already existed (step 27).
- **P6:** only row-34 paths were written. `src/sim/**` was only read, to align keys, and never written.
- **P7:** no processes were started. tsx was used as an in-process loader only; the tsx CLI failed with `listen EPERM` on its IPC pipe, and no bypass was requested.
- **P9:** vitest ran with `--maxWorkers=2`.
- **P11:** `npm run typecheck -w @dems/mobile` exits 2. All four errors are in `apps/mobile/src/components/composed/rolling-number.tsx` (a concurrent mobile step's file; 0 errors reference `packages/shared`). It is not a row-34 check. Re-run it after the owning step finishes.
- **Noise:** the sandbox prints `ERROR: failed to copy trust settings of system certificate-…` on every Node start. It is unrelated to the results.
- **Not written:** `masterplan/02_plan.md`, `status_tasks.md` and `delegation_progress_report.md` are shared files the controller owns during a parallel run (§3.4, brief). The controller records this step's status there.

---
*Generated: 2026-10-01 02:38 WIB*
