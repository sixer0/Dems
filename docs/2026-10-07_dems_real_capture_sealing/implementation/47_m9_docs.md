---
task_id: 2026-10-07_dems_real_capture_sealing
task_slug: dems_real_capture_sealing
row: 96 (M9-W2, docs)
date: 2026-10-10
agent: data-analyst (rules D94 / D122 / D163)
narrative_tier: 3
status: needs-review - every document is written; six points need a ruling (section 8) and the device / browser sentences wait for the gates (section 7)
closes: DOC-01, DOC-02 (as briefed: errata index), DOC-04, DOC-05, DOC-06, B6 (runbook part)
check: M9-DOC-1
---

# 47 - M9 docs (row 96)

Tree `f293221`, started while the milestone gates run on the live environment. Documentation only:
markdown files were edited; no source, config, script, lockfile, test or bundled asset; no server,
no test suite, no emulator, no installer, no network request; no commit. `.data/pg*.env` was not
read; no credential, key or token was written; no STT speed figure was written; no media file was
opened. `decisions/decisions.md` shows as modified in `git status`: that is the controller's edit,
not this row's.

Read-only commands this row ran: `grep`, `sed -n`, `git diff / status / ls-files`, `otool -L` on the
built worker, `ls` under `.cache/stt/`, and one Python script that READS `package-lock.json` and the
installed `package.json` files (section 5).

## 1. Files changed

| File | Change | Lines |
|---|---|---|
| `README.md` | DOC-01, DOC-06, B6, STT runbook, SEC35-26: one new section "Real capture, sealing and transcript" (13 subsections) before "Tests"; 4 rows in "What this is" and one sentence under it; the PostgreSQL server runbook under Live mode step 1; a correction line in "Tests"; 8 rows and one corrected row in "Troubleshooting"; one bullet in "Licences and known issues". Existing structure and text kept | +236 / -1 |
| `THIRD_PARTY_NOTICES.md` | DOC-05: one appended section "Component register of the real-capture task at commit `f293221`" (6 parts). Append-only; the heading `composite.ts:48` cites is untouched | +147 |
| `docs/…/masterplan/03_api_contract.md`, `05_capture_architecture_spec.md`, `06_evidence_package_spec.md`, `08_client_ux_spec.md` | DOC-02: an "Errata index (fix passes of 2026-10-10)" under the title of each. No spec text changed | +15, +16, +15, +13 |
| `packages/shared/assets/demo-evidence/README.md`, `packages/shared/assets/demo-media/README.md` | DOC-04: one appended, hand-written note each on version-2 packages. Marked as not written by the generator | +21, +10 |
| `apps/capture-worker/README.md` | The retired control `neg_sup_forbidden_mux_option` corrected (D170 routed it here); two appended sections: state at `f293221`, linked libraries and licence | +12 / -1 |
| `docs/…/implementation/evidence/47_npm_production_inventory.md` (new) | DOC-05: the full npm production dependency list, 1,290 rows, generated | new |
| `docs/…/implementation/47_m9_docs.md`, `delegation_progress/data_analyst_row96.md` (new) | this note and the progress file | new |

Checked before editing: no test, script or module reads `README.md`, the masterplan specs or the
asset READMEs (`grep` for `readFileSync|readFile|open(` with those names: no hit); the two Vite
globs take `*.{mp4,m4a,jpg}` and `*.{json,sig,jsonl,zip,m4a}` only
(`apps/core-web/src/features/evidence/demo-assets.ts:29-36`, `components/media/demo-media.ts:26-32`),
so the asset READMEs are not bundled. `scripts/release/build-web-packages.ts:58,503` copies
`THIRD_PARTY_NOTICES.md` into a package at release-build time only.

## 2. Must-carry items: where each now is

All in `README.md`, section "Real capture, sealing and transcript", unless said otherwise.

