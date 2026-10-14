/**
 * THE JOURNAL of the address helper's caller (task 4 row 106, WP-19b; security item S13-10 (c);
 * decisions C53 (4d), C67): the stored row and the audit entries around each call.
 *
 * PER ACTION THAT REACHES THE HELPER: exactly ONE intent entry, committed BEFORE the line is sent,
 * and exactly ONE result entry after. A Core that dies between the two leaves the intent - and,
 * for an `add`, an OPEN ROW, which the next boot sweeps.
 *
 *   action  intent (one unit of work, committed first)        result (one unit of work)
 *   ADD     the row is OPENED; HOST_ALIAS_REQUESTED            DONE: the end of the lifetime is dated; HOST_ALIAS_ADDED
 *           { action ADD, address, reason, minutes, aliasId }  NOT_DONE: HOST_ALIAS_ADD_FAILED; the row is closed (nothing was added)
 *                                                               UNKNOWN: HOST_ALIAS_ADD_FAILED; the row STAYS OPEN (possibly in place)
 *   REMOVE  HOST_ALIAS_REQUESTED                               helper `OK`: the row is closed; HOST_ALIAS_REMOVED
 *           { action REMOVE, address, removeReason, aliasId? }  helper `NOT_MARKED`: NOT CONFIRMED (below) - the row is closed;
 *                                                                 HOST_ALIAS_REMOVE_FAILED { failureReason HELPER_NOT_MARKED }
 *                                                               else: the CODE on the row, which stays open; HOST_ALIAS_REMOVE_FAILED
 *
 * `NOT_MARKED` IS NOT "REMOVED" (caution R119c-01 of statement 119c; decisions C114 F-1, C122).
 * The helper answers it to a `del` when it holds no standing mark of the address - and since its
 * row H5 also while some interface of the host may still hold the address. It took nothing away
 * and cannot say the address is gone. So the result entry is HOST_ALIAS_REMOVE_FAILED with the
 * Core's name of the helper's code, never HOST_ALIAS_REMOVED; its words do not say "removed", and
 * its severity follows the Core's OWN interface table (`heldByHost`, handed in): WARNING when
 * the table still shows the address or cannot be read, INFO when it does not show it.
 * THE ROW IS CLOSED all the same, with the reason the removal was asked with: the Core has nothing
 * more it can ask (a second `del` gets the same answer), no retry is armed and the next `add` is
 * not held back; the kernel lifetime the helper set ends the address at the latest. A removal
 * WITHOUT a row follows the same rule (it always did: there is no row to close).
 *
 * THE INTENT OF AN `add` REFUSES, and then nothing is sent (the caller answers
 * `INTENT_NOT_RECORDED`; `takeRefusal()` names why): a session is open in the state the unit sees
 * (`SESSION_OPEN`), or another row is open (`ALIAS_ALREADY_OPEN`, the table's own index).
 *
 * A REMOVAL WITHOUT A ROW (the boot sweep of an address the Core has no record of) writes its
 * intent; its result names no row. SINCE CONTRACT STEP V4 (decision C74) the vocabulary admits
 * that: `aliasId` is OPTIONAL on HOST_ALIAS_REMOVED and HOST_ALIAS_REMOVE_FAILED
 * (`core/audit-details.ts`). Whenever the audit writer refuses a result entry, this file lets the
 * refusal through and the caller flags `resultRecorded: false`: the intent stands alone and is
 * reported.
 *
 * WHAT AN ENTRY HOLDS: the row's id, ONE IPv4 literal, closed codes, the minutes. No interface
 * name, no text of the helper, no path. This file logs nothing; it imports the vocabulary, types
 * and its own folder. The database and the audit chain are HANDED IN (`HostAliasHost`).
 */
import { AuditType, Severity } from '@dems/shared/sim';
import type { HostAliasIntent, HostAliasJournal, HostAliasResult } from './caller';
import { HostAliasAction } from './protocol';
import { HostAliasRemoveReason, type HostAliasQueryable, type HostAliasReason, type HostAliasStore } from './store';

// ── What the composition hands in ──────────────────────────────────────────────────────────────

/** One audit entry as the Core's writer takes it (`AuditEntry` of the core unit, by structure). */
export interface HostAliasAuditEntry {
  readonly type: AuditType;
  readonly message: string;
  readonly severity?: Severity;
  readonly actorId: string | null;
  readonly deviceId: string | null;
  readonly details: Readonly<Record<string, string | number | boolean>>;
}

