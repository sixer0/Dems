# Wave 11, agent W1 - apps/core-web (rows 234, 198, 112; the Try-it deny list)

Date: 2026-10-13. Status: complete. Single writer of `apps/core-web` in this wave. Nothing committed.
EDIT-ONLY RULE KEPT: every existing file was changed with the Edit tool after re-reading; new files
with Write; `routeTree.gen.ts` is the output of the repository's own generator
(`@tanstack/router-plugin`), not written by hand. No dev server was started; ports 5173 / 5178 and
the instance on 4423 / 5178 were not touched; no browser check was made. No real device, no credential.

## Items

| # | Item | Status | Record |
|---|---|---|---|
| 1 | Row 234: the slot assignment states the reason of every refusal | complete | `implementation/234_slot_refusal_sentence.md` |
| 2 | Row 198: the confirmation dialog of a camera re-address (operation 100) | complete | `implementation/198_readdress_dialog_web.md` |
| 3 | Row 112: commissioning settings, scan and alias state, TECHNICIAN only | complete | `implementation/112_commissioning_web.md` |
| 4 | Try-it DENY list: operation 108 (decision C67 (1)); operations 109 and 110 (request of agent A5, row 116) | complete | this file |

## Item 4 - the Try-it deny list (11 -> 14)

| Operation | Reason of the refusal | Sentence |
|---|---|---|
| 108 `testCaptureDeviceConnection` | `STORED_CREDENTIAL` (new) | `web.tryIt.storedCredentialDenied`: "This operation makes the Core use a stored camera credential against a device on the network and cannot be tried from the reference page." |
| 109 `acceptInstallation`, 110 `revokeInstallationAcceptance` | `STORED_RECORD` (new; A5's proposal) | `web.tryIt.storedRecordDenied`: "This operation changes the installation record of the Core. It is not offered for Try-it." |
| the eleven before | `SECRET` (unchanged) | `apiReference.tryIt.secretDenied` (unchanged) |

Files: `features/api-reference/try-it.ts` (the list, `TRY_IT_STORED_CREDENTIAL_OPERATIONS`,
`TRY_IT_STORED_RECORD_OPERATIONS`, two optional sentences of `createLiveTryItFetch`, the record's
sentence by reason), `features/api-reference/index.tsx` (the two sentences handed in), `i18n-web.ts`
(`web.tryIt`), `test/live-api-reference-document.test.tsx` (denied 11 -> 14; allowed 97 -> 96, which
is 110 - 14; two new cases; the per-operation case reads the reason), `test/live-api-reference-page.test.tsx`
(the sentence per operation). The registry pins 108 -> 110, 42 -> 44, 41 -> 43 in the three web files
were moved by agent A5 (its line in `file_requests.md`); W1 did not move them.

DRIVER DECISION: the three operations that hold no secret are refused under reasons and sentences of
their own instead of "carries or returns a secret" - a refusal sentence states what is true.

## Checks (from `apps/core-web`, `--maxWorkers=2`)

| Check | Result |
|---|---|
| closing targeted run, 16 files (the files touched, the pin files, the static rules a new folder meets) | `Test Files 16 passed (16)`, `Tests 409 passed (409)` |
| `npx tsc -b` | 0 errors in `apps/core-web`; 1 error NOT mine: `packages/shared/src/api/installation-acceptance.ts(171,10): error TS6133: 'utf8Bytes' is declared but its value is never read` (agent A5's file, in flight) |
| `npx oxlint` (`npm run lint`) | exit 0, no finding printed |

Reruns after a failure, each in my own new code or new test: `camera-search.test.tsx` (Escape does not
close the kit's alert dialog), `commissioning.test.tsx` (viewport for the sidebar; `retry-after` of a
scripted 429), `core-queries.test.tsx` and `box-check.test.ts` (two static rules my new page and
stylesheet broke: `query.refetch()`, a break-anywhere rule) - all fixed, then green.

## Requests left in `file_requests.md`

1. Agent A5 / the next i18n step: four sentences into `common.captureSlotRefusal` (A5 answered: not
   added, the wording is a product text to be ruled) - not blocking.
2. Agent A5: the pin coordination of operations 108 to 110 - served on both sides.

## Driver decisions for the controller to confirm

See the tables of the three records (234: DD-1 to DD-3; 198: DD-1 to DD-4; 112: DD-1 to DD-6) and
the one of item 4 above.

## For the user

The sentence a production camera on a development Core now reads at the slot:
"This camera was not assigned: it is a production device, and this Core runs in development capture
operation. This camera can be assigned only on a Core running in production capture operation.
Nothing was changed."
