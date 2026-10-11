---
task_id: 2026-10-07_dems_real_capture_sealing
task_slug: dems_real_capture_sealing
date: 2026-10-11
agent: coder-execution (documentation follow-up of batch N)
scope: documents only - README.md and masterplan/03_api_contract.md, 05_capture_architecture_spec.md, 08_client_ux_spec.md, 10_test_strategy.md; no code, no test, no script, no package.json, no lane, no git write
tree: commit 713d83f plus the uncommitted working tree of batch N (code driver's note 164; docs pass of note 165)
decision: D241
status: needs-review
---

# 166 - Batch N, documents, follow-up: what the code driver built, written into the specs and the README

Follow-up to note 165. Note 165 worded several places "ruled, in progress, NOT in the tree" because note 164 did not
exist yet. Note 164 and `delegation_progress/contract_batch_n.md` (sections 1 to 3, errata E-BN-1 .. E-BN-9) now exist.
Every statement below was read in the working tree at the time of writing (`713d83f` plus batch N); the `file:line` in
the Source column are lines of that tree and will move if the code is edited again. No suite was run (documents only);
the only commands run were read-only (`git status`, `git show HEAD:...`, `git ls-files -ci --exclude-standard`,
`git check-ignore -v`, `grep`, `sed`). No emoji in the five edited files (scan of U+1F300-1FAFF and U+2600-27BF: 0).

## 1. Errata

Numbering. The strategy's section N holds `PE-BN-01 .. 06`; its new erratum is `PE-BN-07`, so that series stays unbroken in
that file. Ids are unique across the specs (the convention of note 165), so the new errata of the other three specs
continue the same series, `PE-BN-08 .. 15`; the in-place updates keep the id they already had. One new series per
file; no `PE-WM-` id was used (batch N is no wave).

| Erratum | File + section | What it states | E-BN |
|---|---|---|---|
| PE-BN-07 | 10 section N, row `M5-SEC-SRC-1` | The suite part is proven by a test that cites the id; the live part is not proven and not provable at this tree | E-BN-7 |
| PE-BN-08 | 03 section 2.5, op 91 (after PE-WK-04) | A body of op 91 that carries `credential` is web console only, by the handler; the `access` member is unchanged; five in-place marks (the condition table of section 0, the access table of section 2.1, the op 91 row, the `WEB_CONSOLE_ONLY` row of section 4, the `ACCESS_DENIED` row of section 5.3) | E-BN-2 |
| PE-BN-09 | 03 section 2.4, after "Media-token prefix (SEC35-13)" | The log-blanking rule set blanks the userinfo of a URL that carries a password; the older sentence that said the form was blanked was an obligation, built now | E-BN-3 |
| PE-BN-10 | 03 section 6 (after PE-WH-05) | `SESSION_CAPTURE_CHECKPOINTS_EXAMPLE` | V98-09, contract section 2 |
| PE-BN-11 | 03 section 3, op 41 (after PE-WK-07) | The shared module `@dems/shared/evidence-rules`: the part rule, `transcriptModel` bounds, the revision-reason reader; contract unchanged | E-BN-5 |
| PE-BN-12 | 03 section 4 (end) | The demo-password refusal is a boot refusal; nothing in the API moved; the sign-in cards still print the password | E-BN-1 |
| PE-BN-13 | 05 section A.1.2 (after the hand-over paragraph) | A `REAL_PRODUCTION` Core refuses to start while an operator has the published demo password; what remains open | E-BN-1 |
| PE-BN-14 | 08 section 6.6 (after PE-WK-46) | One rule for a part of a verify file row on both clients ("Not run", never FAIL); closes the open point of PE-WK-46 | E-BN-5 |
| PE-BN-15 | 08 section 8e (after PE-WM-09) | A pre-check whose probe cannot be made reads every source not reachable; what the clients draw | E-BN-4 |

Updated in place (existing id kept; the superseded sentence stays, with a bracketed mark):

| Erratum | File | What changed |
|---|---|---|
| PE-WM-01 | 03 section 5.4 | The "Open observation (V98-08)" sentence gains a bracketed closure: `reasonCode` and `params` belong to the state slice `session`; op 27 answers `id`, `status`, `value`, `reason` only; E-BN-6 |
| PE-WM-03 | 03 section 5.4 | The V98-13 sentence stated as open at `713d83f` gains a bracketed "SUPERSEDED by batch N" with the behaviour as built; its line cites are marked as those of `713d83f`; E-BN-4 |
| PE-BN-03 | 10 section N | Its last sentence gains a pointer to PE-BN-07 |
| PE-BN-06 | 10 section N | Completed: the sixteen steps by number, name and command, how the script ends (35-minute series, the skip variable and its last line), what it needs, which scripts have been run |
| PE-WK-26, PE-WK-46 | 08 (index rows and paragraphs) | Marked: the rule is the shared one (PE-BN-14); the open point of PE-WK-46 is closed |

Each touched spec also gained: a `last_updated` mention, an index row (03, 05, 08: the errata index; 10: the table of
section N and a `Last Updated` footer line). Registry totals are unmoved and every erratum says so where it could be
doubted: 97 operations / 36 GET / 61 POST / 67 audit types / 30 slices / schema 6 / `dbc-7`.

Not done on purpose: E-BN-6 also names `delegation_progress/contract_wave_m.md` lines 39-45; that file is outside the
documents of this task, and the correction is in PE-WM-01. E-BN-9 (suite counts for the trackers) belongs to the
controller's files. E-BN-8 (`.gitignore`) is in the README only (Known limit 44): no spec states the patterns.

## 2. Place | old statement | new statement | source

### README.md

| Place | Old statement | New statement | Source |
|---|---|---|---|
| "State at commit `713d83f`", new paragraph before "Built, and proven on fake devices." | none: the block described `713d83f` only and did not say that a working tree with fixes stands above it | "Tree state: `713d83f` plus batch N (uncommitted at the time of writing)": the batch N fixes listed (S99-01, S99-04, S99-07, S99-09, V98-13, R101-03, V98-09, six scripts, `M5-SEC-SRC-1` suite part), "tests and NO gate", suite counts as note 164 reports them and "not re-run for this text", "The commit that holds them is not made." No hash invented | note 164 sections 1-9 and the counts of section 9; `git log -1` = `713d83f` |
| Same block, "Not proven" row "A one-camera seal ... EVERY `REAL_PRODUCTION` refusal inside a started Core" | "A `REAL_PRODUCTION` Core cannot operate in this tree at all: no production source has an opener and no command provisions a production signing key" | the same, plus "and since batch N it also refuses to start on the seed's operators"; the demo-password refusal is shown on the booted path by a database test and by no started Core | `apps/core-server/src/modules/devices/__tests__/source-class.db.test.ts:194`; `capture/boot/checks.ts:410-416` |
| Same block, "Not proven" row "Notification B ... `M5-SEC-SRC-1`" | "`M5-SEC-SRC-1` (no listener for a source kind without an opener)" as plainly unproven | the suite part is proven since batch N by a database test (409 `SOURCE_KIND_NOT_RECORDABLE`, no worker, no source asked to open); the live part (no listener in 8554-8564 on a started `REAL_PRODUCTION` Core) is not proven and cannot be at this tree because such a Core cannot boot | `apps/core-server/src/capture-session/__tests__/session-capture.db.test.ts:432`; note 164 section 8 |
| "What refuses to start" table | no row for the demo password | new row `CAPTURE_DEMO_OPERATOR_PASSWORD_IN_PRODUCTION`: refused when an operator's stored credential still verifies against the demo password (reason `operators=<count>`) or the operators cannot be read (`OPERATORS_UNREADABLE`, fails closed); check 4c after the signing key and before the worker; logs the count only; applies to `REAL_PRODUCTION`; built, uncommitted, no gate | `capture/boot/checks.ts:73`, `:410-416`; `capture/boot/index.ts:183`, `:225` |
| "The signing key." paragraph | A `REAL_PRODUCTION` Core refuses a development key | plus one sentence: it also refuses while an operator has the demo password, which every seeded database has; with no production signing key and no provisioning a `REAL_PRODUCTION` Core cannot be brought up from this repository today | `checks.ts:410-416`; `db/seed/seed.ts:239`; Known limits 25 and 34 |
| Known limit 34 | "Ruled, in progress, NOT in the tree at `713d83f`: a `REAL_PRODUCTION` Core is to refuse to start ... Until the fix is committed and re-checked, treat the refusal as not built" | BUILT in the tree of batch N: refuses (`CAPTURE_DEMO_OPERATOR_PASSWORD_IN_PRODUCTION`; unreadable operators also refuse). REMAINS: `db:seed` / `db:reset` still accept a production environment (S99-01 (b)); no operator provisioning and no password-change path (S99-01 (c)); both login cards still print the demo password (no Core-stated fact reaches a signed-out client; R101-01); so a production Core cannot be brought up from the seed at all today. "It has tests and no gate." | `db/seed/seed.ts:239`; `db/seed/demo-core.ts:14-17`; `apps/core-web/src/features/login/auth-card.tsx:499`; `apps/mobile/src/features/login/login-card.tsx:549,566`; `packages/shared/src/api/health.ts:35-47`; note 164 section 1 |
| Known limit 44 | "each open at `713d83f` ... S99-04, -07 and -09 are ruled for the current fix batch and are not in the tree at `713d83f`" | S99-04, S99-07, S99-09 reworded as BUILT in the tree of batch N (the URL userinfo rule and its two limits; `.gitignore` `*.p8`, `*.wrap`, `*.blob` and that no tracked file has them; a body of op 91 with `credential` refused `403 WEB_CONSOLE_ONLY` from a device, access member unchanged, save without credential still works); S99-05, -06, -08 stay open and carried to the next task | `packages/shared/src/api/redaction.ts:83`, `:249`; `.gitignore:102-104`; `git ls-files -ci --exclude-standard` = 0 lines; `git check-ignore -v` matches the three lines; `apps/core-server/src/modules/stt-config/index.ts:309` |
| "What `npm test` does not run." | "(root `package.json`; `scripts/test/`)"; "`test:capture-worker` had been run once by its author (`contract_batch_n.md`)" | cites `package.json:53-58`, `scripts/test/regression.sh`, `scripts/test/kill-matrix.sh`; says the run had exit status 0 (note 164 section 6) and "Of the six, only that one has been run". The six names were checked and are correct (below) | root `package.json:53-58`; note 164 section 6 |

README script names against the root `package.json` at HEAD (the working tree; `package.json` is modified, uncommitted):

| README name | `package.json` line | Result |
|---|--:|---|
| `npm run test:seal-e2e` | 53 | correct |
| `npm run test:dev-session-e2e` | 54 | correct |
| `npm run test:kill-matrix` | 55 | correct (`sh scripts/test/kill-matrix.sh`) |
| `npm run test:capture-worker` | 56 | correct (`make -C apps/capture-worker`) |
| `npm run test:capture-worker-e2e` | 57 | correct (`make -C apps/capture-worker e2e`) |
| `npm run test:regression` | 58 | correct (`sh scripts/test/regression.sh`) |

No name was changed. The README's descriptions of the scripts (3 / 2 / 35 / 16 steps, the skip variable) match
`regression.sh:7-21`, `:47-52` and `kill-matrix.sh:1-14`. Other README places searched and found to carry no S99-01,
S99-04, S99-07, S99-09 or V98-13 wording: `grep -n -i "in progress\|NOT in the tree\|ruled"` leaves only the GM-01 / GM-02
sentence (a different ruling, D239). After the edits `grep -i "NOT in the tree\|ruled, in progress\|not in the tree"` prints nothing.

### 03_api_contract.md, 05_capture_architecture_spec.md, 08_client_ux_spec.md, 10_test_strategy.md

| Place | Old statement | New statement | Source |
|---|---|---|---|
| 03 PE-WM-01 (section 5.4), end | "Open observation (V98-08 ...): the check row without `params` ... not closed by this erratum." | kept; bracketed: CLOSED. `session.precheck.items[]` is `PrecheckItemStateSchema` with `reasonCode` and `params`; op 27 answers `PrecheckItemSchema`: `id`, `status`, `value`, `reason` only (API-1); a read of op 27 without `params` is the contract | `packages/shared/src/api/state-slices.ts:210-218`; `core-api.ts:285-292`; `packages/shared/test/sim-own-capture.test.ts:370`; E-BN-6 |
| 03 PE-WM-03 (section 5.4), end | "at commit `713d83f` a probe source that THROWS is reported and the gate then asks nothing (`precheck.ts:125` `NOT_ASKED`)" | kept; bracketed: SUPERSEDED. A throwing probe source makes every configured source not reachable (camera `UNREACHABLE`, microphone `OPEN_FAILED`), the pre-check blocks, one `CAPTURE_PRECHECK_PROBE_SOURCE_FAILED` log; no new cause or sentence; "no adapter" unchanged; op 97 unchanged (null, 503 `CAPTURE_NOT_READY`). First-paragraph cites marked as those of `713d83f` | `capture-notices/index.ts:164`, `:166-174`, `:194`; `precheck.ts:102`, `:126`, `:150-156`, `:182-184`, `:191-195`; E-BN-4 |
| 03 index rows PE-WM-01, PE-WM-03 | "V98-13 stated as open at `713d83f`" (PE-WM-03) | both rows state the update | as above |
| 03 PE-BN-08 and its five marks | op 91 "access `CAPTURE_CONFIG`", the condition `WEB_CONSOLE_SESSION` "on ops 89, 95, 96", error row `WEB_CONSOLE_ONLY` "89, 95, 96" | op 91: a body with `credential` (`SECRET`, `REFERENCE`, `CLEAR`) from a tablet or phone session answers `403 NOT_PERMITTED` / `WEB_CONSOLE_ONLY` with one `ACCESS_DENIED` row (`operationId`, `permission`, `role`, `reason`); the access member is unchanged, so the condition still stands on 89, 95, 96 only; a save without `credential` from a device works; the simulator answers the same; the mobile apps send nothing to op 91 | `packages/shared/src/api/transcription.ts:519`, `:453-456`, `:596-607`, `:642`; `plugins/permission-guard/index.ts:359`; `plugins/permission-guard/denial.ts:47`; `modules/stt-config/index.ts:309`; `packages/shared/src/sim/api.ts:1080`; `connect.db.test.ts:250` |
| 03 PE-BN-09 | "Media-token prefix (SEC35-13)": the camera-credential form "is blanked too (SEC35-04)" | erratum: at `713d83f` the shared rule had no such rule; built as rule 1b, `scheme://user:password@host` kept as `scheme://***@host`, any scheme; two limits (raw `/` in the password; a userinfo without a password stays) | `packages/shared/src/api/redaction.ts:14`, `:83`, `:249`; `packages/shared/test/redaction.test.ts:66` |
| 03 PE-BN-10 | PE-WH-05 (1) states `session.captureCheckpoints` with no example | the example: 24 fragments, 34,000,000 bytes, two cameras (12 / 20,000,000 and 12 / 14,000,000), imported by three client tests | `packages/shared/src/api/state-slices.ts:276`; `packages/shared/test/sim-own-capture.test.ts:353` |
| 03 PE-BN-11 | PE-WK-07: the Core writes `plainChecked: false`; "the client falls back to V-05 of the SAME result" | the shared module is the reader: part rule (`PASS` / `FAIL` / `NOT_RUN`; `plainChecked === false` or the part's own check `SKIPPED`), `transcriptModel` text members 1 to 256 (a `report` over 256 makes the WHOLE model read "not stated"), revision `reason` trimmed 1 to 500; the changed behaviours | `packages/shared/src/evidence-rules/index.ts:67`, `:85`, `:110`, `:133`, `:140`; `packages/shared/package.json:23`; `packages/shared/src/api/evidence.ts:310-318`; E-BN-5 |
| 03 PE-BN-12 | none | the demo-password refusal is a boot refusal, not an `ApiError`; no code, reason, audit type, operation or slice moved; the sign-in answer states `demoControls`, the health answer states no capture operation | `capture/boot/checks.ts:73`; `packages/shared/src/api/identity.ts:159`; `health.ts:35-47`; E-BN-1 |
| 05 PE-BN-13 (section A.1.2) | the table of what boot refuses (rows 7 to 10) has no demo-password row | the refusal in full (code, reasons, fail closed, check 4c, order, verifier, count only, static rule G-R16, tests), the booted-path test, the consequence for any lane or test that boots `REAL_PRODUCTION` on a seed, and what remains open (E-BN-1's last two sentences) | `capture/boot/checks.ts:73`, `:410-416`; `capture/boot/index.ts:183`, `:225`; `capture/__tests__/static.test.ts:919-994`; `source-class.db.test.ts:194`; `db/seed/demo-core.ts:14-17` |
| 08 PE-WK-26 / PE-WK-46 index rows and paragraphs | PE-WK-46: "OPEN: the tablet / phone does not read the per-file member" | kept; bracketed: CLOSED by PE-BN-14; the mobile function now reads `plainChecked` by name | `apps/mobile/src/features/evidence/verify-v2.ts:68`, `:198`, `:471` |
| 08 PE-BN-14 | PE-WK-26: the decrypted-bytes part only | all three parts, both clients, one rule; web `FAIL` -> "Not run" for a SKIPPED stored / chain check; bounds 256; reason trimmed on both; `data-stored` on the web part; the client file cites | `apps/core-web/src/features/evidence/verify-v2.ts:464`, `item-v2.ts:18`, `transcript-model.ts:13`, `verify-v2-report.tsx:182`, `:203`; the mobile equivalents `verify-v2.ts:471`, `item-v2.ts:18`, `transcript-model.ts:13`, `verify-v2-report.tsx:190`; `git show HEAD:` of the web `verify-v2.ts` lines 466-477 for the old behaviour |
| 08 PE-BN-15 (section 8e) | none | what a client receives when the probe cannot be made; open: no `OPEN_FAILED` key in the cause table | `precheck.ts:182-195`; `packages/shared/src/i18n/en/common.ts:840-847`; 08 section 8f.3 |
| 10 PE-BN-06 | 16 steps named in prose; "State when this was written" | the steps as a table with the commands; how the script ends; skip semantics (15 counted); needs; kill-matrix script behaviour; which scripts have been run: only `test:capture-worker` | `scripts/test/regression.sh:7-21`, `:30`, `:32-52`; `kill-matrix.sh:9-14`; note 164 section 6 |
| 10 PE-BN-07, catalogue row `M5-SEC-SRC-1`, PE-BN-03 | row and PE-BN-03: "NOT PROVEN ... not closed by this erratum" | pointers; the erratum states the suite part (cited test) and the live part (not provable at this tree: no production signing key, S99-13; the seed's operators refused, S99-01) | `session-capture.db.test.ts:432`, `:387`; note 164 section 8; E-BN-7 |

## 3. Differences from the wording the briefs gave

1. E-BN-5 says "a longer `report` line reads 'not stated'". In the code `report` is a required member
   (`evidence-rules/index.ts:113-115`), so a `report` over 256 characters makes the WHOLE model read "not stated"; only the
   optional `version` and `quantisation` become null on their own. PE-BN-11 and PE-BN-14 say it that way.
2. Note 164 section 3 says `rg updateSttConfig apps/mobile/src`: 0. A search of the tree finds 5 lines, all in test files
   or test titles (`stt-status-section.test.tsx:306`, `stt-status-static.test.ts:28`, `runtime/log.test.ts:123,143,201`);
   no non-test file names it. PE-BN-08 says "no file other than a test".
3. Note 164 section 1 cites `login-card.tsx:549,567`; the line with the password text is `:566` (`:549` fills it in).
   The README cites `:549,566`.
4. `contract_batch_n.md` E-BN-4 names "capture spec 05 (probe at every use)"; `05` holds no sentence about the probe
   (`grep -i probe` finds none), so there is no place for it there. The behaviour is in 03 PE-WM-03 and 08 PE-BN-15.
5. The brief said to continue `PE-WM-` or use `PE-BN-` in 03 and 08; `PE-BN-` was used (above).

## 4. Open items

| # | Item | Why open |
|--:|---|---|
| 1 | `05_capture_architecture_spec.md` is edited (PE-BN-13) although the brief's list of documents names README, 03, 08 and 10 only; item 2 of the brief and E-BN-1 name "the capture spec's list of production refusals" / "05 section A.1.2". I took item 2 as the order. One erratum, one index row, one `last_updated` mention; reversible by removing them | Scope read two ways; flagged rather than guessed silently |
| 2 | `delegation_progress/contract_wave_m.md` lines 39-45 (E-BN-6 "and wherever the table is repeated") is not edited | Outside the listed documents; the correction stands in 03 PE-WM-01 |
| 3 | Controller rulings the errata rest on as built, from note 164 section 11: (1) S99-09 is a handler rule; (2) it covers all three credential kinds; (3) `transcriptModel` bounds are 256 (stricter for `report`); (4) `test:regression` includes the 35-minute series; (5) S99-01 fails closed on unreadable operators. If the controller rules differently (for instance narrows (2) to `SECRET`), PE-BN-08, README Known limit 44, PE-BN-11 / PE-BN-14 and PE-BN-06 change | Note 164 asks for a ruling; none is on record in `decisions.md` at the time of writing |
| 4 | The suites of note 164 section 9 were not re-run; README quotes them "as that note reports them". `test:regression`, `test:seal-e2e`, `test:dev-session-e2e`, `test:kill-matrix` and `test:capture-worker-e2e` have not been run through their scripts by anyone; README, PE-BN-06 and PE-BN-07 say so | Documents only; the test runner owns it |
| 5 | The README says the batch N fixes are in a working tree that is not committed. When the commit is made the "Tree state" paragraph, the `last_updated` lines and the "uncommitted at the time of writing" phrases need the hash; none was invented | The commit is the controller's |
| 6 | Line cites point into the uncommitted tree (`package.json`, `scripts/test/`, `evidence-rules/`, the edited core-server and client files are modified or untracked). A further edit by the code driver moves them | The code driver's note 164 is the dated record |
| 7 | 08 PE-BN-15: `OPEN_FAILED` is not a key of `common.captureNotice.cause.*`; which sentence a client draws for a microphone alert with that cause was not driven or traced | Tests only; no lane run |
| 8 | No UX sentence on the sign-in cards printing the demo password was added: the UX spec has no such statement (`grep` finds only the class C row at line 1579 "demo password replaced"); the open state is in 03 PE-BN-12, 05 PE-BN-13 and README limit 34 | Nothing to correct in 08; R101-01 is next task's |
| 9 | E-BN-9 (suite counts for the trackers) is not in these documents; the README has the counts in the "Tree state" paragraph only | The trackers are the controller's |

---
*Generated: 2026-10-11*
