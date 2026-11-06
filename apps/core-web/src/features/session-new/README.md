# src/features/session-new

Up: [src/features](../README.md)

## Purpose

The Start New Session flow, three steps in the URL (`?step=1|2|3`, deep-linkable and back-button friendly):

1. Session Info: a form validated by the shared `sessionCreateSchema`; "Next" creates the session (`createSession`) and starts the pre-check (`beginPrecheck`). A changed form on an existing setup session cancels it and creates a new one; the same form reuses it. The case number scanner reserves the next case number.
2. Devices Check: the pre-check gate (twelve checks, cameras 1 to 4 and mic channels 1 to 4). PASS arms the session; WARN needs "Acknowledge warnings" (`acknowledgePrecheckWarnings`); BLOCK disables Next and offers "Re-run checks" (`retryPrecheck`). Camera previews per pair use the reach-gated live preview, closed while the tab is hidden.
3. Ready: summary, mini glow ring, optional 3-2-1 countdown, "Start Recording" (`startRecording`, gated on the SESSION_START permission), then `/session`.

The URL never shows a step the session does not allow (`model.effectiveStep`); a session that is already recording or later belongs to the Session Monitor. Roles without SESSION_START are sent to the Dashboard by the route.

## Files

| File | Role |
|---|---|
| [`__tests__/`](__tests__/) | Unit and page tests of this folder, plus a Live test bed |
| [`cancel-dialog.tsx`](cancel-dialog.tsx) | `CancelDialog`: confirm cancelling the setup session; in Live mode it stays open with a pending button until the Core answers |
| [`devices-step.tsx`](devices-step.tsx) | `DevicesStep`: step 2, the pre-check list, camera and mic pair rows with previews and meters, Core alerts as notices |
| [`error-boundary.tsx`](error-boundary.tsx) | `FlowErrorBoundary`: per-step error boundary that names the failed step in the log record |
| [`index.tsx`](index.tsx) | `SessionNewPage`: page root (`page-session-new`), step routing, the Core actions of the flow and their pending states |
| [`info-step.tsx`](info-step.tsx) | `InfoStep`: step 1, the session form (React Hook Form) and the case number scan |
| [`log.ts`](log.ts) | `logSessionNew`, `newFlowCorrelationId`, `errorFacts`: structured records to the page's own log `webErrorSink` |
| [`model.ts`](model.ts) | Pure model: steps (`maxStepFor`, `effectiveStep`, `isSetupState`, `isLiveElsewhere`), the gate view (`gateView`), refusal reason keys, countdown and create-beat constants |
| [`ready-step.tsx`](ready-step.tsx) | `ReadyStep`: step 3, summary, acknowledged warnings, countdown and Start Recording |
| [`session-new.css`](session-new.css) | Page styles, every selector starts with `.sn-` |
| [`sim-adapter.ts`](sim-adapter.ts) | `scanCaseNumber`: reserves the next case number through the data source (operation 32 in Live mode) |
| [`use-pending-control.ts`](use-pending-control.ts) | Re-export kept for older tests; the pending-control hook lives in `src/lib/pending-control` |

## Main exports

- Screen: `SessionNewPage` (`index.tsx`), with `InfoStep`, `DevicesStep`, `ReadyStep`, `CancelDialog`, `FlowErrorBoundary`.
- Model: `model.ts` (pure, shared by the page and the tests).
- Reader: `scanCaseNumber` (`sim-adapter.ts`).

Routes: `/session/new` (route file `src/routes/_app/session/new.tsx`).

## Core operations, state and shared modules

- Actions of `useCoreActions()`: `createSession`, `beginPrecheck`, `retryPrecheck`, `acknowledgePrecheckWarnings`, `startRecording`, `cancel`, `scanCaseNumber` (operation 32 reserves the case number).
- Camera previews: the reach-gated live preview of [`src/features/devices`](../devices/) (operation 112).
- State slices read with `useSim`: `session`, `operators`, `alerts`, `cameras`, `captureDevices`.
- Shared modules: `@dems/shared/api` (`sessionCreateSchema`, typed errors), `@dems/shared/domain`, `@dems/shared/live`, `@dems/shared/sim`, `@dems/shared/tokens`.
- Console folders used: [`src/components/composed`](../../components/composed/), [`src/components/shell`](../../components/shell/), [`src/components/ui`](../../components/ui/), [`src/features/devices`](../devices/), [`src/lib`](../../lib/) (`capture-notices`, `core-errors`, `effect-start`, `event-words`, `own-capture`, `pending-control`, `utils`), [`src/motion`](../../motion/), [`src/runtime`](../../runtime/).

## Tests

- [`__tests__/`](__tests__/): `countdown-sources.test.tsx`, `devices-step-pairs.test.tsx`, `live-previews.test.tsx`, `live-words.test.tsx`, `precheck-unreachable.test.tsx`, `session-new-model.test.tsx`, `session-new.test.tsx`, and the shared bed `live-session-new-bed.ts`.
- In `src/test`: [`live-session-new-create.test.tsx`](../../test/live-session-new-create.test.tsx), [`live-session-new-precheck.test.tsx`](../../test/live-session-new-precheck.test.tsx), [`live-session-new-pending.test.tsx`](../../test/live-session-new-pending.test.tsx), [`live-session-new-local-notice.test.tsx`](../../test/live-session-new-local-notice.test.tsx), [`live-local-source-on.test.tsx`](../../test/live-local-source-on.test.tsx), [`live-strict-mode-starts.test.tsx`](../../test/live-strict-mode-starts.test.tsx), [`selector-in-force.test.tsx`](../../test/selector-in-force.test.tsx), [`real-core-facts.test.tsx`](../../test/real-core-facts.test.tsx).

## Related decisions

- D53: twelve-item pre-check (cameras 1 to 4, mic channels 1 to 4); the web session-new model and devices-step edits of row 83.
- D98: Session New step 2 previews wrapped in the reach-gated camera preview.
- D125: row 156 pair wording "Mic N (Camera N)"; the session-new step-2 labels were routed to row 158.
- D130: live readiness "Not checked" and the channel-1 last-check sentence (row 150).
- D241: step-2 preview tiles close while the tab is hidden and reopen when visible (W4-8).
