# Row M1c (track D) - revision 3 of the design of the macOS production microphone path, amended to the security addendum 08b

- Agent: data-analyst (designer). Date: 2026-10-13 19:08 (host `date`).
- Status: **needs-review** - the design is amended in place (08b rank 2; decision C110). The controller confirms it before rows N1 and N2 are cut. Six points of the addendum could not be written as it words them (design R3.3; list below).
- File amended, with the Edit tool only: `masterplan/06_design_macos_microphone.md` (815 lines before, 1,330 after; structure kept; new sections R3, 4.3.1 to 4.3.4, 7.2a, 8.4a, 8.6, 10.1 re-cut with revision 2's table kept as 10.1a).
- File written: this one.
- No source file changed. No device opened. Commands of this row: reads, searches and `date`.

## The six amendments, where they stand

| # | Amendment | Design section | Serves |
|---|---|---|---|
| 1 | Contract words: the worker's report, two audit types, the signed member, the source facts, the notices, the operator's words | 8.1, 8.2, 8.3, 8.4, 6.2 | SM-29, SM-30, SM-32, SM-34, SM-36, SM-40 |
| 2 | The account is complete; the resampler is out of the path for the gapped kind; the pins that move | 7.2a | SM-29, SM-31, SM-33, SM-35 (1) |
| 3 | The seal's refusal `AUDIO_SHORTFALL_NOT_STATED`; two verdict lines; the export manifest's member | 8.4a | SM-36, SM-37 |
| 4 | The transcript: three flag texts in the sealed document, a derived mark, two members of operation 84 | 8.6 | SM-38 |
| 5 | SR-15 final: two whole templates, three computed places, the `fifo` groups, planted controls, two provisional sentences and the one run | 4.3.1 to 4.3.3 | SR-15, SM-07, SM-08 |
| 6 | 18 work packages, their order, the worker baseline, the one contract step, the schema answer | 10.1, 10.2 | 08b s2, s14; C110 |

## The member, in short

`audio.samplesNotReceived`, optional, fields 139 to 158: one strict record per microphone that carries the source-fact key `sampleContinuity` and per capture attempt. Per record: `micDeviceId`, `attempt`, `captureLayer` (`AVFOUNDATION`), `captureGroup` (1 to 2), `account` (`CLOSED` / `NOT_CLOSED` / `NONE`), twelve numbers that are all whole numbers or all null (`timelineSamples`, `receivedSamples`, `insertedSamples`, `discardedSamples`, `bufferedSamples`, `nonFiniteSamples`, `fedSamples`, `fedInsertedSamples`, `fedRuns`, `fedLongestRunSamples`, `runsNotListed`, `runsNotListedSamples`), `openRunFromSample`, and the optional list `insertedRuns[]` of `{ fromSample, samples }` for every run of 4,800 samples (100 ms) or more, at most 1,024 per attempt; beyond that the count and the sum of the runs not listed.

The identity, checked by the worker before it writes, by the member's schema at the seal and by every verifier: `timelineSamples` = `receivedSamples` - `discardedSamples` - `bufferedSamples` + `insertedSamples`. In a closing account the buffer's rest is counted as discarded and `bufferedSamples` is 0, so expected = received + inserted - discarded, and expected is the number of samples the encoder was fed (`AUDIO_TIMELINE_END.samples`).

## Read in the worker (file:line; read, not run)

- Zeros are counted in `missing` from the first quantum of the timeline for both microphone slots (`audio.c:436-449`): the lead of a second microphone (`:439`, `:583`), a start on silence (`:570`, `:576`, `:579`) and a stopped microphone (`:423-427`) are already in it. Revision 2 lost them only by counting from each microphone's first sample.
- Uncounted today: the non-finite replacement (`:393`), the re-placement drop (`:431`), the trim before sample 0 (`:582`), and what the buffer holds at the end. Counted but told only in a log line: the full-buffer drop (`:396`, `:653`).
- The resampler is used at six lines (`:353`, `:355`, `:358`, `:366`, `:399`, `:477`); both its sides and the buffer are mono 32-bit float at 48,000 Hz (`:353`, `:103`); the close already allows a null one (`:366`). So the gapped kind makes none and copies.

## For the controller

1. **Could not be written as the addendum words it** (design R3.3): (1) SM-38 (3), the sealed transcript cannot read the SIGNED member - it is hashed into the manifest before the signature; it takes the statement from the same audit rows through the seal's function and the seal refuses a disagreement. (2) SM-38 (2), an engine segment that spans a run cannot be split: it is marked. (3) SM-30 (2), the runs cannot be a list inside one audit row - audit details are flat (`db/migrations/0001_tables.sql:198`): a second audit type, one row per run. (4) SM-37 (1), one verdict line does not fit 256 characters: two notices. (5) 08b s14, N1 cannot LAND beside wave A: `protocol-pins.test.ts:61` holds the package's number equal to `worker.h:48` and the boot refuses a mismatch (`boot/checks.ts:401`); it lands with N3 after c06. (6) SM-32 (2), the margin.
2. **The margin proposed: 1.5 points** above the attempt's reference (the median of its first six 10 s windows), twice in a row; clear at reference plus 1.0. From MM3: 60 s levels 9.476 to 9.902%, 10 s windows 8.747 to 10.613%, worst pairing 1.14 points. The addendum's 2.0 trips at 11.5 to 11.9%, next to the 12.0% floor. N15 confirms or changes it.
3. **Four telemetry members, not three**: `insertedSamples` is added so that the notices and the amount of a queue drop measure what was inserted (SM-35 (1)).
4. **Pins that move**: the protocol number `worker.h:48` / `capture-protocol/src/index.ts:148` 4 to 5 with its literal twins (listed in design 7.2a); the list of record kinds the worker writes (`protocol-pins.test.ts:76-78`) plus two; the plan's kind word (`capture_worker.c:176`). `pinned-calls.tsv` does not move. The worker's version word is not moved by this design.
5. **`packages/shared` has a writer in flight** (pass I-9b, `file_claims.md:244`; no record yet). N2 follows it. N2 is the ONE contract step of this design and now also holds the words of N17 and N18; `openapi.json` is regenerated once (operation 84 gains two optional members).
6. **Put to the controller, not written into a row** (design 8.4a): a manifest rule that would let every verifier refuse a `darwin` production package without the member; it changes row P1's fixtures.
7. **No schema change, confirmed** (design 10.2): the seal's statement on `session_capture_sources` gains the existing column `source_facts` in its column list (`sealing-host/session-reader.ts:83`); no migration, no grant.
8. **Not verified, each named with its row** (design 8.6, 10.2, 6.2, 8.4): the order in which the account rows and the transcript document come to exist (N18); whether a test pins the text of the seal's source statement (N12); whether a device shape carries the card identity for the operator's label (the web row); whether the manifest has a size bound that 1,024 runs could meet (N2).
9. **Not read in full, against the brief**: `verification/08_security_macos_microphone.md` and the records MM, MM2 were read by outline and section; MM3 by sections 0, 1, 4 to 6, 8, 9. Their numbers in the design are cited as revision 2 cited them or from the sections read. The record of pass I-9b does not exist; its item 11 was read from the working tree.

## Work packages

18 rows: S 6 (N1, N5, N8, N10, N13, N16), M 12 (N2, N3, N4, N6, N7, N9, N11, N12, N14, N15, N17, N18). One row edits `apps/capture-worker/src` (N3): it waits for suite run c06 and its commit and owes the BR-11 series and the kill matrix again. N1 edits no worker file and still lands with N3. N11 is the largest; its cut line is named if it is rated above M.

---
*Generated: 2026-10-13 19:08*