| # | Item | Heading | Also in |
|---|---|---|---|
| 1 | Evidence at rest | "Evidence at rest: recordings are plaintext until the seal completes" | Known limits 1; refusal table (`CAPTURE_EVIDENCE_STORE_UNUSABLE`); Troubleshooting |
| 2 | Quarantine | "Quarantine: a recording that cannot be sealed" | "Reset rules"; Known limits 2; Troubleshooting (`SEAL_BLOCKED`) |
| 3 | One media store per database | "One media store per database" | Live mode step 3 (existing text); Known limits 3; errata index of spec 06 (PE-M7-04) |
| 4 | Cameras and time | "Cameras and time" | Known limits 4; `apps/capture-worker/README.md` "State at commit" |
| 5 | Evidence volume | "Evidence volume" | Known limits 5, 6 |
| 6 | Sealed package facts | "Sealed package facts for a verifier" | Known limits 7 to 11; `demo-evidence/README.md` note |
| 7 | Privacy | "Privacy, personal data and custody" | Known limits 12, 26 |
| 8 | Export | "Export" | Known limits 13, 14; `THIRD_PARTY_NOTICES.md` (the record itself, unchanged) |
| 9 | STT | "Transcription (STT)" | set-up table; Troubleshooting (`transcriber.config`) |
| 10 | Operating | "Capture operation: what a Core records" (modes, refusal table, set-up table, "The signing key") and "Reset rules" | Troubleshooting |
| 11 | Known limits | "Known limits": one table, 33 items, each with its decision | - |

SEC35-26 is the first bullet of "Privacy, personal data and custody" and Known limits 26. DOC-06 is
"Read-only areas". B6 is "PostgreSQL server runbook (`scripts/pg/server.mjs`)" under Live mode step 1;
it carries the hint finding W91-17 asked for (`.data/postgres.log` holds only what the server wrote
before its log collector started; the rest is in `.data/postgres/log/postgresql-<hour>.log`;
`scripts/pg/init.mjs:78-84`, `scripts/pg/lib.mjs:137`).

## 3. Where the must-carry wording was changed to what the code holds

| Item | Brief | Written | Ground |
|---|---|---|---|
| 1 | `.quarantine`, `.transcriber`, `.sealing` must be owner-only; the Core refuses to boot otherwise | The boot refuses the root, `.quarantine`, `.transcriber` and `.transcriber/sessions`. `.sealing` and `.capture-session` are said to lie inside the owner-only root; the Core creates `.sealing` 0700. No boot refusal is claimed for `.sealing` | `capture/boot/checks.ts:165-169` (`EVIDENCE_STORE_PRIVATE_FOLDERS` has no `.sealing`), `:193-208`; `sealing/pipeline/package-writer.ts:33` |
| 4 | a camera more than 2 s behind is given up | Written for "behind" only. Nothing is said about a camera more than 2 s AHEAD: not read | `apps/capture-worker/src/anchor.h:21`; D188 |
| 9 | the server's key is configured through the STT settings (write-only field) | The settings take a credential REFERENCE (a pointer to where the key is kept), write-only. The form that takes the key itself exists in the contract and is not offered on screen | `apps/core-web/src/features/system/stt-config-model.ts:47` (`STT_SECRET_FORM_OFFERED = false`); `packages/shared/src/i18n/en/system.ts` `stt.credentialRefHint` |
| 9 | - | Speaker labels are "unavailable" in every sealed transcript of this build: the Core composes no speaker engine | `apps/core-server/src/transcription/index.ts:229-230` |
| DOC-05 | "the converted model's licence" | The model file was not converted here: the pre-converted file was downloaded and checked against its published SHA-256 | `delegation_progress/coder-execution-local__row108.md:8,37-46` |

## 4. Runbook commands and where each is defined

None was executed. Each exists with that exact name and those flags.

| Command (as written in the documents) | Defined in |
|---|---|
| `npm run capture:dev-setup` | root `package.json`, script `capture:dev-setup` = `node scripts/capture/dev-setup.mjs` |
| `make -C apps/capture-worker` | `apps/capture-worker/Makefile:56` (`all: check selftest unit $(BIN)`) |
| `make -C apps/capture-worker e2e`, `… versions` | `Makefile:148`, `:151` |
| `npm run evidence:dev-key -w @dems/core-server` | `apps/core-server/package.json`, script `evidence:dev-key` = `tsx src/sealing/dev-key-cli.ts` (header: refuses when a key exists; "A production key is not provisioned by this command") |
| `scripts/lane/lane.sh start <main\|1\|2\|3>`, `stop`, `reset`, `status` | `scripts/lane/lane.sh:158-165` (verbs), `:50-57` (instances), `:103` (root made 0700), `:113-116` (the `check …, code …` line) |
| `npm run pg:init`, `pg:start`, `pg:stop`, `pg:status`, `pg:remove-data`, `pg:remove` | root `package.json` scripts `pg:*` = `node scripts/pg/<name>.mjs`; behaviour read in `scripts/pg/server.mjs:51-121`, `start.mjs`, `stop.mjs`, `lib.mjs:495-504` (lock, 120 s; `init.mjs:201` 300 s) |
| `db:seed`, `db:reset` (named, with the existing README forms) | root `package.json` scripts → `apps/core-server/package.json` `db:seed` = `tsx src/db/seed/cli.ts`, `db:reset` = `tsx src/db/reset/cli.ts` |
| `npm test -w @dems/core-server`, `npm run test:db` | `apps/core-server/package.json` `test` = `vitest run --project unit`; root `test:db` |
| `lsof -nP -iTCP:4432 -sTCP:LISTEN` | a read-only system command, the form the existing README uses for port 4420 |
| `node scripts/release/gen-npm-licenses.mjs --workspace <name> --out <file> [--title <text>]` | `scripts/release/gen-npm-licenses.mjs` (`parseArgs`) |
| `chmod 700` of a media store (in words) | the Core's own refusal text, `capture/boot/checks.ts:76` |
| Uninstall of the CPU engine (in words: delete `.cache/stt/`) | recorded as `rm -rf …/.cache/stt/` in `initialization/04_whisper_cpp_cpu_build.md` section 9; not written as a command line |

