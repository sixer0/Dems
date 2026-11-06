/**
 * Runtime issue log (step 73): structured, persistent, privacy-filtered.
 *
 * The demo has no client error-log endpoint (D41(g): mock-core stays health + heartbeat), so the
 * device itself is the persistent store. Records go to an in-memory ring buffer and, debounced, to
 * AsyncStorage key `dems.mobile.log.v1`, where a later session (Settings → About diagnostics, or
 * `adb shell run-as … `) can read them after a restart. In development builds each record is also
 * printed to the Metro console, as the motion kit and navigation logs do.
 *
 * **Which console** (row FX-M1, finding F80, ruling R6 of D201). React Native's LogBox turns every
 * `console.warn` into the "Open debugger to view warnings" toast and every `console.error` into a red
 * one, over the bottom of the screen the operator is using. A `warn` record of this log is an expected
 * operational state (the Core link down, a revoked device, a refused or unanswered call), already
 * shown by the screen in its own words, so it is mirrored with `console.info` like an `info` record:
 * it stays in Metro and logcat, with its level inside the record, and in this log. Only an `error`
 * record, a fault of the app, reaches `console.error`. An expected state is never written as `error`
 * (the Live source's unanswered calls are judged first, `probe-failure.ts`).
 *
 * Record fields: timestamp, level, source (module.function), message, stack, context and a
 * correlation id (one per app launch, plus an optional operation id). Context is filtered: keys
 * that could carry credentials or personal data (password, pin, token, secret, credential, username,
 * code) are dropped, values are primitives only, and text is truncated. Callers never pass user
 * input as a message. Every kept text (source, message, stack, string context values) also has its
 * credential-shaped values blanked, `ses_…`, `dvc_…` and `bio_…` becoming `ses_***` and so on, as the
 * web error sink does (`apps/core-web/src/runtime/error-sink.ts`, `redactCredentials`; row PT, W100-1).
 *
 * The motion kit (`setMotionLogSink`, step 69) and the navigation shell (`setNavigationLogSink`,
 * step 70) route their records here through `installRuntimeLogSinks()` (called by AppProviders).
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { isCredentialKeyName, isCredentialWriteKind, redactCredentialText } from '@dems/shared/redaction';
import { setMotionLogSink, type MotionLogRecord } from '@/motion/log';
import { setNavigationLogSink, type NavigationLogRecord } from '@/navigation/log';

/** The persisted ring buffer (JSON array of records, oldest first). No credentials, no personal data. */
export const RUNTIME_LOG_KEY = 'dems.mobile.log.v1';
export const RUNTIME_LOG_CAPACITY = 200;
/** Writes are debounced so a burst of records costs one AsyncStorage write. */
export const RUNTIME_LOG_FLUSH_MS = 2000;

const MAX_MESSAGE = 500;
const MAX_STACK = 2000;
const MAX_CONTEXT_VALUE = 200;
/** Context keys never stored (credentials, codes, identities). `api key` and `authorization` joined with the STT configuration (task 3 row 113; SEC35-14). */
const SENSITIVE_KEY = /(pass|pin$|^pin|token|secret|credential|user(name)?$|^code$|pairingcode|otp|api[-_]?key|authorization)/i;
/**
 * Blanks every credential form in a text (row PT, W100-1; task 3 row 113). The rules are NOT this
 * file's: they are the one rule set of `@dems/shared/api` (`redaction.ts`), which the web error sink
 * applies too (fix round 1, navigator finding N-1): a token of this server by its prefix
 * (`ses_***`), whatever follows `Bearer`, the value of every member whose name says credential (in
 * any order, quoting or escaping), and `value` / `ref` in a text that mentions a credential. It
 * fails closed.
 */
export function redactCredentials(text: string): string {
  return redactCredentialText(text);
}

export type RuntimeLogLevel = 'error' | 'warn' | 'info';
export type RuntimeLogValue = string | number | boolean | null;

export interface RuntimeLogRecord {
  readonly timestamp: string;
  readonly level: RuntimeLogLevel;
  /** Module and function, for example `runtime.sim.hydrate` or `auth.biometric.prompt`. */
  readonly source: string;
  readonly message: string;
  readonly stack?: string;
  readonly context?: Readonly<Record<string, RuntimeLogValue>>;
  /** `<launch id>` or `<launch id>/<operation id>`: ties the records of one launch or one action together. */
  readonly correlationId: string;
}

