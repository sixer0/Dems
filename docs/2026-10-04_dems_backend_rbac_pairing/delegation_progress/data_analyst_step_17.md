---
task_id: 2026-10-04_dems_backend_rbac_pairing
agent: data-analyst
step: 17 (blueprint row 17, FIRM)
status: complete
date: 2026-10-04
last_updated: 2026-10-04 04:04
---

# Progress: data-analyst, step 17 (client integration specification)

## Status

complete

## Artifacts

| Path | State |
|---|---|
| `docs/2026-10-04_dems_backend_rbac_pairing/masterplan/04_client_integration_spec.md` | created (Tier 1, 1,483 lines, 17 sections, 101 acceptance criteria) |
| `docs/2026-10-04_dems_backend_rbac_pairing/delegation_progress/data_analyst_step_17.md` | created (this file) |

No other file was written. `masterplan/03_database_contract.md` (row 16, written in parallel) was not opened or touched. `git status --porcelain -- apps packages scripts release package.json package-lock.json` printed 0 lines after the work. No install, no code, no process. The specification was written with the file tools in seven parts; seven short Python text-replacement runs (exact-match replacements, each asserted to match once) corrected citations, cross-references, a few wordings and the timestamps in it.

## Milestones

1. Read in full: `masterplan/01_specs.md` (1,901 lines), `research/01c_explore_web.md`, `research/01d_explore_mobile.md`, `decisions/decisions.md`; the client records of `research/03_analysis.md` (TD-09 to TD-13, ADQ-1 to ADQ-10, assumptions, impact-question map, gap register, section 13); blueprint rows 1-118 with the protocol P1-P22 and the single-writer table.
2. Read the predecessor's design language: page mapping, shell and Login of `01_specs.md` §14; tokens, choreography rules and component motions of `03_motion_spec.md`; navigation guard, component vocabulary, Login, Pairing, auth and motion mapping of `04_mobile_specs.md`.
3. Read code for exact names (read-only): web `main.tsx`, `router.tsx`, `routes/__root.tsx`, `vite.config.ts`, `lib/core-endpoint.ts`, shell files, Login, Start Session, the system command wrapper, the Security & Audit panel, choreography and model, the API Reference fetch, `motion/variants.ts`; mobile `runtime/{contract,core-link,sim-runtime-provider,connection-banner}`, `navigation/{root-navigator,routes,session-guards}`, `auth/{auth-provider,biometric,auth-prefs}`, `features/pairing/*`, Login card, Settings preferences and security sections, `providers/app-providers.tsx`, `scripts/device-session.sh`, `package.json`; shared `sim/{engine,react,errors,types,constants,selectors,auth}`, `api/{core-api,constants,health,realtime-messages,openapi}`, `realtime/{heartbeat-client,heartbeat-context}`, `i18n/index.ts`.
4. Wrote the specification: shared client layer; mode switch per build; proxy, CORS and CSP; web sign-in and session; RBAC reactions; wiring map; Live behaviour of every synchronous site; mobile credentials, biometric unlock, pairing flow and gate; the two portal pages; API Reference; tests; AC-C-01 to AC-C-101; the nine open points; traceability; gap register; decisions.
5. Mechanical checks on the written file (commands run, output quoted):
   - acceptance criteria: `AC rows: 101 sequential: True`; every row names a success criterion
   - wiring map: `web groups found: 18 of 18`; `mobile groups found: 21 of 21 missing: []`
   - synchronous sites: `site ids: 70 missing rows: []` (web A1-A11, B-1 to B-10, C-1 to C-7, D-1 to D-6, E, F; mobile S1-1 to S1-8, S2-1 to S2-8, S3-1, S3-2, S4-1 to S4-9, S5-1 to S5-7)
   - `unresolved section refs: []`; `bad rows: 0` in the table-column check
   - no credential value and no operator name: 0 matches for the demo password literal and for the seeded operators' names

## Controller verification list (row 17) and where it is met

| Check | Where |
|---|---|
| Every feature folder listed by rows 3 and 4 appears in the wiring map | Sections 7.3 (G1-G18) and 7.4 (21 groups, plus `src/app/` and `features/home`) |
| Every synchronous-return call site has a stated Live behaviour | Section 8 (8.2 to 8.7) |
| Each new page has a component list, states, permissions and test IDs | Sections 10.1 (shared states), 10.2, 10.3 |
| The pairing flow and the gate have state tables | Section 9.4 (view table; route table) |
| Every AC-C is testable | Section 13: each row has "Tested by", "Row" and "SC" |
| Impact questions 1, 16, 17, 19 and 23 answered with section anchors | Sections 0 and 15.1: section 3, section 4, section 9.3, section 6, section 11 |
| The file ends with "Decisions for the controller to record" | Section 17 |

