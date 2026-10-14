# Row N8 (wave 12) - the reader of the helper's lines

Status: complete. Record: `implementation/n8_helper_line_reader.md`.

- NEW `apps/core-server/src/capture/adapters/audio/macos-helper-lines.ts` (pure, no import) and `__tests__/macos-helper-lines.test.ts` (33 tests). No existing code file edited; `file_claims.md` one line by the Edit tool.
- Facts: `INPUT_HEADER`, `OUTPUT_HEADER`, `STREAM`, `QUEUE_FULL`, `QUEUE_FLUSHED` (both `output: 'NOT_STATED'`), `OPEN_REFUSED`, `ENDED_ON_SIGNAL`, `UNRECOGNISED`. Fold: `startHelperLines` / `readHelperLine`.
- Layout table: 40 entries, from the pinned build's `-hide_banner -layouts` (run once, no device), quoted in the record.
- Checks: row tests `33 passed (33)`; audio suite + capture static `9 files, 331 passed`; `test/static` `17 files, 210 passed`; typecheck exit 2 with three errors in `packages/shared/src/sim/capture-notices.ts:367-368` (row N2's area, in flight), none in this row's files.
- Mutations: 20, each seen RED (record s5). M12 is red by the reason only.
- Driver decisions for the controller: D1 (table = the build's list, each entry marked `MEASURED` or `BUILD_TABLE`; design 4.6 says measured only - N9 decides which it admits), D2 (a second stream line or header withdraws the statement), D3 to D8 (record s4).
- For N9: wait for `section === 'CLOSED'` before believing `state.stream`, or handle `STREAM_WITHDRAWN`. For N5: the input shape assumed is `{ text, cut }`.
- Requests: none.
