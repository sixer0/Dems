/**
 * The one way the device selector sends operations 79 `setCaptureCameraSource` and 78
 * `updateCaptureConfig` — the microphone lines BY CHANNEL of D61 (2026-11-04): ONE line by channel
 * (`micLineBody`), or ONE edit when the microphone comes from another channel (`micMoveBody`): the SWAP
 * `{ mics: [to-line, from-line] }` when this channel holds one (audit row 188, M3-07; D126), else the MOVE
 * `{ unassign: [from], mics: [line] }` (R-FLEX row 133) - a move only after the operator's confirm (`micMoveGate`) (task 3, blueprint row 68;
 * `masterplan/03_api_contract.md` §2.2-§2.4). Both are
 * operations a tablet or phone session may call (`PERMISSION CAPTURE_CONFIG`; only 89, 95 and 96 are
 * web-console-only), and neither is a simulator action, so there are two ways in:
 *
 * | Source | Way in | Rule |
 * |---|---|---|
 * | SIMULATED, HEARTBEAT | `sim.request({ method: 'POST', path })` → `handleSimApiRequest` (`packages/shared/src/sim/api.ts`, the CAPTURE_ROUTES) | the simulator IS the Core |
 * | LIVE | `useMobileLive().client.call(operationId, input)` | rule 1 of the mobile page rows: no typed client of the page's own, no raw fetch |
 *
 * Both return one `SelectorAnswer`: the refusal class (`classifyAnswer`), the three facts it was read
 * from, and the `updatedAt` of the `CaptureConfig` a 200 carried. Nothing of an answer's text, of a
 * request body or of a credential is kept: the selector sends ids only and no operation here carries a
 * secret (op 89 is not called by this app at all).
 *
 * Never throws: a transport that throws is an `offline` answer. Pure of React.
 */
import type { Sim, MicChannel } from '@dems/shared/sim'; // D61 (2026-11-04): the four microphone channels
import type { VideoTrackId } from '@dems/shared/domain';
import type { MobileCoreClient } from '@/runtime';
import { classifyAnswer, factsOfEnvelope, micMoveAskOf, updatedAtOf, type AnswerClass, type AnswerFacts, type MicMoveAsk, type SelectorCommand } from './capture-selector-model';

export interface SelectorAnswer {
  readonly result: AnswerClass;
  readonly facts: AnswerFacts;
  /** `CaptureConfig.updatedAt` of a 200; null otherwise. */
  readonly updatedAt: number | null;
}

export interface SelectorPort {
  send(command: SelectorCommand): Promise<SelectorAnswer>;
}

const NO_ANSWER: AnswerFacts = { status: null, code: null, reason: null };
const OFFLINE: SelectorAnswer = { result: 'offline', facts: NO_ANSWER, updatedAt: null };

function answerOf(facts: AnswerFacts, body: unknown): SelectorAnswer {
  const result = classifyAnswer(facts);
  return { result, facts, updatedAt: result === 'ok' ? updatedAtOf(body) : null };
}

/** The path of the operation a command maps to (C3 §2.2). Ids are path segments, so they are encoded. */
export function selectorPath(command: SelectorCommand): string {
  // D61 (2026-11-04): every microphone edit is operation 78 by channel; the role trade of operation 80 left the selector with D61.
  if (command.kind === 'camera' && command.profile === undefined) return `/api/v1/capture/cameras/${encodeURIComponent(command.deviceId)}/source`;
  return '/api/v1/capture/config';
}

/**
 * The body of operation 78 for ONE microphone line by CHANNEL (D61 of 2026-11-04, superseding the
 * pair replacement D133 (1) and the lone line by role N16): `mics: [{ channel, inputId, deviceId }]`
 * with `deviceId == inputId` (D106 (4)). The line assigns its channel ALONE; the slots of the
 * channels it does not name keep what they hold (rule MIC-ASSIGN, decision C21 (8), generalized).
 */
export function micLineBody(command: Extract<SelectorCommand, { kind: 'micLine' }>): { mics: { channel: MicChannel; inputId: string; deviceId: string }[] } {
  return { mics: [{ channel: command.channel, inputId: command.inputId, deviceId: command.inputId }] };
}

/**
 * The body of operation 78 for ONE microphone that comes from another channel (D61; register S1/S2) - one edit,
 * so one microphone never stands on two channels:
 *
 * | The target channel | Body |
 * |---|---|
 * | holds microphone `other` | the SWAP `{ mics: [to-line, from-line] }`: `inputId` on `channel`, `other` on `from`, NO `unassign` - no pair is left without its microphone (audit row 188, M3-07 R1; D126; D22(3)). The Core writes ONE `CAPTURE_CONFIG_CHANGED` row (scope MIC, field CHANNEL; D30 K-6) |
 * | holds none | the MOVE `{ unassign: [from], mics: [line] }` (R-FLEX row 133, T-14): Pair `from` is left incomplete (S2, R156-1) |
 */
