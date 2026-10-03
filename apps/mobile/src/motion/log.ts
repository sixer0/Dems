/**
 * Structured issue reporting for the motion kit.
 *
 * The mobile scaffold has no client error-log endpoint (D41(g): mock-core stays in its D3/D4
 * scope), so the default sink writes one structured record to the dev console, as the root
 * layout's error boundary does (step 68). Records carry the required fields (timestamp, level,
 * source, message, stack, context) and never user data. A later step can route them elsewhere,
 * for example into the simulator's audit log, with `setMotionLogSink` without touching callers.
 */
export type MotionLogLevel = 'error' | 'warn' | 'info';

export interface MotionLogRecord {
  readonly timestamp: string;
  readonly level: MotionLogLevel;
  /** Module and function, for example `motion.prefs.write`. */
  readonly source: string;
  readonly message: string;
  readonly stack?: string;
  /** Non-personal context only (keys, flags, counts). */
  readonly context?: Readonly<Record<string, unknown>>;
}

export type MotionLogSink = (record: MotionLogRecord) => void;

const consoleSink: MotionLogSink = (record) => {
  if (!__DEV__) return;
  if (record.level === 'error') console.error('[motion]', record);
  else if (record.level === 'warn') console.warn('[motion]', record);
  else console.info('[motion]', record);
};

let sink: MotionLogSink = consoleSink;

/** Replaces the sink (pass `null` to restore the dev-console default). Returns the previous sink. */
export function setMotionLogSink(next: MotionLogSink | null): MotionLogSink {
  const previous = sink;
  sink = next ?? consoleSink;
  return previous;
}

export function reportMotionIssue(
  level: MotionLogLevel,
  source: string,
  error: unknown,
  context?: Record<string, unknown>,
): void {
  const record: MotionLogRecord = {
    timestamp: new Date().toISOString(),
    level,
    source,
    message: error instanceof Error ? error.message : String(error),
    ...(error instanceof Error && error.stack ? { stack: error.stack } : {}),
    ...(context ? { context } : {}),
  };
  try {
    sink(record);
  } catch {
    // A failing sink must never break an animation or a haptic.
  }
}
