# Contract note, fix wave I (driver A1) - a seal that is retried or blocked

For drivers B (core-web) and C (mobile). Written 2026-10-10 by driver A1.
Status (20:45 WIB): FINAL - every line marked "(server, in work)" below has LANDED and is tested
(`implementation/131_fix_wave_i_a1.md`). One change after the first version of this file: the
example sentences of `seal-blocked.ts` are now the Core's exact words for the cause
`SESSION_KEY_STORE_UNAVAILABLE` (held equal by a server test); the detail value `SESSION_NOT_HELD`
was removed from the list before any consumer used it. Shapes did not change. The web test
`wave-i-b-seal-blocked.test.tsx` (12) and the three mobile `wave-i-c-seal-blocked*` files (18)
were run once against the final file: green.

## 1. No contract member is added

Totals stay 97 operations / 67 audit types. No OpenAPI run. Everything a surface needs is in
members the state already carries (`alerts[]`, `session.finalization.steps[]`), and one new
shared reader gives it in one call.

## 2. Import this (packages/shared/src/sim/seal-blocked.ts, exported from `@dems/shared/sim`)

| Name | What |
|---|---|
| `sealAttentionOf({ session, alerts })` | THE ONE READING for the Finalizing screen and the seal dialog. `null` = nothing to say beyond the progress. Else `{ kind: 'RETRYING' \| 'BLOCKED', ... }` |
| `sealBlockedNoticeOf(state, sessionId?)` | the active blocked-seal alert of a session (or the newest one), or `null`. For Home / Dashboard / header |
| `SEAL_BLOCKED_REASON` | `'SEAL_BLOCKED'` = `alert.params.reason` |
| `SEAL_BLOCKED_DETAILS`, `SealBlockedDetail`, `SEAL_BLOCKED_DETAIL_SENTENCE` | the closed list of detail codes and one fixed English sentence per code |
| `SEAL_RECORDING_KEPT_SENTENCE` | `'The recording is kept on the Core.'` |
| `SEAL_BLOCKED_EXAMPLE_ALERT`, `SEAL_BLOCKED_EXAMPLE_FINALIZATION`, `SEAL_RETRYING_EXAMPLE_FINALIZATION`, `SEAL_BLOCKED_EXAMPLE_SESSION_ID` | examples for YOUR tests; they pass `AlertsSliceSchema` / `ActiveSessionSchema.shape.finalization` (held by `packages/shared/test/sim-wave-i-a1-seal-blocked.test.ts`) |

`SealAttention`:

```ts
| { kind: 'RETRYING'; sessionId; step; attempt; sentence: string | null; recordingKept: true }
| { kind: 'BLOCKED';  sessionId; cause; step: string | null; detail: SealBlockedDetail | null;
    sentence: string; message: string; attempt; recordingKept: true }
```

## 3. The underlying members (exact names and values)

### 3.1 RETRYING - the Core runs the seal again by itself (no alert yet)

`session.state: 'FINALIZING'`; one entry of `session.finalization.steps[]` has

| Member | Value |
|---|---|
| `status` | `'error'` |
| `detail` | the Core's sentence, e.g. `Sealing is being retried (retry 2 of 3, in 30 s). The session key could not be used: the seal stopped and can be tried again.` |
| `attempt` | the run that failed, >= 1 |

Retries per process: 3, after 5 s, 30 s, 120 s. A retry that starts sets the step back to `'active'`.

### 3.2 BLOCKED - the retries are used up, the cause may heal

`session.state` stays `'FINALIZING'`; the failed step keeps `status: 'error'` and its `detail`
ends with `Sealing will be tried again when the Core starts, or by the recovery action.` And ONE
entry of `alerts[]`:

```json
{
  "id": "ALR-000005", "severity": "CRITICAL", "kind": "SYSTEM", "active": true,
  "target": "SES-20261010-0025",
  "message": "Sealing of this session is blocked. <cause in words> <what restores it> The Core records no new session until this one is sealed.",
  "params": { "reason": "SEAL_BLOCKED", "cause": "SEALER_FAILED", "step": "CLOSE_TRACKS",
              "sessionId": "SES-20261010-0025", "detail": "SESSION_KEY_STORE_UNAVAILABLE" }
}
```

- `params.cause`: a sealing failure code - `SEALER_FAILED`, `FRAGMENT_NOT_OPENABLE`, `SIGNER_FAILED`,
  `STORAGE_FAILED`, `JOURNAL_FAILED`, `ENGINE_REFUSED`, `TRANSCRIPT_STEP_FAILED`.
