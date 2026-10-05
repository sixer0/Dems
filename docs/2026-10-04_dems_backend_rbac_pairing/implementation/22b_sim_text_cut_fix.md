---
task_id: 2026-10-04_dems_backend_rbac_pairing
task_slug: dems_backend_rbac_pairing
row: SIM-GAP-1 (controller row added by decision D53; closes finding F-1 of 22_contract_b.md, option A)
date: 2026-10-04
agent: coder-execution
tier: 3
status: complete (every verification command of the row exits 0; no finding blocks; two notes for the controller in section 9)
---

# SIM-GAP-1: the simulator's text cuts no longer split a surrogate pair

## 1. Summary

| Item | Value | Evidence |
|---|---|---|
| Defect | Four expressions cut user text with `String.prototype.slice` on UTF-16 code units; a character outside the Basic Multilingual Plane lying across the limit left a lone high surrogate in the state, in one case in a hashed audit row | `22_contract_b.md` section 10, F-1; `assets/22_finding_f1_output.txt` |
| Fix | One pure helper `cutText(text, maxCodeUnits)` in the new file `packages/shared/src/sim/text-cut.ts`, used at the four sites | Section 3, section 4 |
| Limits | Unchanged, still in code units: 80, 139 plus the ellipsis, 120 | Section 4; mutations M12 to M14 |
| BMP text | Byte-for-byte what it was: nine audit hashes, the chain head and four state digests are identical before and after | Section 7 |
| Tests | New file `packages/shared/test/sim-text-cut.test.ts`, 35 tests; no existing test changed | Section 5 |
| Gates | shared 1012 passed in 47 files (was 977 in 46); core-web 438; mobile 833; typecheck 0; lint 0; OpenAPI check 0 | Section 6 |
| Reproduction of F-1 | Ill-formed output gone | Section 6.7 |
| Demo artefacts | Not touched, no generator run; no character above U+FFFF exists in the simulator, the demo data, the generators, the domain or the i18n sources (65 text files scanned) | Section 6.8 |

## 2. Every cut site found, with its classification

