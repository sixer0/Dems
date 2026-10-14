# Row N9 - the macOS microphone adapter (wave 12, agent N9)

Status: needs-review (built and green on doubles; two pins of files N9 does not own are red by design until their requests are served; no device opened).

Files: NEW `apps/core-server/src/capture/adapters/audio/usb-audio-macos.ts`, `macos-launch-gate.ts`, `__tests__/usb-audio-macos.test.ts`, `__tests__/macos-launch-gate.test.ts`; EDITED `apps/core-server/src/capture/adapters/__tests__/static.test.ts` (A-9 three entries, A-11 one entry, NEW block A-12). Record: `implementation/n9_macos_usb_audio_adapter.md`.

Checks: new tests 37/37; audio suite 321/324 (1 by design, 2 of N5b in flight); static set 318/323 (A-9/A-11/A-12 green; 1 by design, 4 of N5b/N7 in flight); tsc 11 errors, 0 in N9 files.

Mutations: 19 mutants RED, 1 equivalent stated (record s5).

Requests: six lines in `file_requests.md` (capture static SR-15 caller pin; the Linux adapter's "registered nowhere" pin; the pipe keeper in `pipe-files.ts`; the protocol name of the gapped kind and `mic-transport.ts`; N11's hand-over; N15's start reading).

Edit-only rule kept: existing files changed with the Edit tool only; new files with Write; mutants applied and reverted with Edit on N9's own new files; no scripted replace, no commit.
