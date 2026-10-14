# Row N8b (wave 12, track D) - the reader of the helper's lines against complete starts

- Status: **complete**. One request to row N9 (a real start must confirm the composed fixture).
- Record: `implementation/n8b_helper_line_reader_real_starts.md`.
- Decision: C118. No device opened, no helper started.

## Files

| File | Change |
|---|---|
| `apps/core-server/src/capture/adapters/audio/macos-helper-lines.ts` | modified: kinds `MAPPING_HEADER`, `MAPPING`, `OUTPUT_STREAM`; section `MAPPING`; state members `outputs`, `openOutput`; counts `mappingLines`, `mappingLinesOutOfPlace`, `outputHeaders` |
| `apps/core-server/src/capture/adapters/audio/__tests__/macos-helper-lines.test.ts` | modified: 2 cases edited (they pinned the fault), 22 added; 55 in all |
| `apps/core-server/src/capture/adapters/audio/__tests__/fixtures/macos-helper-starts/*.txt` | 8 new: 4 device verbatim, 1 device abridged, 1 composed, 2 pinned build on a generated source |
| `delegation_progress/file_claims.md`, `file_requests.md` | one line each |

## Result lines

| Check | Result |
|---|---|
| reader's tests, existing cases unedited | `Tests  2 failed | 31 passed (33)` (the two pinned cases) |
| reader's tests, final | `Tests  55 passed (55)` |
| audio suite + capture static set | `Test Files  9 passed (9)` / `Tests  366 passed (366)` |
| `npx tsc --noEmit` | exit 0 |
| mutants | N1 to N11, each RED in its named case |

## Open

- Request to row N9: the first start on the device is fed to the reader before the gate is trusted; that text replaces `composed-one-output-48k.txt`.
- Driver decisions D1 to D5 in the record, section 8.
- Deviation from "Edit tool only": the new test blocks were appended to the existing test file with a shell here-document (append only, no existing line touched). Record section 9.
