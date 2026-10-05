/**
 * Where the reports of the Live layer go in the web console (plan row W50; brief list row 5 of
 * implementation/44_live_source.md §17.4).
 *
 * | Destination | What | When |
 * |-------------|------|------|
 * | The page's own log (this module) | The last `ERROR_SINK_CAPACITY` records, in memory | Always |
 * | The browser console | Every record: `console.error` for level `error`, `console.warn` for `warn` | Dev builds (Live mode exists in dev builds only) |
 * | The network | Nothing | Never: the console has no client-log endpoint (predecessor decisions D3, D4, D41(g)), and a report must not leave the page |
 * | Web storage | Nothing | Never: a record may name an operation and a status, and web storage outlives the session |
 *
 * The Live source contains what its listeners throw and writes nothing itself, so a report of
 * level `error` (a subscriber that threw, a Live result read as a value) is made loud here.
 *
 * A record holds what the reporter gave: level, source, message, an optional stack and context.
 * The Live source and the typed client never put a credential into a report (they report the
 * method, the path, the status and the request ID). As a second line, every text is passed
 * through `redactCredentials`, which blanks a value with one of the three token prefixes.
 */
import type { SimErrorReport } from '@dems/shared/sim'

/** How many records the page's own log keeps. Older ones are dropped. */
export const ERROR_SINK_CAPACITY = 200

export interface ErrorRecord {
  readonly level: 'error' | 'warn'
  readonly source: string
  readonly message: string
  readonly stack?: string
  readonly context?: Readonly<Record<string, unknown>>
  /** The reporter's clock (the Live clock for a report of the Live source). */
  readonly at: number
}

export interface ErrorSink {
  /** Takes one report. Never throws. */
  readonly report: (report: SimErrorReport | ErrorRecord) => void
  /** The records kept, oldest first. A new array at every call. */
  readonly records: () => readonly ErrorRecord[]
  readonly clear: () => void
}

export interface ErrorSinkOptions {
  /** Whether records also go to the console. Default `import.meta.env.DEV`. */
  readonly dev?: boolean
  /** Default: the global `console`. */
  readonly console?: Pick<Console, 'error' | 'warn'>
  readonly capacity?: number
}

/** A session token, a device credential and a biometric token start with these (01_specs §5.3). */
const CREDENTIAL = /\b(ses|dvc|bio)_[A-Za-z0-9_-]+/g

/** Blanks every value that carries a credential prefix. */
export function redactCredentials(text: string): string {
  return text.replace(CREDENTIAL, '$1_***')
}

function redactValue(value: unknown, depth: number): unknown {
  if (typeof value === 'string') return redactCredentials(value)
  if (value === null || typeof value !== 'object' || depth > 4) return value
  if (Array.isArray(value)) return value.map((entry) => redactValue(entry, depth + 1))
  return Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, redactValue(entry, depth + 1)]))
}

export function createErrorSink(options: ErrorSinkOptions = {}): ErrorSink {
  const dev = options.dev ?? import.meta.env.DEV
  const capacity = options.capacity ?? ERROR_SINK_CAPACITY
  let kept: ErrorRecord[] = []

  return {
    report(report) {
      try {
        const record: ErrorRecord = {
          level: report.level,
          source: report.source,
          message: redactCredentials(report.message),
          ...(report.stack === undefined ? {} : { stack: redactCredentials(report.stack) }),
          ...(report.context === undefined ? {} : { context: redactValue(report.context, 0) as Record<string, unknown> }),
          at: report.at,
        }
        kept = kept.length >= capacity ? [...kept.slice(kept.length - capacity + 1), record] : [...kept, record]
        if (!dev) return
        const log = options.console ?? console
        if (record.level === 'error') log.error('[core-web] live', record)
        else log.warn('[core-web] live', record)
      } catch {
        // A sink must never fail its caller: the Live source reports from inside its own handlers.
      }
    },
    records: () => kept.slice(),
    clear() {
      kept = []
    },
  }
}

/** The page's own sink: the Live start-up, the refusal presenter and the mode switch write here. */
export const webErrorSink: ErrorSink = createErrorSink()
