/**
 * THE ALIAS PORT OF A JOB, over the lifecycle (task 4 row 106b; decisions C74, C78 DD-2 and DD-3).
 *
 * The commissioning scan (row 107) declared a port in the shape of row 105's caller: `helper`,
 * `add({ address, minutes, subject })`, `remove({ address, subject })`, each answering
 * `{ refusal, effect }`. The lifecycle (row 106) offers `acquire` / `release` / `state`. This file
 * is the adapter between the two, and the set-IP job (row 111) is handed the same object.
 *
 * THE ONE BEHAVIOUR AFTER AN `add` THAT DID NOT END "DONE" (decision C78 DD-2):
 *
 *   what happened                                   who asks the removal            `effect` here
 *   nothing was sent (refused before the helper)    nobody: nothing was added       NOT_DONE
 *   the helper DEFINITELY refused (a code that      nobody: nothing was added       NOT_DONE
 *   says nothing was added)
 *   another alias is open (`ALIAS_ALREADY_OPEN`)    nobody: it is another           NOT_DONE
 *                                                   operation's, never this job's
 *   the effect is UNKNOWN (no answer within the     THE LIFECYCLE, at once, with    NOT_DONE when that removal is
 *   bound, a broken connection, an answer not of    its own intent and result       on record as done;
 *   the table, a result that was not recorded)      entry                           UNKNOWN when it failed too
 *
 * So `effect: NOT_DONE` always means "nothing of this job is on the camera port and nothing is
 * left to take away", and a job asks NO removal after it. `effect: UNKNOWN` means "possibly in
 * place": the job asks `remove`, which goes to the helper again and is recorded again.
 *
 * `remove` NAMES AN ADDRESS; `release` of the lifecycle takes away THE alias in place. This file
 * holds the two together: a removal is asked only when the alias in place IS the address named.
 * None in place: nothing is asked, nothing is written, and the answer is "done" (it is gone).
 * Another address in place: nothing is asked - it is not this job's to take away.
 *
 * It imports its own folder only, starts nothing, logs nothing and keeps no state.
 */
import type { HostAliasTransport } from './caller';
import type { HostAliasActor } from './journal';
import { HostAliasLifecycleRefusal, type HostAliasLifecycle, type HostAliasRecord } from './lifecycle';
import { HostAliasRemoveReason, type HostAliasReason } from './store';

/** Who asks, through which operation, and what for: the scan's subject (row 107), and the set-IP job's (row 111). */
export interface HostAliasJobSubject {
  readonly operatorId: string;
  readonly deviceId: string | null;
  readonly reason: HostAliasReason;
  readonly operationId: string;
  readonly permission: string;
}

/** The two members a job decides on. Only `DONE` with no refusal is a confirmation. */
export interface HostAliasJobOutcome {
  /** null: done as asked. Else a CODE of the lifecycle, the journal, row 105's caller, or of this file. */
  readonly refusal: string | null;
  readonly effect: 'DONE' | 'NOT_DONE' | 'UNKNOWN';
}

export interface HostAliasJobPort {
  /** Whether the helper can be asked at all: the transport's check before dialling. Dials nothing. null: yes. */
  helper(): Promise<string | null>;
  add(request: { readonly address: string; readonly minutes: number; readonly subject: HostAliasJobSubject }): Promise<HostAliasJobOutcome>;
  remove(request: { readonly address: string; readonly subject: HostAliasJobSubject }): Promise<HostAliasJobOutcome>;
  /** The alias in place as the lifecycle states it, or null: a plain read (the member `alias` of operation 103, decision C78 DD-3). */
  state(): Promise<HostAliasRecord | null>;
}

/** The refusals of this file. */
export const HostAliasJobRefusal = {
  /** The alias in place is not the address the job named: it is not this job's to take away. */
  NOT_THIS_ADDRESS: 'ALIAS_IN_PLACE_IS_NOT_THIS_ADDRESS',
  /** The state could not be read: nothing was asked of the helper. */
  STATE_UNREADABLE: HostAliasLifecycleRefusal.STATE_UNREADABLE,
} as const;

const outcome = (refusal: string | null, effect: HostAliasJobOutcome['effect']): HostAliasJobOutcome => Object.freeze({ refusal, effect });
const actorOf = (subject: HostAliasJobSubject): HostAliasActor => ({ operatorId: subject.operatorId, deviceId: subject.deviceId, operationId: subject.operationId, permission: subject.permission });

/** The port of a job over ONE lifecycle and the SAME transport that lifecycle was given. Neither `add` nor `remove` rejects. */
export function hostAliasJobPortOf(lifecycle: Pick<HostAliasLifecycle, 'acquire' | 'release' | 'state'>, transport: Pick<HostAliasTransport, 'preflight'>): HostAliasJobPort {
  const port: HostAliasJobPort = {
    helper: async () => transport.preflight(),

    async add(request) {
      const got = await lifecycle.acquire({ address: request.address, minutes: request.minutes, reason: request.subject.reason, actor: actorOf(request.subject) });
      if (got.ok) return outcome(null, 'DONE');
      // Another operation's alias stands (`stillInPlace` is true for it too): nothing of THIS job was added.
      if (got.refusal === HostAliasLifecycleRefusal.ALIAS_ALREADY_OPEN) return outcome(got.refusal, 'NOT_DONE');
      // `stillInPlace`: the effect was not known AND the lifecycle's own removal failed too - possibly in place.
      return outcome(got.refusal, got.stillInPlace ? 'UNKNOWN' : 'NOT_DONE');
    },

    async remove(request) {
      let inPlace: HostAliasRecord | null;
      try {
        inPlace = await lifecycle.state();
      } catch {
        return outcome(HostAliasJobRefusal.STATE_UNREADABLE, 'UNKNOWN');
      }
      if (inPlace === null) return outcome(null, 'DONE');
      if (inPlace.address !== request.address) return outcome(HostAliasJobRefusal.NOT_THIS_ADDRESS, 'NOT_DONE');
      const released = await lifecycle.release({ removeReason: HostAliasRemoveReason.JOB_DONE, actor: actorOf(request.subject) });
      return released.ok ? outcome(null, 'DONE') : outcome(released.refusal, 'UNKNOWN');
    },

    state: () => lifecycle.state(),
  };
  return Object.freeze(port);
}
