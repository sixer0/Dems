/**
 * Structured issue reporting for the navigation shell (step 70).
 *
 * Same record shape and policy as the motion kit's log (`src/motion/log.ts`, step 69): there is no
 * client error-log endpoint in this demo (D41(g)), so the default sink writes one structured
 * record to the dev console, and `setNavigationLogSink` lets the runtime (step 73) persist the
 * records without touching callers. Records carry timestamp, level, source, message, stack and
 * non-personal context only: never an operator name, a credential or a full URL.
 */
export type NavigationLogLevel = 'error' | 'warn' | 'info';

export interface NavigationLogRecord {
  readonly timestamp: string;
  readonly level: NavigationLogLevel;
  /** Module and function, for example `navigation.railPrefs.write`. */
  readonly source: string;
  readonly message: string;
  readonly stack?: string;
  readonly context?: Readonly<Record<string, unknown>>;
}

export type NavigationLogSink = (record: NavigationLogRecord) => void;

const consoleSink: NavigationLogSink = (record) => {
  if (!__DEV__) return;
  if (record.level === 'error') console.error('[navigation]', record);
  else if (record.level === 'warn') console.warn('[navigation]', record);
  else console.info('[navigation]', record);
};

let sink: NavigationLogSink = consoleSink;

/** Replaces the sink (`null` restores the dev-console default); returns the previous one. */
export function setNavigationLogSink(next: NavigationLogSink | null): NavigationLogSink {
  const previous = sink;
  sink = next ?? consoleSink;
  return previous;
}

export function reportNavigationIssue(
  level: NavigationLogLevel,
  source: string,
  error: unknown,
  context?: Record<string, unknown>,
): void {
  const record: NavigationLogRecord = {
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
    // A failing sink must never break navigation.
  }
}
