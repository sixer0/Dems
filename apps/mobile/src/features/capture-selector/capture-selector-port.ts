/**
 * The one way the device selector sends operations 79 `setCaptureCameraSource` and 80
 * `setPrimaryMic` (task 3, blueprint row 68; `masterplan/03_api_contract.md` §2.2-§2.4). Both are
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
  return command.kind === 'camera'
    ? `/api/v1/capture/cameras/${encodeURIComponent(command.deviceId)}/source`
    : `/api/v1/capture/mics/${encodeURIComponent(command.inputId)}/primary`;
}

/** SIMULATED and HEARTBEAT: the in-app simulator answers the request synchronously. */
export function simSelectorPort(sim: Pick<Sim, 'request'>): SelectorPort {
  return {
    send(command) {
      try {
        const response = sim.request({
          method: 'POST',
          path: selectorPath(command),
          ...(command.kind === 'camera' ? { body: { trackId: command.trackId } } : {}),
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
          command.kind === 'camera'
            ? await client.call('setCaptureCameraSource', { params: { id: command.deviceId }, body: { trackId: command.trackId } })
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