export function micMoveBody(command: Extract<SelectorCommand, { kind: 'micMove' }>): { unassign?: MicChannel[]; mics: { channel: MicChannel; inputId: string; deviceId: string }[] } {
  const line = { channel: command.channel, inputId: command.inputId, deviceId: command.inputId };
  if (command.other !== undefined) return { mics: [line, { channel: command.from, inputId: command.other, deviceId: command.other }] };
  return { unassign: [command.from], mics: [line] };
}

/**
 * The confirm step of a microphone move (audit row 188, M3-07: operation 78 is sent once after the confirm,
 * nothing on Cancel). Making the gate sends nothing; `confirm(send)` sends the command ONCE - a second confirm,
 * or a confirm after `cancel()`, sends nothing and resolves null. React-free: the selector hook holds one gate,
 * the dialog (row 189) calls `confirmMove` / `cancelMove`.
 */
export interface MicMoveGate {
  readonly command: Extract<SelectorCommand, { kind: 'micMove' }>;
  readonly ask: MicMoveAsk;
  confirm<T>(send: (command: SelectorCommand) => Promise<T>): Promise<T | null>;
  cancel(): void;
}

export function micMoveGate(command: Extract<SelectorCommand, { kind: 'micMove' }>): MicMoveGate {
  let settled = false;
  return {
    command,
    ask: micMoveAskOf(command),
    confirm<T>(send: (selected: SelectorCommand) => Promise<T>): Promise<T | null> {
      if (settled) return Promise.resolve(null);
      settled = true;
      return send(command);
    },
    cancel() {
      settled = true;
    },
  };
}

/**
 * The body of operation 78 for ONE camera with its chosen stream profile (task 4 row W5; review 060d Q-02;
 * decision C36; `camera-profile.ts`): `cameras: [{ trackId, deviceId, profile }]`. Operation 79's body is a
 * strict `{ trackId }` - it cannot name a profile, and the Core assigns a production camera only with one of
 * its own. The other track's line and the microphone lines are not named and keep what they hold.
 */
export function cameraProfileBody(command: { readonly trackId: VideoTrackId; readonly deviceId: string; readonly profile: string }): {
  cameras: { trackId: VideoTrackId; deviceId: string; profile: string }[];
} {
  return { cameras: [{ trackId: command.trackId, deviceId: command.deviceId, profile: command.profile }] };
}

function simBody(command: SelectorCommand): { body?: unknown } {
  if (command.kind === 'camera' && command.profile !== undefined) return { body: cameraProfileBody({ trackId: command.trackId, deviceId: command.deviceId, profile: command.profile }) };
  if (command.kind === 'camera') return { body: { trackId: command.trackId } };
  if (command.kind === 'micLine') return { body: micLineBody(command) };
  return { body: micMoveBody(command) }; // D61: micMove
}

/** SIMULATED and HEARTBEAT: the in-app simulator answers the request synchronously. */
export function simSelectorPort(sim: Pick<Sim, 'request'>): SelectorPort {
  return {
    send(command) {
      try {
        const response = sim.request({
          method: 'POST',
          path: selectorPath(command),
          ...simBody(command),
        });
        return Promise.resolve(answerOf(factsOfEnvelope(response.status, response.body), response.body));
      } catch {
        return Promise.resolve(OFFLINE);
      }
    },
  };
}

/** LIVE: the Core server answers through the app's one typed client. */
export function liveSelectorPort(client: Pick<MobileCoreClient, 'call'>): SelectorPort {
  return {
    async send(command) {
      try {
        const answer =
          command.kind === 'camera' && command.profile !== undefined
            ? await client.call('updateCaptureConfig', { body: cameraProfileBody({ trackId: command.trackId, deviceId: command.deviceId, profile: command.profile }) })
            : command.kind === 'camera'
            ? await client.call('setCaptureCameraSource', { params: { id: command.deviceId }, body: { trackId: command.trackId } })
            : command.kind === 'micLine'
              ? await client.call('updateCaptureConfig', { body: micLineBody(command) })
              : await client.call('updateCaptureConfig', { body: micMoveBody(command) }); // D61 (2026-11-04): micMove; the selector no longer trades roles (op 81 stays the session's toggle)
        if (answer.ok) return answerOf({ status: answer.status, code: null, reason: null }, answer.data);
        const reason = answer.error.details?.reason;
        return answerOf({ status: answer.status, code: answer.error.code, reason: typeof reason === 'string' ? reason : null }, null);
      } catch {
        return OFFLINE;
      }
    },
  };
}
