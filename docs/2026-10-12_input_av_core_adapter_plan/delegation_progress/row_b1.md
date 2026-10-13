# Row B1 - ONVIF reply bound (B-01, decision C95)

Status: **complete**. Record: `implementation/b1_onvif_reply_bound.md`.

- Triggering shape: many occurrences of `xmlns`, each far from the next `=` (or with none) - `onvif/lib/utils.js:56` scans from every occurrence to that sign or to the end.
- Fix: `camera/onvif-reply-guard.ts` (NEW, imports nothing) installed on the one agent of each exchange in `onvif-session.ts` and `onvif-network.ts`; the package never receives a refused reply.
- Caps per reply: 16 KiB (clock, stream address, the three set answers), 64 KiB (services, capabilities, interfaces), 128 KiB (profiles). Stub answers measured: 360 to 3,635 bytes.
- Worst case: 41.9 s (review; 82.2 s here with the guard off) -> 1.8 to 3.1 ms. Per-reply budget: 25 ms measured, 250 ms asserted.
- Other entry points: `probe-answer.ts` (WS-Discovery) not affected, not changed; none else.

Files changed: `camera/onvif-session.ts`, `camera/onvif-network.ts`, NEW `camera/onvif-reply-guard.ts`, NEW `camera/__tests__/onvif-reply-guard.test.ts`, `camera/__tests__/onvif-session.test.ts` (one block appended), `camera/__tests__/onvif-network.test.ts` (two imports, one block appended), `capture/__tests__/static.test.ts` (one named entry).

Checks: final run `Test Files 6 passed (6)`, `Tests 228 passed (228)`; wider unit run `1552 passed, 1 failed` (the red is `fence.test.ts:294`, not this row's); `tsc`: 2 errors, both in `boot/__tests__/program-checks.test.ts`, none in this row's files.

Requests: one line in `file_requests.md` (real answer sizes for the hardware package; the driver decision on the exchange total; the two foreign reds).

Driver decision: `maxReceivedBytes` stays 1,048,576 as the total of an exchange.

Edit tool only for existing files; nothing committed; loopback only; no real device or credential; ports 4423 / 5178 not touched; `node_modules` and the lockfile not written.