Environment variables named in the documents are those of `apps/core-server/src/config.ts:44-51`.
Refusal codes are those of `capture/fence/operation.ts`, `capture/fence/boot.ts:42-47`,
`capture/boot/checks.ts:51-67,171-189`, `transcription/boot.ts:37-42`, `db/reset/errors.ts:89-102`.

## 5. DOC-05 component table check

**npm.** Enumerated without an installer: a Python script (kept outside the repository) read
`package-lock.json` (lockfileVersion 3, 1,920 entries, SHA-256 `83fc059c…5c20cc`) and walked, from
each app workspace, `dependencies`, `optionalDependencies` and the `peerDependencies` that have a
lockfile entry, with Node's resolution order; `devDependencies` not followed; `@dems/*` followed and
not counted. Licence = the lockfile entry's `license`, compared with the installed package's own
`package.json`.

| App | Packages |
|---|---|
| `@dems/core-server` | 138 |
| `@dems/core-web` | 390 |
| `@dems/mobile` | 865 |
| `@dems/mock-core` | 100 |
| `@dems/transcriber` | 8 |
| unique `name@version` over all | 1,290 |

Unresolved names 0. Lockfile / `package.json` disagreements 0. **"Licence not established": 0 npm
packages.** 70 entries are optional packages for other platforms, not installed here (lockfile
value only). Full list: `implementation/evidence/47_npm_production_inventory.md`. Counts per licence
and every package outside MIT / ISC / Apache-2.0 / BSD are in `THIRD_PARTY_NOTICES.md`, part 5.

**Native and other components.** `THIRD_PARTY_NOTICES.md` part 2: 17 rows, part 3 holds the 15
components of transcript spec section F one by one, part 4 the outcome of LB-1 to LB-5.

**Licence not established (listed as such, not guessed):**

1. The licence terms of a DISTRIBUTED capture worker that links the FFmpeg libraries of a GPL build.
2. Whether the worker builds and passes its checks against an LGPL-only build.
3. The Homebrew FFmpeg's other loaded libraries (opus, lame, dav1d, libvmaf, OpenSSL).
4. Maven / Gradle dependencies of the Android build (in no lockfile).
5. The oMLX server's own licence (not distributed).
6. The Python packages of the unused conversion environment `.cache/stt/venv-convert`.
7. LB-3 as row 78 left it: faithful conversion of the CAM++ ONNX file; terms of its training data.
8. Which of the 1,290 npm packages end up inside a web bundle or an APK.

## 6. What could not be grounded and was therefore not written

- A procedure for keeping, releasing or destroying a quarantine folder. Spec 06 erratum PE-M7-02
  item 4 says this is "an operator procedure (docs row 96)"; no decision, command or note defines
  one. The README says that it is an operator procedure outside the product.
- A command or script for the session-key folder rename. None exists; the README gives the rule of
  `sessionKeyScopeOf` in words.
- How to synchronise a camera's clock. The product sets no camera clock; nothing is written beyond
  "set every camera to the same time as the Core".
- A production signing-key procedure. None exists.
- A consent, retention, erasure or impact-assessment text (SEC35-26): carried as an accepted risk.
  I found no decision in which the user accepts it; decisions D14 / D15 only route it onward (to row 40, then to rows 96 / 99).
- Any statement about the existing "Known limits in Live mode" list of the backend task: not
  re-verified against `f293221`, left as it was.
- The Indonesian summary at the top of the README: not extended (the brief asks for English).

## 7. Sentences that describe device / browser behaviour (not yet gate-verified)