/** One id per JS runtime start, so records of one launch can be grouped after a restart. */
export const LAUNCH_ID = `L${Date.now().toString(36)}`;
let operationSeq = 0;

/** A fresh operation id under this launch (for example one sign-in attempt or one sync). */
export function newCorrelationId(prefix = 'op'): string {
  operationSeq += 1;
  return `${LAUNCH_ID}/${prefix}-${operationSeq}`;
}

function truncate(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

/** Redacts before truncating, so a cut can never leave the head of a credential behind unmatched. */
function keepText(text: string, max: number): string {
  return truncate(redactCredentials(text), max);
}

/** Keeps primitive values under non-sensitive keys; drops everything else. */
export function sanitizeLogContext(context: Readonly<Record<string, unknown>> | undefined): Record<string, RuntimeLogValue> | undefined {
  if (!context) return undefined;
  const out: Record<string, RuntimeLogValue> = {};
  const credentialWrite = isCredentialWriteKind(context['kind']);
  for (const [key, value] of Object.entries(context)) {
    if (SENSITIVE_KEY.test(key) || isCredentialKeyName(key)) continue;
    // N-16: beside the kind of a credential write, `value` and `ref` ARE the credential.
    if (credentialWrite && (key === 'value' || key === 'ref')) continue;
    if (value === null || typeof value === 'number' || typeof value === 'boolean') out[key] = value;
    else if (typeof value === 'string') out[key] = keepText(value, MAX_CONTEXT_VALUE);
  }
  return Object.keys(out).length > 0 ? out : undefined;
}

export interface RuntimeLogInput {
  level: RuntimeLogLevel;
  source: string;
  error: unknown;
  context?: Readonly<Record<string, unknown>>;
  correlationId?: string;
  /** Record time; defaults to now. */
  at?: number;
}

export function toRuntimeLogRecord({ level, source, error, context, correlationId, at }: RuntimeLogInput): RuntimeLogRecord {
  const message = error instanceof Error ? error.message : typeof error === 'string' ? error : String(error);
  const stack = error instanceof Error && error.stack ? keepText(error.stack, MAX_STACK) : undefined;
  const safeContext = sanitizeLogContext(context);
  return {
    timestamp: new Date(at ?? Date.now()).toISOString(),
    level,
    source: redactCredentials(source),
    message: keepText(message, MAX_MESSAGE),
    ...(stack ? { stack } : {}),
    ...(safeContext ? { context: safeContext } : {}),
    correlationId: correlationId ? redactCredentials(correlationId) : LAUNCH_ID,
  };
}

/** The storage calls the log uses (AsyncStorage in the app, a fake in tests). */
export interface LogStorage {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
}

/** Per-write options. */
export interface RuntimeLogWriteOptions {
  /**
   * False keeps the record out of the development console mirror (it is still kept and persisted). For the
   * measurement records of W98 (post-review fix FXR-M, W93-28): data for later reading, not console noise.
   */
  readonly console?: boolean;
}

export interface RuntimeLog {
  write(record: RuntimeLogRecord, options?: RuntimeLogWriteOptions): void;
  /** The records in memory, oldest first (after `load()`, including earlier launches). */
  records(): readonly RuntimeLogRecord[];
  /** Merges the stored records of earlier launches under the ones written since start. */
  load(): Promise<void>;
  /** Writes the buffer now. Resolves when stored; never rejects. */
  flush(): Promise<void>;
}

export interface RuntimeLogOptions {
  storage?: LogStorage;
  key?: string;
  capacity?: number;
  flushMs?: number;
  /** Development console mirror; off in tests that assert on the console. */
  console?: boolean;
}

/** Jest runs with `__DEV__`; info records stay out of test output (warnings and errors still show). */
const IN_JEST = typeof process !== 'undefined' && process.env?.JEST_WORKER_ID !== undefined;

function isRecord(value: unknown): value is RuntimeLogRecord {
  if (typeof value !== 'object' || value === null) return false;
  const r = value as Record<string, unknown>;
  return typeof r.timestamp === 'string' && typeof r.level === 'string' && typeof r.source === 'string' && typeof r.message === 'string';
}

export function createRuntimeLog(options: RuntimeLogOptions = {}): RuntimeLog {
  const storage = options.storage ?? AsyncStorage;
  const key = options.key ?? RUNTIME_LOG_KEY;
  const capacity = options.capacity ?? RUNTIME_LOG_CAPACITY;
  const flushMs = options.flushMs ?? RUNTIME_LOG_FLUSH_MS;
  const mirror = options.console ?? true;
  let buffer: RuntimeLogRecord[] = [];
  let timer: ReturnType<typeof setTimeout> | null = null;
  let loading: Promise<void> | null = null;

  const trim = () => {
    if (buffer.length > capacity) buffer = buffer.slice(buffer.length - capacity);
  };

  const flush = async () => {
    if (timer !== null) {
      clearTimeout(timer);
      timer = null;
    }
    try {
      await storage.setItem(key, JSON.stringify(buffer));
    } catch (error) {
      // The log cannot log its own storage failure persistently; the console is the last resort.
      if (__DEV__ && mirror) console.warn('[runtime] log write failed', error instanceof Error ? error.message : error);
    }
  };

  return {
    write(record, writeOptions) {
      buffer.push(record);
      trim();
      if (__DEV__ && mirror && writeOptions?.console !== false) {
        if (record.level === 'error') console.error('[runtime]', record);
        // R6: an operational state is no LogBox warning (see the header); the record keeps its level.
        else if (!IN_JEST) console.info('[runtime]', record);
      }
      if (timer === null) {
        timer = setTimeout(() => void flush(), flushMs);
        // W87-F1 (D189): under Node (jest) the handle is a Timeout; unref'd, a pending flush no longer
        // keeps the process alive (jest's "worker failed to exit gracefully"). React Native returns a
        // number, which has no `unref`, so the optional call does nothing in the app. The cast keeps
        // the line compiling whether the typings say Timeout (@types/node) or number (React Native).
        (timer as { unref?: () => void }).unref?.();
      }
    },
    records: () => buffer.slice(),
    load() {
      // Once per log: a second load would merge this launch's own flushed records twice.
      loading ??= (async () => {
        try {
          const raw = await storage.getItem(key);
          if (!raw) return;
          const parsed: unknown = JSON.parse(raw);
          if (!Array.isArray(parsed)) return;
          buffer = [...parsed.filter(isRecord), ...buffer];
          trim();
        } catch (error) {
          buffer.push(toRuntimeLogRecord({ level: 'warn', source: 'runtime.log.load', error, context: { key } }));
          trim();
        }
      })();
      return loading;
    },
    flush,
  };
}

/** The app's log. */
export const runtimeLog = createRuntimeLog();

/** Records one issue in the app's log. Never throws. */
export function reportRuntimeIssue(
  level: RuntimeLogLevel,
  source: string,
  error: unknown,
  context?: Readonly<Record<string, unknown>>,
  correlationId?: string,
): void {
  try {
    runtimeLog.write(toRuntimeLogRecord({ level, source, error, ...(context ? { context } : {}), ...(correlationId ? { correlationId } : {}) }));
  } catch {
    // Logging must never break the caller.
  }
}

/**
 * Records one MEASUREMENT (level `info`) in the app's log without printing it to the development console
 * (post-review fix FXR-M, W93-28: the session-window diagnostics for W98). Never throws.
 */
export function reportDiagnostic(source: string, message: string, context?: Readonly<Record<string, unknown>>): void {
  try {
    runtimeLog.write(toRuntimeLogRecord({ level: 'info', source, error: message, ...(context ? { context } : {}) }), { console: false });
  } catch {
    // Logging must never break the caller.
  }
}

function fromSibling(record: MotionLogRecord | NavigationLogRecord): RuntimeLogRecord {
  const context = sanitizeLogContext(record.context);
  return {
    timestamp: record.timestamp,
    level: record.level,
    source: redactCredentials(record.source),
    message: keepText(record.message, MAX_MESSAGE),
    ...(record.stack ? { stack: keepText(record.stack, MAX_STACK) } : {}),
    ...(context ? { context } : {}),
    correlationId: LAUNCH_ID,
  };
}

/**
 * Routes the motion kit's and the navigation shell's issue records into the runtime log (their
 * sinks were left for this step: D57, step 70 log.ts). Returns the uninstall function, which
 * restores the previous sinks.
 */
export function installRuntimeLogSinks(log: RuntimeLog = runtimeLog): () => void {
  const previousMotion = setMotionLogSink((record) => log.write(fromSibling(record)));
  const previousNavigation = setNavigationLogSink((record) => log.write(fromSibling(record)));
  void log.load();
  return () => {
    setMotionLogSink(previousMotion);
    setNavigationLogSink(previousNavigation);
  };
}