Search 1 (the row's command): `grep -n "\.slice(0\|\.substring(\|\.substr(\|\.padEnd\|\.length >" packages/shared/src/sim/*.ts` gave 30 lines. Search 2 (wider, added by this row): every `.slice(`, `.substring(`, `.substr(`, `.padEnd`, `.padStart`, `charAt`, `charCodeAt`, `codePointAt`, `split('')`, `.at(`, and every `.trim()`, `.replace(`, `.split(`, `.normalize(` in the same folder. Each hit was read in its function.

### 2.1 User text cut by code units: fixed (4 expressions, 2 files)

| Site | Text | Limit | Where the result goes |
|---|---|---|---|
| `session-machine.ts:1070` (now `:1072`) | Marker label, after `trim()` | 80 | `session.timeline[].label` and `.params.label`; audit `MARKER_ADDED` `message` and `details.label` (hashed); event `MARKER_ADDED` `message` |
| `session-machine.ts:1102` (now `:1105`) | Note text, after `trim()`, only when longer than 140 | 139 plus `…` | `session.timeline[].detail` (the note itself stays whole in `session.notes[].text`; the audit row holds only `noteId` and `length`) |
| `evidence-actions.ts:158` (now `:159`) | Evidence export destination, after `trim()` | 120 | Audit `EVIDENCE_EXPORTED` `details.destination` (hashed); `evidence[].custody[].detail` |
| `evidence-actions.ts:275` (now `:276`) | Audit and log export destination, after `trim()` | 120 | Audit `AUDIT_EXPORTED` `details.destination` (hashed), for `exportAudit` and `exportLogs` |

F-1 named three of these; the marker label (the row's brief names it) has the same defect and reaches a hashed row too.

### 2.2 Not a cut of user text: left as they are

| Site | What it is | Why it cannot split a pair |
|---|---|---|
| `api.ts:309`, `:311`, `:312` | `normalizeApiPath`: strips the origin, the query and a trailing `/` of a request path | Not stored. The cuts fall at an ASCII `/`, `?`, `#` found by a search, or at the end of the text |
| `api.ts:517` | `hit.match.slice(1)` | Array of route parameters |
| `faults.ts:102`, `:105` | `evidence:<id>:<track>` fault key | Identifier; split at an ASCII `:` |
| `faults.ts:142`, `:353`, `selectors.ts:518` | `seq:<n>` fault key, `slice(4)` | Identifier with a fixed ASCII prefix; the rest is parsed as a number |
| `faults.ts:200` | `row.message.slice(0, -ALTERED_SUFFIX.length)` (undo of the audit-tamper demo hook) | User-derived text can be in the message, but the cut removes the fixed ASCII suffix `' [altered]'` behind an `endsWith` guard: the first unit left out is a space |
| `session-machine.ts:342`, `:344` | Case-number prefix `LP/YYYY/MMDD-` and the sequence after it | Generated ASCII prefix; `:344` runs only behind `startsWith(prefix)` and its result is parsed as a number, never stored |
| `dataset.ts:68`, `:75`, `:96`, `rng.ts:112`, `views.ts:279` | Hexadecimal digests | Fixed ASCII |
| `clock.ts:81`, `dataset.ts:106`, `events.ts:113`, `:217`, `:303`, `demo-alignment.ts:253`, `initial-state.ts:356`, `rng.ts:110` | `padStart` of a number | Digits; padding does not cut |
| `rng.ts:28` | `charCodeAt` in the seed hash | Reads units, produces a number |
| `events.ts:91`, `:200`, `health.ts:104`, `:114`, `devices.ts:273`, `:300`, `:301`, `:318`, `:319`, `:330`, `engine.ts:351`, `maintenance.ts:149`, `:371`, `faults.ts:199`, `session-machine.ts:566`, `:879`, `selectors.ts:126`, `:128`, `:267`, `:278`, `:504` | Array `slice` and `at` | Arrays, not text |
| `auth.ts:252`, `pairing.ts:82`, `devices.ts:299`, `engine.ts:189`, `maintenance.ts:78`, `:84`, `:88`, `session-machine.ts:592`, `store.ts:119`, `selectors.ts:373`, `:375` | `.length` of an array | A comparison, not a cut |
| `session-machine.ts:232`, `:234`, `:239`, `:1088` | `.length` of a text (non-empty; note of at most 2000 code units) | A check that refuses, not a cut; the text is stored whole |
| `session-machine.ts:195` | `trim().replace(/\s+/g, ' ')` on the session form texts | Collapses white space; `\s` matches BMP units only, never a surrogate |
| `session-machine.ts:203`, `:689`, `:1087`, `api.ts:307`, `:441`, `evidence-actions.ts:152`, `:267`, `auth.ts:111`, `demo-alignment.ts:235`, `:257` | `trim()` (and `toLowerCase()` for a username) | Removes white space only |

No `substring`, `substr`, `padEnd`, `charAt`, `codePointAt`, `split('')` or `normalize` exists in the folder.

## 3. The helper

File: `packages/shared/src/sim/text-cut.ts` (new, 42 lines, `git hash-object` `0daa3b1ecc236925ba498cf242ba4ee9c5b4afba`). No existing module of the simulator is a text utility (`memo.ts` memoises, `derive.ts` derives device state, `clock.ts` and `rng.ts` are their own subjects), so the helper has its own file, as the row allows.

```ts
const isHighSurrogate = (unit: number): boolean => unit >= 0xd800 && unit <= 0xdbff;
const isLowSurrogate = (unit: number): boolean => unit >= 0xdc00 && unit <= 0xdfff;

export function cutText(text: string, maxCodeUnits: number): string {
  const limit = maxCodeUnits > 0 ? Math.floor(maxCodeUnits) : 0;
  if (text.length <= limit) return text;
  // `limit` is the index of the first unit left out. The cut splits a pair exactly when that
  // unit is a low surrogate and the unit before it is the high surrogate it belongs to.
  const splitsPair = limit > 0 && isLowSurrogate(text.charCodeAt(limit)) && isHighSurrogate(text.charCodeAt(limit - 1));
  return text.slice(0, splitsPair ? limit - 1 : limit);
}
```

| Property | Behaviour |
|---|---|
| Text that fits | Returned unchanged |
| Limit | Counts UTF-16 code units, as `slice(0, n)` does |
| BMP-only text | Exactly `text.slice(0, n)` |
| A pair across the limit | The cut moves one unit back; the whole character is left out; the result is one unit shorter than the limit |
| A pair wholly before or wholly after the limit | The plain slice |
| Input that is already ill-formed | **Not repaired.** A lone surrogate inside the prefix stays; a lone low surrogate at the limit is cut like any other unit; a lone high surrogate just before the limit stays. The helper only adds no lone surrogate of its own: well-formed in, well-formed out. The API text rule (API-13) refuses ill-formed input at the boundary |
| Limit 0, negative or NaN | `''` |
| Fractional limit | Rounded down |
| Grapheme clusters | Out of scope: the cut falls between code points (half a flag is well-formed text) |
| Dependencies | None. `charCodeAt`, `slice`, `Math.floor` only: no `Intl.Segmenter`, no `isWellFormed` (absent in Hermes), no web global, no `node:` import |
| Surface | Imported by the two transition files only. **Not** re-exported from `packages/shared/src/sim/index.ts` (that file is outside this row's write paths) |

## 4. Before and after of each fixed line

`packages/shared/src/sim/session-machine.ts` (`b6b1520` to `0b3f1d7`, +5 −2):

```diff
+import { cutText } from './text-cut';
-  const text = typeof label === 'string' && label.trim() ? label.trim().slice(0, 80) : `Marker ${count}`;
+  // 80 code units, cut so that a surrogate pair is never split (SIM-GAP-1).
+  const text = typeof label === 'string' && label.trim() ? cutText(label.trim(), 80) : `Marker ${count}`;
-    detail: body.length > 140 ? `${body.slice(0, 139)}…` : body,
+    // At most 139 code units and an ellipsis; the cut never splits a surrogate pair (SIM-GAP-1).
+    detail: body.length > 140 ? `${cutText(body, 139)}…` : body,
```

`packages/shared/src/sim/evidence-actions.ts` (`219c9d2` to `7e44902`, +3 −2):

```diff
+import { cutText } from './text-cut';
-      ? request.destination.trim().slice(0, 120)
+      ? cutText(request.destination.trim(), 120) // code units; never splits a surrogate pair (SIM-GAP-1)
       : DEFAULT_EXPORT_DESTINATION;
-        ? request.destination.trim().slice(0, 120)
+        ? cutText(request.destination.trim(), 120) // code units; never splits a surrogate pair (SIM-GAP-1)
         : DEFAULT_AUDIT_EXPORT_DESTINATION;
```

Effect on a text with a pair across the limit: the marker label is 79 units instead of 80, the note line 138 units plus the ellipsis instead of 139, the destination 119 instead of 120. Nothing else changes.

## 5. Tests

New file `packages/shared/test/sim-text-cut.test.ts` (35 tests, `git hash-object` `c41a341b4249990137036b00a5fcf0b11d0ec52b`). No other file under `packages/shared/test/` was written. Well-formedness is asserted with the runtime's `String.prototype.isWellFormed` (reached through the prototype because the workspace compiles against the ES2023 lib, as `api-text-rule.test.ts` does; a runtime without it fails, it does not skip). The file imports nothing from `src/api/`.

| Group | Tests |
|---|---|
| `cutText`: BMP text is cut exactly as slice cut it (3) | Equal to `slice(0, n)` for every limit from 0 to past the end on eight texts (ASCII, Latin, CJK, Hangul, right-to-left, edge BMP units, blanks, one character, empty); equal at 80, 139 and 120 with and without `trim()`; U+D7FF and U+E000 are ordinary units |
| `cutText`: a text that fits is returned unchanged (2) | The empty string at any limit; shorter than the limit, exactly as long, a pair ending exactly at the limit, astral characters only |
| `cutText`: an astral character at the cut (6) | A pair across the limit for each of the three limits and five astral characters (with the positive control that the plain slice is ill-formed there); a pair wholly before; a pair wholly after; astral characters only at an odd and an even limit; for every limit of a mixed text: a prefix, within the limit, well-formed, the longest such prefix, exactly one shortened limit per astral character; half a flag (grapheme clusters out of scope) |
| `cutText`: small and odd limits (3) | Limit 0; limit 1 and 2 with a leading pair; negative, NaN, negative infinity, a fraction, positive infinity |
| `cutText`: text that is already ill-formed is not repaired (5) | A lone surrogate inside the prefix stays; a lone low surrogate at the limit; a lone high surrogate just before the limit; a lone high surrogate followed by a real pair; no lone surrogate added for any limit of a text with six lone surrogates |
| The recording scenario before any input (1) | No ill-formed string anywhere in the state; the chain verifies |
| `addMarker` with an emoji at code units 80 and 81 (3) | Positive control; the timeline item, its `params`, the audit row (`message`, `details.label`) and the event hold well-formed text, the label is 79 units, the row's hashed form survives a UTF-8 round trip and still hashes to the stored hash, the whole state is well-formed, the chain verifies; a pair ending at unit 80 is kept and one starting at 81 is cut whole |
| `addNote` with an emoji at code units 139 and 140 (3) | Positive control; the timeline line is 138 units plus the ellipsis, the note itself is whole, the audit row and event are well-formed, the whole state is well-formed, the chain verifies; a note of exactly 140 units is not cut |
| Export with an emoji at code units 120 and 121 (4) | Positive control; `exportEvidence`: audit row, custody entry and event well-formed, UTF-8 round trip, chain verifies with the row as head; `exportAudit` and `exportLogs`: the same for both `AUDIT_EXPORTED` rows; the chain still verifies after more rows follow, and the whole audit log stored as UTF-8 and read back equals the log that was hashed and verifies |
| Regression pin (5) | The inputs are ASCII or BMP only and longer than their limits; marker: the row hash equals the hash computed with `label.trim().slice(0, 80)`; note: the line equals `` `${body.slice(0, 139)}…` ``; destination: the row hash equals the hash computed with `destination.trim().slice(0, 120)` for the evidence, audit and log export; the nine hashes and the chain head captured from the code **before** the fix are unchanged |

Sensitivity of the tests (`assets/22b_mutate.py`, log `assets/22b_mutations.log`): 13 of 13 behaviour-changing mutations are killed, each file restored and its hash checked after every mutation. The lines below are shortened: the `Test Files` count, the runner's rule line and `restored: True` (present on every line of the log) are left out.

```
unmutated: exit 0 | Test Files  1 passed (1) | Tests  35 passed (35)
M01 helper: no step back (the plain slice): KILLED (exit 1) | Tests  13 failed | 22 passed (35)
M02 helper: steps back at any low surrogate (repairs a lone low): KILLED (exit 1) | Tests  1 failed | 34 passed (35)
M03 helper: steps back after any high surrogate (repairs a lone high): KILLED (exit 1) | Tests  2 failed | 33 passed (35)
M04 helper: steps back two units: KILLED (exit 1) | Tests  12 failed | 23 passed (35)
M05 helper: looks one unit too early: KILLED (exit 1) | Tests  15 failed | 20 passed (35)
M06 helper: the early return misses a text exactly as long as the limit (EQUIVALENT): NO CHANGE, as expected (exit 0) | Tests  35 passed (35)
M07 helper: a non-positive limit cuts nothing: KILLED (exit 1) | Tests  5 failed | 30 passed (35)
M08 site: marker label back to slice(0, 80): KILLED (exit 1) | Tests  2 failed | 33 passed (35)
M09 site: note line back to slice(0, 139): KILLED (exit 1) | Tests  2 failed | 33 passed (35)
M10 site: evidence export destination back to slice(0, 120): KILLED (exit 1) | Tests  2 failed | 33 passed (35)
M11 site: audit and log export destination back to slice(0, 120): KILLED (exit 1) | Tests  2 failed | 33 passed (35)
M12 site: marker limit 80 -> 81 (a limit moved): KILLED (exit 1) | Tests  4 failed | 31 passed (35)
M13 site: note limit 139 -> 138 (a limit moved): KILLED (exit 1) | Tests  1 failed | 34 passed (35)
M14 site: destination limit 120 -> 119 at both sites (a limit moved): KILLED (exit 1) | Tests  2 failed | 33 passed (35)
after restore: exit 0 | Test Files  1 passed (1) | Tests  35 passed (35)
13 of 13 behaviour-changing mutations killed; 0 survived; 1 equivalent mutation(s) changed nothing
```

M06 is an equivalent mutation: when the text is exactly as long as the limit, the lines after the early return read a unit past the end (NaN, not a surrogate) and `slice(0, limit)` is the whole text. The early return is a fast path; no test can tell the two apart.

## 6. Runner output

All commands ran from `/Users/gsp-budi/Documents/DEMS`. Lines `ERROR: failed to copy trust settings of system certificate` printed by the sandbox are removed from the quotes; the full logs are in `assets/`.

### 6.1 `npm run test -w @dems/shared -- --maxWorkers=2`

Before the first edit (09:45):

```
 Test Files  46 passed (46)
      Tests  977 passed (977)
   Start at  09:45:18
   Duration  3.35s
```

After the fix (final run, `assets/22b_gate_shared_test.log`):

```
 Test Files  47 passed (47)
      Tests  1012 passed (1012)
   Start at  09:55:00
   Duration  3.37s (tests 49%, import 38%, transform 12%, worker 1%)
exit=0
```

An earlier run after the fix (09:51) gave the same totals. No failure occurred in any run, in any row's files, so the noise rule P11 was not needed. Ledger: 977 + 35 = 1012; the new file is `test/sim-text-cut.test.ts`.

### 6.2 `npm run typecheck` and `npm run lint`

`assets/22b_gate_typecheck.log`:

```
> @dems/shared@0.1.0 typecheck
> tsc --noEmit
> @dems/core-server@0.2.0 typecheck
> tsc --noEmit
> @dems/core-web@0.1.0 typecheck
> tsc -b
> @dems/mobile@0.1.0 typecheck
> tsc --noEmit
> @dems/mock-core@0.1.0 typecheck
> tsc --noEmit
exit=0
```

`assets/22b_gate_lint.log`:

```
> @dems/shared@0.1.0 lint
> oxlint
> @dems/core-server@0.2.0 lint
> oxlint
> @dems/core-web@0.1.0 lint
> oxlint
> @dems/mobile@0.1.0 lint
> eslint .
> @dems/mock-core@0.1.0 lint
> oxlint
exit=0
```

Both root runs were taken before a last readability edit of the new test file (two assertions; no source file changed). After that edit `npm run typecheck -w @dems/shared` and `npm run lint -w @dems/shared` were run again: both exit 0.

### 6.3 `npm run test -w @dems/core-web -- --maxWorkers=2` (`assets/22b_gate_core_web_test.log`)

```
 Test Files  39 passed (39)
      Tests  438 passed (438)
   Start at  09:52:12
   Duration  34.10s
exit=0
```

### 6.4 `npm run test -w @dems/mobile -- --maxWorkers=2` (`assets/22b_gate_mobile_test.log`)

```
Test Suites: 72 passed, 72 total
Tests:       833 passed, 833 total
Snapshots:   0 total
Time:        32.429 s, estimated 33 s
exit=0
```

The three simulator source files were not changed after these two runs (`shasum -a 256 -c` of the three files: OK after the last mutation run).

### 6.5 `node --import tsx packages/shared/scripts/gen-openapi.ts --check`

```
packages/shared/openapi/openapi.json is up to date (offline (committed): 10 operations; all: 37 operations)
exit=0
```

### 6.6 The four reference-hash web test files and the simulator diff

```
$ git hash-object apps/core-web/src/test/sim-fetch.test.ts apps/core-web/src/features/storage/__tests__/storage-page.test.tsx apps/core-web/src/features/dashboard/__tests__/dashboard.test.tsx apps/core-web/src/features/security-audit/__tests__/security-audit.test.tsx
9e8b97c80da596e0ae6e9b37aa69b64e99e3bbdd
71f6f0337f2339d8e8d66ef232d7334dc0b67d1d
1ab07579e928b9b545003899ec3265d4b8b6c762
5470ce3fdcd98fd8c0926cd6afe03a1a1c1af58f

$ git diff acaff20 --stat -- packages/shared/src/sim
 packages/shared/src/sim/auth.ts             |  5 +++++
 packages/shared/src/sim/evidence-actions.ts |  5 +++--
 packages/shared/src/sim/session-machine.ts  |  7 +++++--
 packages/shared/src/sim/vocabulary.ts       | 27 +++++++++++++++++++++++++++
 4 files changed, 40 insertions(+), 4 deletions(-)

$ git status --short packages/shared/src/sim
 M packages/shared/src/sim/auth.ts
 M packages/shared/src/sim/evidence-actions.ts
 M packages/shared/src/sim/session-machine.ts
 M packages/shared/src/sim/vocabulary.ts
?? packages/shared/src/sim/text-cut.ts
```

The four hashes equal the values named in the row. The diff holds step 38's two files (`auth.ts` +5, `vocabulary.ts` +27) and this row's two; the helper is the only untracked file of the folder.

### 6.7 Contract B's reproduction of F-1, run again (`assets/22b_finding_f1_output_after.txt`)

The script `assets/22_finding_f1_reproduction.ts` is unchanged; `assets/22_finding_f1_output.txt` (the output before the fix) is kept as it was.

| Line | Before the fix | After the fix |
|---|---|---|
| ill-formed strings after `addNote` | `[ 'state.session.timeline[28].detail' ]` | `[]` |
| the timeline entry ends with | `aaaaaaaaaa\ud83d…"` | `aaaaaaaaaaaaaaaa…"` |
| ill-formed strings after `exportEvidence` | `[ 'state.evidence[3].custody[3].detail', 'state.audit.rows[222].details.destination' ]` | `[]` |
| `details.destination` ends with | `ddd\ud83d"` | `ddddddddd"` |

```
ill-formed strings in the recording scenario before any input: []

note: 168 code units, well-formed: true
ill-formed strings after addNote: []
the timeline entry ends with (JSON): aaaaaaaaaaaaaaaa…"

destination: 130 code units, well-formed: true
EvidenceExportRequest accepts it (API-13 holds for the input): true
exportEvidence: {"ok":true,"status":202,"exportId":"EXP-000032"}
ill-formed strings after exportEvidence: []
the audit row: EVIDENCE_EXPORTED seq 223 | details.destination ends with (JSON): ddddddddd"
exit=0
```

### 6.8 Demo artefacts

No file under `packages/shared/src/demo-data/`, `packages/shared/assets/`, `release/` or `apps/` was written and no generator was run. `scripts/gen-demo-evidence.ts` calls none of the four transitions itself; the scenarios it loads do, at `scenarios.ts:120` (`addNoteTransition` with a 46-character ASCII note) and `scenarios.ts:121` (`addMarkerTransition` with `'Key statement'`): both texts are shorter than their limits, so no cut happens there at all. A scan of the 65 text files under `packages/shared/src/sim`, `src/demo-data`, `scripts`, `src/domain` and `src/i18n` found no character above U+FFFF and no astral escape, so every text those sources can feed to a cut is BMP text, for which the helper is the old slice (section 7). `demo-evidence.test.ts` and `sim-demo-data-alignment.test.ts` pass inside the 47 files of 6.1.

## 7. Hash-regression proof

The script `assets/22b_hash_baseline.ts` drives the real simulator (recording scenario, manual clock 1 790 823 600 000) through two markers, two notes, two evidence exports, two audit exports and one log export, each with an ASCII or other BMP text longer than its limit. It was run **before the first edit** (the two files then equal to `acaff20`: `git hash-object` gave `b6b1520…` and `219c9d2…`, the blob names of `acaff20`) and again after the fix.

```
$ diff assets/22b_hash_baseline_before.txt assets/22b_hash_baseline_after.txt && echo "BASELINE IDENTICAL"
BASELINE IDENTICAL
$ shasum -a 256 assets/22b_hash_baseline_before.txt assets/22b_hash_baseline_after.txt
fbf9449307fde58bca7b7f6ecb1e7ec32b08becb54cd6cb25f9e4caa2b07ca27  …/22b_hash_baseline_before.txt
fbf9449307fde58bca7b7f6ecb1e7ec32b08becb54cd6cb25f9e4caa2b07ca27  …/22b_hash_baseline_after.txt
```

| Row | Hash, before and after |
|---|---|
| `MARKER_ADDED` seq 220 (ASCII label) | `470b91cf38518ebfda54f0bbf4be4d3bec16e130673ff95064919e5807b869f6` |
| `MARKER_ADDED` seq 221 (BMP label) | `bd6edf6e6cc9ee71e03a942bcaed8064a30a1bbca7bb3fb6166e3dd9fbafb75b` |
| `NOTE_ADDED` seq 222 (ASCII note) | `5bdb082c4a98bf592b76924d17edff9ca6fa35ac1fdbbb6ef2c41e181f4a4f06` |
| `NOTE_ADDED` seq 223 (BMP note) | `10d0de9e76d76023bf11172ccb2debafd4ed287e23225b1ea618f2ba4c2b6108` |
| `EVIDENCE_EXPORTED` seq 226 (ASCII destination) | `2519943c2e039318b246b634f2e9abd69a674f4c415cd1c009d2e95ea3c0b8d5` |
| `EVIDENCE_EXPORTED` seq 227 (BMP destination) | `535dd739ea14e3964a149818b269e2ff0b4e90a1c6b5c75d03a3e9394c432cbd` |
| `AUDIT_EXPORTED` seq 228 (audit export, ASCII) | `e0603b5a69ab8c30f7be7872c383e4bab23af53a1075428eeae42197765c8f5e` |
| `AUDIT_EXPORTED` seq 229 (audit export, BMP) | `f4968a7889787c0e1c037244d193c2bd3ccd4caeb3fd92b9f0553668be954934` |
| `AUDIT_EXPORTED` seq 230 (log export, ASCII) | `3b2efcd066c54973f73070399e7aa1abb6afeb42bb8604ae1ee72a24e45677a9` |
| Audit head, 230 rows | `3b2efcd066c54973f73070399e7aa1abb6afeb42bb8604ae1ee72a24e45677a9` |
| SHA-256 of `JSON.stringify` of the `audit`, `events`, `session`, `evidence` slices | `f9829ef5…`, `bc114490…`, `83bb025c…`, `549c437f…` (identical; full values in the two output files) |

The same proof is kept as tests (section 5, regression pin): the row hash equals `chainHash(prevHash, body)` with the text computed by the old expression, and the nine literals above are asserted. Three further checks agree: the four reference-hash web test files are unchanged and pass (6.3, 6.6), the 61 simulator-dependent client test files pass untouched (6.3, 6.4), and mutations M12 to M14 show that a moved limit is noticed.

## 8. Rollback

```
git checkout acaff20 -- packages/shared/src/sim/session-machine.ts packages/shared/src/sim/evidence-actions.ts
git apply --allow-empty .cache/rollback/SIMGAP1.pre.patch
rm packages/shared/src/sim/text-cut.ts packages/shared/test/sim-text-cut.test.ts
```

| Item | State |
|---|---|
| `.cache/rollback/SIMGAP1.pre.patch` | Saved before the first edit; 0 bytes (both files were equal to `acaff20`), so `--allow-empty` is required. `git apply --allow-empty --check` exits 0 (git 2.55.0) |
| `.cache/rollback/SIMGAP1.post.patch` | Saved after the fix (3513 bytes), not asked for by the row; `git apply --check -R` exits 0. An alternative rollback that keeps any later writer's edits: `git apply -R .cache/rollback/SIMGAP1.post.patch` |
| Order | Remove the helper only after the two files are restored: they import it |
| Effect of a rollback | F-1 is open again; nothing else depends on the helper (it is not exported from the simulator's barrel) |

## 9. Notes for the controller

| ID | Kind | Note |
|---|---|---|
| N-1 | Decision needed (not this row's) | F-1 is closed at the cause, so DN-2 of `22_contract_b.md` can be acted on: the contract owner switches the text rule API-13 on for the slices (one line, `text()` in `src/api/state-slices.ts`; its mutation M06 covers it). This row did not touch `src/api/` |
| N-2 | Finding, decision needed | **The fix protects Live mode only where the server runs these transitions.** `cutText` is not exported from `packages/shared/src/sim/index.ts` (outside this row's write paths), and the package's export map exposes the simulator only as `./sim` (`packages/shared/package.json:12`). At the time of this row no file under `apps/core-server/src` calls `addMarkerTransition`, `addNoteTransition`, `exportEvidenceTransition` or `exportAuditTransition` (grep: 0 hits); the server modules for markers, notes and exports are not written yet. If they call the simulator's transitions they get the safe cut. If they cut the text themselves they must use the same helper, which then needs one export line in `index.ts` by a recorded exception. The rows that implement those server operations should be told which of the two applies |
| N-3 | Residual | The fix does not repair text already stored. A simulated-mode snapshot persisted before the fix by someone who typed an astral character exactly at a limit keeps its lone surrogate until the demo is reset. A new Live database has no such rows |
| N-4 | Maintenance | The nine literal hashes in the new test depend on the recording scenario and on the audit rows of these five actions. They move only if one of those changes by design; the comment in the test says so and names `assets/22b_hash_baseline.ts` to regenerate them |
| N-5 | Scope | A cut can still fall inside a grapheme cluster (between the two code points of a flag, or inside a joined emoji sequence). The text stays well-formed and storable; only its last visible symbol may differ. Out of scope by the row |
| N-6 | Deviation | None from the row. Extra evidence not asked for: the mutation check (section 5), the post-image patch (section 8) and the wider search (section 2) |

## 10. Files

| File | Change |
|---|---|
| `packages/shared/src/sim/text-cut.ts` | new |
| `packages/shared/src/sim/session-machine.ts` | modified (import, two expressions, two comments) |
| `packages/shared/src/sim/evidence-actions.ts` | modified (import, two expressions) |
| `packages/shared/test/sim-text-cut.test.ts` | new |
| `.cache/rollback/SIMGAP1.pre.patch`, `.cache/rollback/SIMGAP1.post.patch` | new (git-ignored cache) |
| `docs/2026-10-04_dems_backend_rbac_pairing/implementation/22b_sim_text_cut_fix.md` | new (this document) |
| `docs/…/implementation/assets/22b_hash_baseline.ts`, `22b_hash_baseline_before.txt`, `22b_hash_baseline_after.txt` | new |
| `docs/…/implementation/assets/22b_mutate.py`, `22b_mutations.log` | new |
| `docs/…/implementation/assets/22b_finding_f1_output_after.txt` | new |
| `docs/…/implementation/assets/22b_gate_shared_test.log`, `22b_gate_typecheck.log`, `22b_gate_lint.log`, `22b_gate_core_web_test.log`, `22b_gate_mobile_test.log` | new |
| `docs/…/delegation_progress/coder_execution_step_simgap1.md` | new |

Not written (parallel run): `status_tasks.md`, `delegation_progress_report.md`, `decisions/decisions.md`, `masterplan/02_plan.md`, `implementation/99_implementation_report.md`.

---
*Generated: 2026-10-04 09:57*