## Decisions for the controller to record (summary; full text in section 17 of the spec)

1. **24 choices that D11 and D13 left open** (section 17.1). The largest: one socket per client in Live mode with the heartbeat view fed from it; "own-command atomicity" (deltas are held while a command of this client is in flight, and the continuation runs in the same turn as the store update); `useCoreActions` plus `settle` as the call-site API, with a static test that forbids `useSimActions` in feature folders; web mode key `dems.core.mode.v1` and the environment preselection; Live only in dev builds; mode labels `SIMULATED`, `LIVE`, `LIVE · OFFLINE`; three secure-storage items behind one wrapper; the gate as an optional `pairing` member of the mobile runtime contract; routes `/admin/users` and `/admin/devices` in a new ADMINISTRATION navigation group, Live-only; the QR test asserts the payload handed to the component (no decoder); the API Reference page shows ten operations in Simulated mode and 75 in Live mode; `rotateDeviceCredential` is not called by the app.
2. **DEPARTURE-5 (needs a decision, wording of D11 only)**: "8 seam files" is confirmed as the eight files of ADQ-2, but the seam rows also write adjacent and new files; the mobile call-site count is 26 plus two runtime files, not 27.
3. **DEPARTURE-6 (needs a decision, conditional)**: if row 79 observes a second OS prompt on the rotation write, or a failing protected write or read, the biometric token is stored without `requireAuthentication` and the existing OS prompt is the gate. The decision record allows this for a failing write or read; the spec extends it to the double prompt.
4. **A change to a predecessor screen (SC8)**: the two mobile Core chips print "Live" in HEARTBEAT mode although the data is simulated; from this task on they print "Simulated" unless the source is LIVE (finding FC-1, rule MD-8).

## Findings

| ID | Finding |
|---|---|
| FC-1 | Mobile Core chips say "Live" in HEARTBEAT mode with simulated data (`home-header.tsx:109-115`, `more-model.ts:95-104`) |
| FC-2 | `apps/core-web/src/test/scalar-config.test.ts:70` pins ten operations through the page's document function; it is outside the 61 files and turns red between rows 27 and 99 unless the shared builder keeps a ten-operation scope |
| FC-3 | The web role matrix uses a local nine-entry list (`features/security-audit/model.ts:434-444`), so row 26 does not change the Simulated matrix on the web; the mobile profile sheet does list the three new permissions and needs labels |
| FC-4 | Seam rows write more than the eight ADQ-2 files: web `vite.config.ts`, `lib/core-endpoint.ts`, two i18n files; mobile `connection-banner.ts`, `runtime/index.ts`, `runtime/debug.ts`; plus new files |
| FC-5 | `expo-device` and `expo-constants` are already dependencies of the app; no source file imports `expo-device` today |
| FC-6 | Paths with no owning row: `apps/mobile/src/features/home/use-health.ts`, `apps/mobile/scripts/device-session.sh`, `apps/mobile/jest.setup.ts`, new cross-feature tests under `apps/core-web/src/test/`, `packages/shared/src/i18n/en/common.ts` |
| FC-7 | The web Start Session resume effect (`session-new/index.tsx:186-195`) would repeat `beginPrecheck` in Live mode without an in-flight marker |
| FC-8 | The web "Core offline" text prints the Core origin, which in Live mode is the page's own origin |
| FC-9 | The mobile health call is fixed to mock-core's origin (`features/home/use-health.ts:8`) |
| FC-10 | The mobile pairing timeline works unchanged on a clock that follows the server; only its commit becomes a request |

## Open points handed on

- Row 18: pin names and environment variables; schedule the early proofs CA-02, CA-03, CA-05 to CA-08 before the wide client waves; sequence rows 27 and 99 for the document scope; bind each emulator to one lane or pair per device check (a device credential belongs to one database).
- Row 20: the demo-operator disclosure in Live mode; the device credential stored without an authentication requirement; the biometric cases; Try-it with real commands in Live mode; the pairing code in page memory; whether presentation mode should be readable before sign-in (a contract addition, not adopted).
- Row 21: add the write paths of FC-4 and FC-6; split row 62 if too wide; row 76's QR check wording; rows 72, 88, 91 and 95 change no production file.
- Rows 27 and 98: the registry's `mode` meaning, the answering-service field and the builder's scope (section 11, AR-1).

## Blockers

None.
