# Row N10 - the registry by platform (wave 12, agent N10)

Status: complete (not committed). Record: `implementation/n10_registry_by_platform.md`.

- Admission: `MACOS_MICROPHONE_OPENER_ADMITTED = false` (`capture/fence/index.ts`); test-only `wireProductionRegistry(parts, environment, { admitMacosMicrophoneOpener: true })`; the one production call hands 2 arguments (capture static "row N10", planted control).
- Loader `real.ts`: `audio` (linux) or `macosAudio` (darwin admitted), never both (refused before import); neither = stub.
- C-1: `registry.ts` `hasOpener === true` at the recordability check.
- Pipe keeper: `local/pipe-files.ts` `createPipeKeeper(timers)` (open O_RDONLY|O_NONBLOCK, read, close); mic-static pin widened by exactly those.
- Loss watch on darwin (admitted only): tied listing + `identifyMacosRegisteredCard`; SM-06 two-pass fault said as `CAPTURE_PRODUCTION_MIC_NOT_CONFIRMED` / `..._CONFIRMATION_ENDED`.
- (4): `MACOS_MIC_TRANSPORT = micTransportOf(CaptureMicInputKind.PCM_FIFO_GAPPED)`, constant removed.
- Darwin unchanged / linux unchanged: proven on doubles (`real.test.ts`), real app darwin db test green.
- Checks: unit 598/600 (1 red = RD2's credential.test.ts:471), test/static 210/210, db 64/64 + 5/5, tsc rc 0, oxlint rc 0.
- Requests: file_requests.md lines 582-585. Driver decisions D-1..D-4 (record s5).
- Edit tool only on existing files; two new files (this and the record).
