---
task_id: 2026-10-12_input_av_core_adapter_plan
row: 135
package: close
date: 2026-10-13
agent: coder-execution (batch 8, agent C/I)
tier: T1
status: complete
---

# Row 135 - installer note: from a seeded database to a first production boot

## 1. What was delivered (subject, place, reader)

One product document, new: `scripts/host/INSTALLER-NOTE-FIRST-PRODUCTION-BOOT.md` (102 lines, about 2,300 words; English body, Indonesian summary of half a page on top, section "Ringkasan (Bahasa Indonesia)").

DECLARED PATH and why: beside the host profile (`scripts/host/`), as the row's brief asks. The profile is the first document an installer opens; the note is the map that tells in which order the profile, the hardware procedure and the helper installation are used. It is a product document, so it does not live under `docs/`.

Reader: the installer of the Ubuntu 24.04 host and whoever plans the installation day. Stakeholders: the user (performs every step and provides the two missing things), the controller (closing report), the hardware acceptance (its frame is the authority for the steps).

No existing file was edited for this row. No code, no test, no build.

## 2. Content, against the row's cells

| Cell of the row / of the brief | Where in the note | Evidence |
|---|---|---|
| The path from a seeded database to a first production boot | section 4: 14 rows (steps 1 to 12, plus 3a and 7a) | each row: step, performer, authority, result |
| Where the host profile, the helper installation and the hardware procedure fit | section 3 (seven places) and the Authority column of section 4 | every path named exists (check 3 of section 3 below) |
| The unassigned-slot remedy | section 5, and steps 6 and 11 | `implementation/029_selector_server.md` section 1 (an unassigned slot is an absent line; operation 78 `unassign`); `implementation/030_precheck_unassigned.md` (item value `NOT_ASSIGNED`, status BLOCK, reason `<slot>: source not assigned`); decision C25 (four of four slots required, the standby included); `apps/core-server/src/capture/fence/boot.ts:12`, `:149` (`DEV_SOURCE_WITHOUT_FLAG`: a production Core refuses a selector with a development source) |
| `db:migrate` for a Core started from this branch | step 3a | decision C29 (1) (`decisions/decisions.md:56`); product `README.md:909` (boot check `B-3`) |
| The two things the repository cannot provide, stated plainly | the second paragraph of the note, the Indonesian summary, section 2 | `README.md:503` ("No command of this repository provisions a production signing key"; the demo-password refusal), `:481`, `:482`, `:487` (the three refusal codes), `:785` and `:794` (Known limits 25 and 34); `scripts/hardware-acceptance/HW-ACCEPTANCE-1-FRAME.md` section 4 (X-1, X-2), section 13 point 1 |
| "a first production boot is NOT reachable from the repository alone today" | stated in bold before the summary, again in the summary, section 2 and section 6 | the same README lines |
| Active scan only (row title) | notes of section 4 | ruling U9 (`decisions/decisions.md:20`); `HW-ACCEPTANCE-3-NETWORK-CAMERAS-SESSION.md:74` |
| The password change before adoption (row title) | step 10 | frame section 4 (UA-9), `PREP-13` |
| Every step names who performs it; steps performed by an agent: 0 | Performer column; section 1 states the count 0 | check 2 below |
| No credential, key or address of the user's network | section 1 states it | check 1 below |
| English body, half-page Indonesian summary on top, no emoji | 14 lines of summary after the status paragraph | check 1: 0 non-ASCII characters |

## 3. Verification (run on the delivered file)

| # | Check | Command (from the repository root) | Result |
|---|---|---|---|
| 1 | No address, credential, key; no emoji | counts over the note: dotted quads other than `127.0.0.1`; lines of the form `password|secret|token|key` followed by `:` or `=` and a value; `BEGIN ` blocks; hardware addresses; characters outside printable ASCII | 0; 1 (line 35: the words "demonstration password:" followed by the refusal code `CAPTURE_DEMO_OPERATOR_PASSWORD_IN_PRODUCTION` - a code name, not a value; read by eye); 0; 0; 0 |
| 2 | Every step has a performer, none is an agent | rows of the path table, and those whose Performer cell starts with `USER` | 13 of 13 before row 7a was added; 14 of 14 after (the added row's cell is `USER`); the words "agent" and "script" occur only in sentences that say they perform nothing |
| 3 | Every document the note points to exists | `[ -f ]` on the profile, two profile scripts, the four chapters of the hardware procedure, the two development records | 9 of 9 exist; `scripts/host/container/README.md` is delivered by row 78 of the same agent |
| 4 | The identifiers the note quotes are in their documents | `grep` for `HI-04` part A in chapter 4 (`:106`, `:217`), `PREP-07` to `PREP-14` and X-1, X-2, UA-9, UA-10, B-5 in the frame (read at `:89-139`, `:198-290`), `HOST-34`, `HOST-43`, `HOST-50` to `HOST-56` in the profile, the five refusal codes in `README.md` | all found |

No test suite, typecheck or build applies: one Markdown file.

## 4. Method, alternatives, assumptions, gaps

- Method: the note is a map and repeats no command beyond naming `db:create`, `db:migrate`, `db:seed`, `db:status`. The steps and their order are those of the frame of the hardware procedure (`PREP-01` to `PREP-14`), read in full for this row; the note adds the two limits on top and the remedy in one place.
- Alternative not taken: a self-contained procedure with its own commands. It would be a second source for the same steps and would drift from the profile and the frame; the brief asks for a short document.
- DRIVER DECISION 1: the note does not state the schema version number. Row 99 of this batch (agent D) is changing it while this note is written; the note says "the schema version `db:status` prints".
- DRIVER DECISION 2: row 7a (the helper's group before the first start of the unit) is listed as a step of its own, although the brief names only "where the helper installation fits". Chapter 4 makes it a hard ordering condition (`:106`); leaving it out would send the installer into a unit that names a missing group.
- Assumption carried from the sources, not re-measured: "a production Core with unassigned slots boots". It rests on record 029 (the boot step `capture.config` no longer stops on a NULL slot) and on the fence rule that refuses development sources only. A started `REAL_PRODUCTION` Core has not been seen by anyone, for the reason the note itself states; section 5 of the note says so.
- Gap: the dependencies 124:C and 127:C (the frame and chapter 4) are both marked UNVERIFIED on a host by their own authors. The note inherits that status and says so in its first line.

## 5. Unproven, and where it is settled

Everything the note maps is settled on the real host by checks `9A/H-01` to `9A/H-27`; the first production boot by `9A/H-16`, which cannot run before X-1 and X-2 exist.

## 6. Rules kept

Edit tool only for existing files (this row edited none besides its own new note; the claims line was appended with the Edit tool). Nothing committed. No file of `apps/` or `packages/` touched. The note was drafted while the container image of row 78 was compiling (idle time of that row); it was checked and recorded after row 78's record was closed.