Written from the code and the fix notes; to re-check after the gates named.

| # | Where (README heading) | Sentence about | Gate |
|---|---|---|---|
| 1 | Capture operation, "Devices" | "Search for cameras" on the Devices page; the connect flow is web-only; development sources not listed in production | 70 |
| 2 | Capture operation, "Recording" | "Connecting cameras…", the one-camera warning, the failed start | 75 |
| 3 | Capture operation, "Recording" | who may switch the audio source; no automatic switch | 75 |
| 4 | Cameras and time | the advisory above 500 ms and the CRITICAL fault as the operator sees them; `tracks[].clockOffsetMs` in a product-sealed package | 75, 89 (C2) |
| 5 | Evidence volume | the volume alert as shown | 75 |
| 6 | Quarantine | the INCOMPLETE state on both clients; `SEAL_BLOCKED` in a running Core (D189: not proven in a running Core) | 89 |
| 7 | Evidence at rest | removal by proof and the kept-plaintext alert in a running Core (D189: same) | 89 |
| 8 | Sealed package facts | the notices and the development marks as both clients show them; the server-backend model line | 89 |
| 9 | Sealed package facts | the version-2 tamper demonstration in the clients (the API answer is proven: `initialization/04`, section 6) | 89, 94 |
| 10 | Privacy | the notice before a pre-check and before Start Recording, and the "is on" line, on every client | 70, 75 (attended runs are the user's) |
| 11 | Export | "Download export", the 60 s link, the mobile sentence, the composite sentence | 94 |
| 12 | Transcription (STT) | the settings menu on the web, the read-only status on mobile | 81 |
| 13 | Known limits 14 | playback past 60 s on a device | 94 |
| 14 | Live mode, PostgreSQL runbook | the messages of `pg:start` / `pg:stop` (read from the scripts, not run) | 95 (C6 pg-scripts) |
| 15 | Troubleshooting | the boot-stop rows (`check …, code …`) | 70 |

## 8. Decisions for the controller

| ID | Point | What I did |
|---|---|---|
| R96-1 | **The asset READMEs are generator outputs** ("Do not edit by hand: regenerate"). The generators are source and could not be edited | Appended a marked, hand-written note to each. A regeneration removes it. To make it permanent: the same text into `readmeText` of `gen-demo-evidence.ts` / `gen-demo-media.ts` (a source row) |
| R96-2 | **The full npm list is in the task folder, not in `THIRD_PARTY_NOTICES.md`** (1,290 rows; the notices file is copied into every web package) | Notices hold method, counts, every less common licence and the path. Alternative: move the table into the notices file or a root file |
| R96-3 | **The capture worker LINKS a GPL build of the FFmpeg libraries.** No record covers a distributed worker; the M8 record covers the separately started program only | Stated as a fact and as "not established"; routed to the product owner's licence decision (D139). It widens that decision from the composite to the worker |
| R96-4 | **DOC-02 by the register is a refresh of `01_specs.md`** (media serving, listener, device rules). The brief limits this row to an errata index on the specs the fix passes touched; `01_specs.md` was not among them | Followed the brief; `01_specs.md` untouched |
| R96-5 | **Rulings of the fix wave that have no text in any spec** (`grep` over specs 01, 03, 05, 06, 07, 08: 0 hits each): the clock-offset advisory `CAMERA_CLOCK_OFFSET` and field 40's source (D188, D190); the switch boundary before the command (D142 "spec cap §E erratum"); `SEAL_BLOCKED` (D189); the evidence-volume sync notice and `syncLevel` (D189, D190); `FRAGMENT_SIZE_BOUND_REACHED` (D179, D188). Also CAP-M7-01's last bullet in spec 05 is superseded by PE-M7-04 | Not written (the brief: do not rewrite the specs). The index of spec 05 carries the pointer for the last one. The README states the operator side of each |
| R96-6 | **The quarantine procedure and the acceptance of SEC35-26** are policy that no decision holds (section 6) | Stated as open in the README |

## 9. Check M9-DOC-1

| Clause of the check | State |
|---|---|
| runbook (B6 `scripts/pg/server.mjs`) | written: README, Live mode step 1 |
| README corrections | written: Tests counts, the demo-controls row, the worker README's retired control; the new section |
| DOC-05 licence table complete against transcript spec section F | 15 of 15 listed with their state: `THIRD_PARTY_NOTICES.md`, part 3 |
| DOC-06 regeneration note | written: README "Read-only areas" |

The check is a document inventory; it is the gate's to pass. Nothing here was executed to prove a
behaviour.