/** One unit of work: everything written through it commits together or not at all. */
export interface HostAliasUnit {
  readonly db: HostAliasQueryable;
  /** True when a session is open in the state this unit sees. */
  sessionOpen(): boolean;
  audit(entry: HostAliasAuditEntry): Promise<void>;
}

/** The Core as this folder needs it. Made by the composition, outside the capture area. */
export interface HostAliasHost {
  /** The server clock. */
  now(): number;
  sessionOpen(): boolean;
  /** A read on the pool, outside a unit. */
  read<Value>(label: string, work: (db: HostAliasQueryable) => Promise<Value>): Promise<Value>;
  /** One unit of work. Resolves AFTER its commit; rejects with what `work` threw, nothing written. */
  unit<Value>(label: string, work: (unit: HostAliasUnit) => Promise<Value>): Promise<Value>;
  /**
   * A fact for the log AND the persistent error log: a CODE of this folder and counts or codes
   * beside it. Never an address, an interface name or a text of the helper.
   */
  report(code: string, facts: Readonly<Record<string, string | number | boolean | null>>): void;
}

// ── The subject of an action ───────────────────────────────────────────────────────────────────

/** Who asked, through which operation. */
export interface HostAliasActor {
  readonly operatorId: string;
  readonly deviceId: string | null;
  readonly operationId: string;
  readonly permission: string;
}

export type HostAliasSubject =
  | { readonly action: 'ADD'; readonly reason: HostAliasReason; readonly actor: HostAliasActor }
  | {
      readonly action: 'REMOVE';
      readonly removeReason: HostAliasRemoveReason;
      /** The open row this removal is for; null for an address the Core has no row of. */
      readonly aliasId: string | null;
      /** null: the system (the end of the lifetime, the shutdown, the boot sweep). */
      readonly actor: HostAliasActor | null;
      /** True for a removal the technician asked for: refused while a session is open. */
      readonly idleOnly: boolean;
    };

export interface HostAliasToken {
  readonly aliasId: string | null;
}

/** Why an intent was not written although the database answered. */
export const HostAliasJournalRefusal = {
  // Row 106b: a code of its own, not the text of a credential reveal reason (rule R-5 of the capture-config module).
  SESSION_OPEN: 'SESSION_IS_OPEN',
  ALIAS_ALREADY_OPEN: 'ALIAS_ALREADY_OPEN',
  /** No stored camera interface is known for the row: a defect of the composition. */
  INTERFACE_NOT_KNOWN: 'INTERFACE_NOT_KNOWN',
  /** The subject handed in is not of the action: a defect of the lifecycle. */
  SUBJECT_NOT_OF_ACTION: 'SUBJECT_NOT_OF_ACTION',
} as const;
export type HostAliasJournalRefusal = (typeof HostAliasJournalRefusal)[keyof typeof HostAliasJournalRefusal];

class JournalRefused extends Error {
  readonly refusal: HostAliasJournalRefusal;
  constructor(refusal: HostAliasJournalRefusal) {
    super(`the intent of a alias address was not written: ${refusal}`);
    this.name = 'HostAliasJournalRefused';
    this.refusal = refusal;
  }
}

export interface HostAliasJournalDeps {
  readonly host: HostAliasHost;
  readonly store: HostAliasStore;
  /** The stored camera interface the facts of THIS `add` were read with, or null. Written to the row only. */
  readonly interfaceName: () => string | null;
  /**
   * The Core's OWN reading of the host's interface table, asked ONLY after the helper answered
   * `NOT_MARKED` to a removal: true when the host still holds `address` (a dotted quad), false
   * when the table does not show it, null when the table cannot be read. It sets the severity and
   * the words of that result entry and nothing else. Left out: null (not known). May throw.
   */
  readonly heldByHost?: (address: string) => boolean | null;
}

export interface HostAliasJournalOfLifecycle extends HostAliasJournal<HostAliasSubject, HostAliasToken> {
  /** Why the last intent was refused, once: null when it was written or failed for another reason. */
  takeRefusal(): HostAliasJournalRefusal | null;
}

export const HOST_ALIAS_INTENT_LABEL = 'hostAlias.intent';
export const HOST_ALIAS_RESULT_LABEL = 'hostAlias.result';