- `params.detail` (landed; a KEY of the open `params` map, optional): one of
  `SEAL_BLOCKED_DETAILS` - `SESSION_KEY_NOT_OF_SESSION`, `SESSION_KEY_STORE_UNAVAILABLE`,
  `SESSION_KEY_UNSAFE`, `SESSION_KEY_WRITE_FAILED`, `SESSION_KEY_NOT_FOUND`,
  `SESSION_CIPHER_REFUSED`. Absent for causes that have none. A value outside
  the list reads as `null` in `sealBlockedNoticeOf`.
- The alert is resolved (`active: false`) when the seal completes or the session is ended.

### 3.3 What the surfaces must show (G75b-02)

| Kind | Headline | Reason | Kept | Leave |
|---|---|---|---|---|
| `RETRYING` | sealing is being retried | `attention.sentence` (the Core's own words; already holds "retry n of N, in s s") | `SEAL_RECORDING_KEPT_SENTENCE` | the screen / dialog can be left |
| `BLOCKED` | sealing is blocked | `attention.sentence`, and `attention.message` for the full text with what restores it; `SEAL_BLOCKED_DETAIL_SENTENCE[attention.detail]` when `detail` is not null | `SEAL_RECORDING_KEPT_SENTENCE` | the screen / dialog MUST be leavable (Back / Escape / a button). While blocked do NOT say "takes a few seconds" or "this screen closes by itself" |

"The recording is kept" is true by construction on the server: a failed seal deletes nothing; the
camera files stay in the session folder until a seal completes; a session the Core gives up on is
ended UNSEALABLE with its files MOVED to the quarantine folder (existing `unsealableNoticeOf`,
`common.sealUnsealable`).

The way out for the operator that exists on the server: operation `recoverSession` on the open
session (FINALIZING with a failed step) runs the seal again on demand (audited `RECOVERY_STARTED`,
`details.reason: SEAL_RETRY`). Offer it only where your surface already offers recovery.

### 3.4 The terminal end (unchanged shape, one new cause value)

A cause no retry gets past ends the session after its third attempt: `session` becomes `null`,
`sessionHistory[0].outcome: 'INCOMPLETE'`, one alert `params: { reason: 'UNSEALABLE', cause,
sessionId }` (read with the existing `unsealableNoticeOf`). NEW in this wave (landed):
`cause` can be `SESSION_KEY_NOT_OF_SESSION` (it used to be reported as a blocked `SEALER_FAILED`
for ever - that was G75b-01). Your Finalizing screen then leaves as it does for every UNSEALABLE.

## 4. "Resumed after restart" - NOT truthful from `attempt`

`step.attempt` grows with EVERY run of the seal: the automatic retry inside the same process as
much as a run after a restart. At re-gate 75 the text appeared with no restart because the note was
derived from `attempt > 1` (web `finalization-modal.tsx`, mobile Finalizing; and, on the server,
`resumed` of operation 83 was computed the same way - that was wrong and is fixed, below).

Rules for the clients:

1. Do NOT derive "Resumed after restart" from `attempt`. From `attempt > 1` a surface may say only
   that the seal was run again (for example "Attempt 3"); with `sealAttentionOf` the Core's own
   sentence already says "retry n of N".
2. The truthful fact is `resumed` of operation 83 `getSealingProgress` (`GET
   /api/v1/session/{id}/sealing`). Server fix of this wave (landed): on a Core in real capture it
   is `true` only when THIS run of the seal was started by a start of the Core (the boot resume) or
   by the recovery action (`recoverSession`), and `false` for a first run and for the automatic
   retries. In Simulated mode it stays what the simulator answers (there the attempt only grows on
   a RECOVERY). A surface that wants the sentence reads it from operation 83; a surface that does
   not poll operation 83 does not show it.

## 5. A start that is refused BEFORE recording (new `details.reason`, existing status and code)

`startSession` on a Core in real capture can now answer, as it does for `CAPTURE_HELPERS_LEFT`:

```json
{ "status": 503, "code": "NOT_READY",
  "message": "This session cannot be started: a session key of an earlier session with this session number is in the Core's key store, so its recording could not be sealed. Nothing was recorded. Cancel this session and create a new one.",
  "details": { "reason": "SESSION_KEY_NOT_OF_SESSION" } }
```

Other value of `details.reason` on the same answer: `SESSION_KEY_STORE_UNAVAILABLE` (the key store
cannot be used; message says so). Nothing was started; the session stays ARMED and can be
cancelled. Show the message as you show the other refused starts; no new screen is needed.

## 6. What did NOT change

Operation 83 body shape; `finalization.steps[]` members; alert shape; i18n keys (none added by
A1 - the fixed sentences are constants of `seal-blocked.ts`; add your own keys in your own
append-only blocks if a surface needs other words).
