/**
 * The one way the device selector sends operations 79 `setCaptureCameraSource`, 80 `setPrimaryMic`
 * and - for a microphone that is on no line yet (fix wave H, G70-02) - the pair replacement of
 * operation 78 `updateCaptureConfig`, or ONE line by role while the other slot is empty (task 4 row 32,
 * `micRoleBody`) (task 3, blueprint row 68; `masterplan/03_api_contract.md` §2.2-§2.4). Both are
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
import type { Sim } from '@dems/shared/sim';
import type { VideoTrackId } from '@dems/shared/domain';
import type { MobileCoreClient } from '@/runtime';
import { classifyAnswer, factsOfEnvelope, updatedAtOf, type AnswerClass, type AnswerFacts, type SelectorCommand } from './capture-selector-model';

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
  if (command.kind === 'micPair' || command.kind === 'micRole') return '/api/v1/capture/config';
  // Row W5 (Q-02): a camera with a chosen stream profile is a camera line of operation 78.
  if (command.kind === 'camera' && command.profile !== undefined) return '/api/v1/capture/config';
  return command.kind === 'camera'
    ? `/api/v1/capture/cameras/${encodeURIComponent(command.deviceId)}/source`
    : `/api/v1/capture/mics/${encodeURIComponent(command.inputId)}/primary`;
}

/**
 * The body of operation 78 for a pair replacement (C3 §2.3, D133 (1); fix wave H, G70-02): two lines,
 * each with its role, each `deviceId == inputId` (D106 (4)). No transport is sent: the Core takes it
 * from its registry row.
 */
export function micPairBody(command: Extract<SelectorCommand, { kind: 'micPair' }>): { mics: { inputId: string; deviceId: string; role: 'PRIMARY' | 'STANDBY' }[] } {
  return {
    mics: [
      { inputId: command.primaryId, deviceId: command.primaryId, role: 'PRIMARY' },
      { inputId: command.standbyId, deviceId: command.standbyId, role: 'STANDBY' },
    ],
  };
}

/**
 * The body of operation 78 for ONE microphone line by role (task 4 row 32; names register N16; rule
 * MIC-ASSIGN, decision C21 (8)): the input is put on the slot of its role, `deviceId == inputId`
 * (D106 (4)); the slot of the other role is not named and keeps what it holds. Sent only while that
 * other slot is empty (`micLineCommand`).
 */
export function micRoleBody(command: Extract<SelectorCommand, { kind: 'micRole' }>): { mics: { inputId: string; deviceId: string; role: 'PRIMARY' | 'STANDBY' }[] } {
  return { mics: [{ inputId: command.inputId, deviceId: command.inputId, role: command.role }] };
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
  if (command.kind === 'micRole') return { body: micRoleBody(command) };
  return command.kind === 'micPair' ? { body: micPairBody(command) } : {};
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
            : command.kind === 'micPair'
              ? await client.call('updateCaptureConfig', { body: micPairBody(command) })
              : command.kind === 'micRole'
                ? await client.call('updateCaptureConfig', { body: micRoleBody(command) })
                : await client.call('setPrimaryMic', { params: { id: command.inputId } });
        if (answer.ok) return answerOf({ status: answer.status, code: null, reason: null }, answer.data);
        const reason = answer.error.details?.reason;
        return answerOf({ status: answer.status, code: answer.error.code, reason: typeof reason === 'string' ? reason : null }, null);
      } catch {
        return OFFLINE;
      }
    },
  };
}