/**
 * How the row of an `add` that certainly added nothing is closed: `NOT_ADDED`, the table's own
 * word since schema version 12 (decision C74 D-3; until then `JOB_DONE`, which said a job was
 * done when the add never happened). The audit entry HOST_ALIAS_ADD_FAILED beside it says why.
 */
export const NEVER_ADDED_CLOSES_AS: HostAliasRemoveReason = HostAliasRemoveReason.NOT_ADDED;

/** The helper's answer to a `del` of an address it holds no standing mark of: it removed nothing and does not say the address is gone. */
const NOT_MARKED = 'HELPER_NOT_MARKED';
/** The words of the result entry of a removal the helper answered `NOT_MARKED`, by what the Core's own table shows. None says "removed". */
export const HOST_ALIAS_NOT_CONFIRMED_MESSAGES = Object.freeze({
  HELD: 'Alias address not removed: the helper holds no mark of it and the host still holds the address; its kernel lifetime ends it at the latest',
  NOT_KNOWN: 'Removal of the alias address not confirmed: the helper holds no mark of it; if the address is in place, its kernel lifetime ends it at the latest',
  NOT_SHOWN: 'Removal of the alias address not confirmed by the helper: it holds no mark of it; the host table of the Core does not show the address',
});
const CODE = /^[A-Z][A-Z0-9_]{0,63}$/;
const MINUTE_MS = 60_000;

const literalOf = (address: string): string => (address.endsWith('/24') ? address.slice(0, -3) : address);
const codeOf = (refusal: string | null): string => (refusal !== null && CODE.test(refusal) ? refusal : 'UNNAMED_FAILURE');
const who = (actor: HostAliasActor | null): { readonly operationId?: string; readonly permission?: string } => (actor === null ? {} : { operationId: actor.operationId, permission: actor.permission });

