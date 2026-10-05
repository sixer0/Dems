/**
 * The event writer (plan row W21; spec §8.3 ENG-8; database contract §4.14, §4.24, §5.6 AT-5).
 *
 * THE ONLY code path of the server runtime that inserts into `events`. It works inside the
 * caller's unit of work, in the same transaction as the unit's audit rows and state changes.
 *
 * An event's sequence is the value of the `event` counter it consumes (`engine_counters`). The
 * writer reads and advances the counter with ONE statement (AT-5):
 *
 *     UPDATE public.engine_counters SET next_value = next_value + $2
 *      WHERE name = $1 RETURNING next_value - $2 AS first_seq
 *
 * The statement locks the counter row until the unit ends, so two units can never take the same
 * number. The event itself is built with the SHARED code (`appendEvent`, `eventId` of
 * `@dems/shared/sim`). Its stored form, with the derived `category` column, comes from the ONE
 * mapping (`eventToRow` of `db/mapping`, MR-1), and it is inserted through the typed table of
 * the schema, one statement per event. No column is named or bound here.
 *
 * Validation comes before the first statement of a call, with the rules of `payload-rules.ts`,
 * for the same reason as in the audit writer; what the mapping module already refuses is not
 * repeated. `at` is the server clock's value.
 *
 * Prepared events (`appendPrepared`) are the engine's: they carry the sequences the engine's own
 * counter gave them. The stored counter is then raised to one above the highest of them, so
 * that "the counter is above every stored sequence" holds by this writer alone. The engine's
 * write-through sets the same counter to the same value (an absolute value in both paths).
 */
import { Severity, SimEventType, appendEvent, eventId, type EventInput, type SimEvent } from '@dems/shared/sim';
import type { FastifyBaseLogger } from 'fastify';
import { eventToRow } from '../db/mapping';
import { events, type EventRow } from '../db/schema';
import { describeError, type ErrorLog } from '../plugins/logger';
import { stampOf, type Clock } from './clock';
import { CoreError, driverErrorOf } from './errors';
import { EVENT_COUNTER_NAME } from './limits';
import { checkMessage, checkPayload, checkReference, type PayloadCodes, type RowOrigin } from './payload-rules';
import type { EventEntry, UnitEventWriter } from './types';
import type { UnitState } from './unit-of-work';

/** AT-5: read and advance the counter in one statement. `$2` is how many numbers are taken. */
export const EVENT_COUNTER_ADVANCE =
  'UPDATE public.engine_counters SET next_value = next_value + $2 WHERE name = $1 RETURNING next_value - $2 AS first_seq';

/** After prepared events: the counter is at least one above the highest sequence stored. */
export const EVENT_COUNTER_RAISE =
  'UPDATE public.engine_counters SET next_value = GREATEST(next_value, $2) WHERE name = $1 RETURNING next_value';

/** The 46 shared event types and the four severities. */
const EVENT_TYPES: ReadonlySet<string> = new Set(Object.values(SimEventType));
const SEVERITIES: ReadonlySet<string> = new Set(Object.values(Severity));

const ENTRY_MEMBERS: ReadonlySet<string> = new Set(['type', 'message', 'severity', 'params', 'sessionId', 'deviceId']);

const CODES: PayloadCodes = {
  notFlat: 'EVENT_PARAMS_NOT_FLAT',
  keyForbidden: 'EVENT_PARAM_KEY_FORBIDDEN',
  valueInvalid: 'EVENT_PARAM_VALUE_INVALID',
  textInvalid: 'EVENT_TEXT_INVALID',
  secretShaped: 'EVENT_SECRET_SHAPED_VALUE',
  messageInvalid: 'EVENT_MESSAGE_INVALID',
  referenceInvalid: 'EVENT_REFERENCE_INVALID',
};

export interface EventWriterDependencies {
  readonly clock: Clock;
  readonly log: FastifyBaseLogger;
  readonly errorLog: ErrorLog;
}

function isEventType(value: unknown): value is SimEventType {
  return typeof value === 'string' && EVENT_TYPES.has(value);
}

function checkSeverity(value: unknown): Severity {
  if (typeof value !== 'string' || !SEVERITIES.has(value)) {
    throw new CoreError('EVENT_SEVERITY_INVALID', 'the severity of an event is INFO, SUCCESS, WARNING or CRITICAL');
  }
  return value as Severity;
}

/** An entry of a server-native module, as the shared input the event is built from. */
export function eventInputOf(entry: EventEntry): EventInput {
  if (typeof entry !== 'object' || entry === null) {
    throw new CoreError('EVENT_ENTRY_INVALID', 'an event entry is an object');
  }
  const members = entry as unknown as Record<string, unknown>;
  if (Object.keys(members).some((key) => !ENTRY_MEMBERS.has(key))) {
    throw new CoreError(
      'EVENT_ENTRY_INVALID',
      'an event entry holds a member the writer does not take; the sequence, the identifier and the time are set by the writer (SR-65)',
    );
  }
  const type = members['type'];
  if (!isEventType(type)) {
    throw new CoreError('EVENT_TYPE_UNKNOWN', 'the type of an event is one of the shared event types');
  }
  return {
    type,
    message: checkMessage(members['message'], 'native', CODES),
    severity: members['severity'] === undefined ? Severity.INFO : checkSeverity(members['severity']),
    params: checkPayload(members['params'] ?? {}, 'native', CODES),
    sessionId: checkReference(members['sessionId'], CODES),
    deviceId: checkReference(members['deviceId'], CODES),
  };
}

