# Delegation progress: design X-1 and X-2

| Item | Value |
|---|---|
| Agent | data-analyst |
| Date | 2026-10-13 |
| Status | needs-review (security review of the design is the next step, P11 (3); no code before it) |
| Created | `masterplan/05_design_x1_x2.md`; this file |
| Edited | none (no source file, no other plan document, no decision row) |
| Run | read-only inspection only (`ls`, `grep`, `sed -n`, `cat -n`); nothing built, started, migrated or provisioned |
| Not opened | any `.env`; `apps/input-av/data/`; the content of any file under `.data/` (for `.data/signer` and `.data/credential-store`: names and modes only); the Graft graph |

## Decisions taken in the design

| # | Item | Chosen |
|---|---|---|
| 1 | X-1 | A host-side command `evidence:production-key --data-dir <dir>` over the existing `provisionSigningKey`: software Ed25519, self-signed, file store 0700 / 0600 / 0600 / 0644 as built. The certificate subject states organisation and installation. Checks 4 and 4b unchanged |
| 2 | X-1 identity | "Production" is not only the absence of the development mark: the subject names the installation. The identity is self-asserted; the binding is the out-of-band fingerprint (a hand-over record) |
| 3 | X-1 self-signed | Stated as a limit (no CA, no chain), printed by the command and in the README |
| 4 | X-1 backup | The signing key is not backed up (loss = no new seals until a new key; old packages stay readable). Known limit 37 concerns the credential store and is left apart, open |
| 5 | X-2 | A host-side command `operator:set-password` with two forms, `--username <u>` and `--all-demo`; Core stopped; password typed at the terminal, echo off, twice; hashed with the existing Argon2id wrapper. Check 4c unchanged |
| 6 | X-2 console operation | Not in scope now: a later row. Check 4c can be satisfied without it |
| 7 | Audit | X-1: provisioning record on disk plus two public members on the existing `SYSTEM_BOOT` row. X-2: a new audit type `OPERATOR_PASSWORD_SET`, actor null, written by the command under the chain lock |

## Work packages proposed (section 8 of the design)

X-C (M), X1-1 (S), X1-2 (S), X1-3 (S), X1-4 (M), X1-5 (S, optional), X2-1 (S), X2-2 (S), X2-3 (M), X-D (S), X-G (S to M).

## Hypotheses the first step of a row must close

| # | Hypothesis | Row |
|---|---|---|
| H1 | A file outside `src/sealing` may import `provisionSigningKey` without breaking a static rule | X1-1 |
| H2 | The audit writer can run on an owner-role transaction outside the app | X2-3 |
| H3 | Session ending and biometric revocation are reusable from a command | X2-3 |
| H4 | `SYSTEM_BOOT` details admit two keys by a details-rule edit | X1-2 |
| H5 | Raw-mode terminal input behaves alike on macOS and Ubuntu 24.04 | X2-2 |
| H6 | The remaining production refusals (check 4d and others) can pass on this Mac | X-G |
| H7 | One new audit type moves the pinned contract totals | X-C |

## Findings outside the two functions (for the controller)

1. The operators of a production database are the three persons of the demo dataset; no operation creates an operator (`packages/shared/src/sim/dataset.ts:118-146`; `apps/core-server/src/db/schema/rbac.ts:76`). X-2 changes passwords, not people. User decision UD-8.
2. A production database is a seeded database; the seed is the only source of roles, permissions and operators and writes the demo dataset with them (`apps/core-server/src/db/seed/seed.ts:312`; S99-01 (b)).
3. Both sign-in cards still print the demo password (Known limit 34; S99-01 (d)).
4. One key id only is loadable today (`apps/core-server/src/sealing/signing.ts:36-38`), the default certificate validity is 1,825 days (`apps/core-server/src/capture/signer/host-key.ts:44`): without rotation (X1-4) an expired or compromised key has no way out.
5. `markSigningKeyCompromised` has no non-test caller (`host-key.ts:260`): runbook step (b) has no command.

## One slip to report

A `grep` on `packages/shared/src/sim/dataset.ts` returned the line of the published demo password constant, value included. It is the published constant the README and both sign-in cards print, not a real credential; it was not copied into either document.

## Blockers

None. Open decisions UD-1 to UD-11 each have a recommended default.
