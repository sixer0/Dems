---
task_id: 2026-10-12_input_av_core_adapter_plan
row: 5
date: 2026-10-12
agent: coder-execution
tier: T3
requirement: S13-16 (3)
status: needs-review
---

# Row 5: the two needles of S13-16 (3) in the count-only secret scan

## Finding first: the "existing scan" was not a file

`verification/02_security.md:296` and the row point at "the existing count-only scan (root ignore file, lines 79-82)". Those lines are a comment and an ignore rule. The scan itself was a scratch script written per run (`docs/2026-10-04_dems_backend_rbac_pairing/report/02_git_final_commit.md:36-40`, "Script: `scratchpad/logscan.js`"); no tracked file outside `/docs` holds it (`git ls-files` searched for "scan": only static-rule scanners and UI files). A needle cannot be added to a script that is not there, so this row made the scan a repository file with the pattern needles that report lists, and added the two. That is more than "add two needles": hence `needs-review`.

## What was built

| File | Change | Description |
|---|---|---|
| `scripts/secret-scan/count-only.mjs` | new | the scan: 6 pattern needles, counts and file names only, exit 0 / 1 / 2 |
| `scripts/secret-scan/count-only.test.mjs` | new | 5 tests (`node --test scripts/secret-scan/`) |
| `.gitignore` | modify | one comment line under line 80 naming the script; no rule changed |

## The needles

| Id | Form, in words | Origin |
|---|---|---|
| `session-token`, `device-credential`, `biometric-token` | the three token prefixes followed by 16 or more token characters | the scratch scan of the backend task |
| `database-locator` | a PostgreSQL address with account and password before the host | same |
| `camera-credential` | **new.** A media or service address (RTSP, RTSPS, HTTP, HTTPS) with a user part: account, colon, password, at-sign before the host | S13-16 (3); the form the design forbids outside the relay (`masterplan/04_design_addendum.md:240`) |
| `ingest-secret` | **new.** A loopback RTSP address with a port, whose path holds an element of 22 or more characters of the URL-safe set. An element that is exactly a UUID is not counted (a session ID) | S13-16 (3); RC-2: 128 bits in URL-safe text need 22 characters in base64url, 32 in hexadecimal |

The scan reads each file as bytes, so a form inside a binary file counts too. It prints, per run: files scanned and skipped, one count per needle, one `HIT <file>: <needle>=<count>` line per file with a hit, a total. It never prints a line or a value (a test asserts it for the planted strings). Folders `.git`, `node_modules` and `apps/input-av/data` are never walked.

## Verification (the row's cell: "the scan run on a file planted with each form counts 1 for each; on the tree it counts 0")

| Check | Command | Result |
|---|---|---|
| Planted file, camera form | `node --test scripts/secret-scan/` | `camera-credential: 1`, `ingest-secret: 0`, exit 1 |
| Planted file, ingest form, 22 and 32 characters | same run | `ingest-secret: 1`, `camera-credential: 0`, exit 1, twice |
| Not counted: credential-free addresses, a port, a UUID in the ingest path, today's short path | same run | all six needles 0, exit 0 |
| Whole test run | same run | `tests 5`, `pass 5`, `fail 0` |
| The tree in the scan's scope: every tracked `.log` | `node scripts/secret-scan/count-only.mjs --tracked --ext=.log` | `scanned 726 file(s)`; all six needles `0`; `TOTAL: 0 in 0 file(s)`; exit 0 |
| The whole tracked tree (wider than the scan's scope) | `node scripts/secret-scan/count-only.mjs --tracked` | `scanned 10506 file(s); skipped 0`; `ingest-secret: 0`; `camera-credential: 54`; total 98 in 58 files |
| This row's own files and `delegation_progress/` | `node scripts/secret-scan/count-only.mjs scripts/secret-scan docs/.../delegation_progress` | `scanned 42 file(s)`; `TOTAL: 0 in 0 file(s)` |

The planted strings are synthetic (an account and a password that say "synthetic", a documentation address of 192.0.2.0/24, a run of one repeated character) and are put together at run time, so the test file holds none of the forms and the scan does not count its own test.

No typecheck: the row adds plain `.mjs` files outside every workspace; `node --test` loaded and ran both.

## The open point for the gate: "on the tree it counts 0"

- In the scan's own scope (logs before they enter a commit): 0 for both new needles, 726 files.
- `ingest-secret` on the whole tracked tree: 0.
- `camera-credential` on the whole tracked tree: 54 matches in 34 files. By file name: 15 under `/docs` (earlier tasks' plans and records, one of this task's research files), `README.md`, 2 production sources that handle the form on purpose (`packages/shared/src/api/redaction.ts`, `apps/core-server/src/evidence-export/secret-sweep.ts`) and 16 test files. The lines were not opened and no value was printed; by their place they are fixtures, examples and the redaction rules. This is a HYPOTHESIS until someone reads them.
- The other 44 matches (token shapes, database address) are the kind the backend task already kept out of the logs by name; they are outside this row.

So the cell holds for the scope the scan has always had, and does not hold for "every tracked file" with the camera needle. The controller decides which reading is the row's.

## Not carried over

The scratch scans also searched for values read from the local data folder (database passwords) and the published demo password. This file reads nothing but the files it is asked to scan, and this row reads no credential file. A run that needs value needles still needs its own step.

## Requests left (`delegation_progress/file_requests.md`)

1. Row 47 (`capture-session/index.ts`): keep the random element of RC-2 as one path element of 22 or more URL-safe characters, or change the needle in the same change set.
2. Root `package.json` (optional): a `test:secret-scan` script.

## DRIVER DECISIONS (to confirm)

1. The scan becomes a repository file at `scripts/secret-scan/` (new folder), carrying the four pattern needles of the scratch scan.
2. "The tree" of the verification cell is read as the scan's scope, the tracked `.log` files; the whole-tree numbers are reported beside it.
3. The camera needle covers RTSP, RTSPS, HTTP and HTTPS addresses with account and password; an authorization header is not a needle of this row.
4. The ingest needle's lower bound is 22 characters and a UUID element is exempt; the encoding of row 47 is not built yet.
5. Value needles are not carried over.
6. One comment line in `.gitignore` names the script.