export function createHostAliasJournal(deps: HostAliasJournalDeps): HostAliasJournalOfLifecycle {
  const { host, store } = deps;
  let refused: HostAliasJournalRefusal | null = null;

  async function intent(entry: HostAliasIntent<HostAliasSubject>): Promise<HostAliasToken> {
    refused = null;
    const { subject } = entry;
    const address = literalOf(entry.address);
    try {
      return await host.unit(HOST_ALIAS_INTENT_LABEL, async (unit) => {
        if (entry.action === HostAliasAction.ADD) {
          if (subject.action !== 'ADD' || entry.minutes === null) throw new JournalRefused(HostAliasJournalRefusal.SUBJECT_NOT_OF_ACTION);
          // The state THIS unit sees: a session that opened since the lifecycle looked is seen here.
          if (unit.sessionOpen()) throw new JournalRefused(HostAliasJournalRefusal.SESSION_OPEN);
          const interfaceName = deps.interfaceName();
          if (interfaceName === null) throw new JournalRefused(HostAliasJournalRefusal.INTERFACE_NOT_KNOWN);
          const now = host.now();
          const aliasId = await store.open(unit.db, { interfaceName, address: entry.address, reason: subject.reason, operatorId: subject.actor.operatorId, now, expiresAt: now + entry.minutes * MINUTE_MS });
          if (aliasId === null) throw new JournalRefused(HostAliasJournalRefusal.ALIAS_ALREADY_OPEN);
          await unit.audit({
            type: AuditType.HOST_ALIAS_REQUESTED,
            message: 'Alias address requested',
            actorId: subject.actor.operatorId,
            deviceId: subject.actor.deviceId,
            details: { action: 'ADD', address, reason: subject.reason, minutes: entry.minutes, aliasId, ...who(subject.actor) },
          });
          return Object.freeze({ aliasId });
        }
        if (subject.action !== 'REMOVE') throw new JournalRefused(HostAliasJournalRefusal.SUBJECT_NOT_OF_ACTION);
        if (subject.idleOnly && unit.sessionOpen()) throw new JournalRefused(HostAliasJournalRefusal.SESSION_OPEN);
        await unit.audit({
          type: AuditType.HOST_ALIAS_REQUESTED,
          message: 'Removal of the alias address requested',
          actorId: subject.actor?.operatorId ?? null,
          deviceId: subject.actor?.deviceId ?? null,
          details: { action: 'REMOVE', address, removeReason: subject.removeReason, ...(subject.aliasId === null ? {} : { aliasId: subject.aliasId }), ...who(subject.actor) },
        });
        return Object.freeze({ aliasId: subject.aliasId });
      });
    } catch (error) {
      if (error instanceof JournalRefused) refused = error.refusal;
      throw error;
    }
  }

  async function result(entry: HostAliasResult<HostAliasSubject, HostAliasToken>): Promise<void> {
    const { subject, outcome, token } = entry;
    const address = literalOf(entry.address);
    await host.unit(HOST_ALIAS_RESULT_LABEL, async (unit) => {
      const now = host.now();
      if (subject.action === 'ADD') {
        const aliasId = token.aliasId;
        if (aliasId === null) throw new JournalRefused(HostAliasJournalRefusal.SUBJECT_NOT_OF_ACTION);
        const actor = { actorId: subject.actor.operatorId, deviceId: subject.actor.deviceId };
        if (outcome.effect === 'DONE' && outcome.refusal === null && entry.minutes !== null) {
          const expiresAt = now + entry.minutes * MINUTE_MS;
          await store.setExpiry(unit.db, aliasId, expiresAt);
          await unit.audit({ type: AuditType.HOST_ALIAS_ADDED, message: 'Alias address added', ...actor, details: { aliasId, address, reason: subject.reason, expiresAt, ...who(subject.actor) } });
          return;
        }
        // NOT_DONE: certainly nothing was added, the row is closed. UNKNOWN: possibly in place, the row stays open.
        if (outcome.effect === 'NOT_DONE') await store.close(unit.db, aliasId, now, NEVER_ADDED_CLOSES_AS, null);
        await unit.audit({
          type: AuditType.HOST_ALIAS_ADD_FAILED,
          message: 'Alias address not added',
          severity: Severity.WARNING,
          ...actor,
          details: { address, reason: subject.reason, failureReason: codeOf(outcome.refusal), aliasId, ...who(subject.actor) },
        });
        return;
      }
      const actor = { actorId: subject.actor?.operatorId ?? null, deviceId: subject.actor?.deviceId ?? null };
      const row: Readonly<Record<string, string>> = subject.aliasId === null ? {} : { aliasId: subject.aliasId };
      // REMOVED is the helper's `OK` and nothing else: only then did it take the address away (or find it on no interface).
      if (outcome.effect === 'DONE' && outcome.refusal === null) {
        if (subject.aliasId !== null) await store.close(unit.db, subject.aliasId, now, subject.removeReason, subject.actor?.operatorId ?? null);
        await unit.audit({ type: AuditType.HOST_ALIAS_REMOVED, message: 'Alias address removed', ...actor, details: { ...row, address, removeReason: subject.removeReason, ...who(subject.actor) } });
        return;
      }
      const failureReason = codeOf(outcome.refusal);
      if (outcome.refusal === NOT_MARKED) {
        // NOT CONFIRMED (caution R119c-01): the row is closed - nothing more can be asked - and the entry does not say "removed".
        if (subject.aliasId !== null) await store.close(unit.db, subject.aliasId, now, subject.removeReason, subject.actor?.operatorId ?? null);
        let held: boolean | null = null;
        try {
          held = deps.heldByHost === undefined ? null : deps.heldByHost(address);
        } catch {
          held = null;
        }
        await unit.audit({
          type: AuditType.HOST_ALIAS_REMOVE_FAILED,
          message: held === true ? HOST_ALIAS_NOT_CONFIRMED_MESSAGES.HELD : held === false ? HOST_ALIAS_NOT_CONFIRMED_MESSAGES.NOT_SHOWN : HOST_ALIAS_NOT_CONFIRMED_MESSAGES.NOT_KNOWN,
          severity: held === false ? Severity.INFO : Severity.WARNING,
          ...actor,
          details: { ...row, address, removeReason: subject.removeReason, failureReason, ...who(subject.actor) },
        });
        return;
      }
      // Not removed: the code on the row, which stays open.
      if (subject.aliasId !== null) await store.noteRemoveError(unit.db, subject.aliasId, failureReason);
      await unit.audit({
        type: AuditType.HOST_ALIAS_REMOVE_FAILED,
        message: 'Alias address not removed',
        severity: Severity.WARNING,
        ...actor,
        details: { ...row, address, removeReason: subject.removeReason, failureReason, ...who(subject.actor) },
      });
    });
  }

  return Object.freeze({
    intent,
    result,
    takeRefusal() {
      const last = refused;
      refused = null;
      return last;
    },
  });
}