const invalidRow = (what: string): CoreError => new CoreError('EVENT_ROW_INVALID', `an event cannot be stored: ${what}`);

/**
 * Everything the table's CHECKs ask of an event. Returns it in its stored form, built by the
 * mapping module's `eventToRow` (MR-1): that builder derives the `category` column with the
 * shared `eventCategory` and is the rule for what can be stored exactly; it throws its own
 * `MappingError`.
 */
export function checkEvent(event: SimEvent, origin: RowOrigin): EventRow {
  if (typeof event !== 'object' || event === null) throw invalidRow('it is not an object');
  if (!(event.seq >= 1)) throw invalidRow('its sequence is not 1 or more');
  if (event.id !== eventId(event.seq)) throw invalidRow('its identifier is not the one of its sequence');
  if (!(event.at >= 0)) throw invalidRow('its time is before the epoch');
  if (!isEventType(event.type)) throw new CoreError('EVENT_TYPE_UNKNOWN', 'the type of an event is one of the shared event types');
  checkSeverity(event.severity);
  checkMessage(event.message, origin, CODES);
  checkPayload(event.params, origin, CODES);
  checkReference(event.sessionId, CODES);
  checkReference(event.deviceId, CODES);
  return eventToRow(event);
}

export function createUnitEventWriter(state: UnitState, dependencies: EventWriterDependencies): UnitEventWriter {
  const { clock, log, errorLog } = dependencies;
  const where = { unit: state.id, label: state.label };

  function refused(error: unknown): never {
    const description = describeError(error);
    log.warn({ ...where, code: description.code ?? description.errorName }, 'event refused');
    errorLog.append({
      level: 'error',
      source: 'core.eventWriter',
      message: 'an event was refused before it was sent',
      ...description,
      context: where,
    });
    throw error;
  }

  /** No row of the counter: the database was never seeded (boot check B-6 stops the server then). */
  function counterMissing(): never {
    return refused(
      new CoreError('EVENT_COUNTER_MISSING', 'the event counter has no row: the database is not seeded (npm run db:seed)'),
    );
  }

  /**
   * One INSERT for one event: `stored` is its stored form from the mapping module. A failure is
   * handed on as the driver's error, never as the query builder's wrapper, whose message quotes
   * the row.
   */
  async function insert(event: SimEvent, stored: EventRow): Promise<void> {
    try {
      await state.writerDatabase.insert(events).values(stored);
    } catch (wrapped) {
      throw driverErrorOf(wrapped);
    }
    state.recordEvent(event);
    log.debug({ ...where, seq: event.seq, type: event.type }, 'event appended');
  }

  async function appendEntries(entries: readonly EventEntry[]): Promise<SimEvent[]> {
    state.assertOpen();
    let inputs: EventInput[];
    let at: number;
    try {
      if (!Array.isArray(entries)) throw new CoreError('EVENT_ENTRY_INVALID', 'a list of event entries is expected');
      inputs = entries.map(eventInputOf);
      at = stampOf(clock);
    } catch (error) {
      return refused(error);
    }
    const built: SimEvent[] = [];
    if (inputs.length === 0) return built;
    const taken = await state.execute<{ first_seq: string }>(EVENT_COUNTER_ADVANCE, [EVENT_COUNTER_NAME, inputs.length]);
    const first = Number(taken.rows[0]?.first_seq);
    if (taken.rows.length !== 1 || !Number.isSafeInteger(first) || first < 1) return counterMissing();
    for (const [index, input] of inputs.entries()) {
      // Built with the shared function, on an empty ring: the event alone.
      const { event } = appendEvent([], input, at, first + index);
      let stored: EventRow;
      try {
        stored = checkEvent(event, 'native');
      } catch (error) {
        return refused(error);
      }
      await insert(event, stored);
      built.push(event);
    }
    return built;
  }

  async function appendPrepared(prepared: readonly SimEvent[]): Promise<void> {
    state.assertOpen();
    let stored: EventRow[];
    try {
      if (!Array.isArray(prepared)) throw new CoreError('EVENT_ROW_INVALID', 'a list of events is expected');
      let previous = 0;
      stored = prepared.map((event) => {
        const row = checkEvent(event, 'prepared');
        if (event.seq <= previous) throw invalidRow('the sequences of a batch do not rise');
        previous = event.seq;
        return row;
      });
    } catch (error) {
      return refused(error);
    }
    const last = prepared[prepared.length - 1];
    if (last === undefined) return;
    for (const [index, event] of prepared.entries()) await insert(event, stored[index] as EventRow);
    const raised = await state.execute(EVENT_COUNTER_RAISE, [EVENT_COUNTER_NAME, last.seq + 1]);
    if (raised.rows.length !== 1) return counterMissing();
  }

  return {
    append: (entry) =>
      state.serial(async () => {
        const [event] = await appendEntries([entry]);
        if (event === undefined) throw new CoreError('EVENT_ENTRY_INVALID', 'an event entry is expected');
        return event;
      }),
    appendMany: (entries) => state.serial(() => appendEntries(entries)),
    appendPrepared: (prepared) => state.serial(() => appendPrepared(prepared)),
    appended: () => [...state.events],
  };
}
