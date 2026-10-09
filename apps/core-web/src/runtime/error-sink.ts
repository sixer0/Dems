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
 * through `redactCredentials`, which blanks a value with one of the three token prefixes and the
 * forms of the STT server credential (task 3 row 113: after `Bearer`, under a credential-named
 * member, and the write-only `credential` member of `updateSttConfig`).
 */
// The ONE value import of this file, and a dependency-free one: the sink is loaded before
// `z.config` (CPW1-7), so it may load no module that could build a schema. `@dems/shared/redaction`
// imports nothing at all (`live-runtime-static.test.tsx` holds both facts).
import { redactCredentialText, redactCredentialValue } from '@dems/shared/redaction'
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

/**
 * Blanks every credential form in a text. The rules are NOT this file's: they are the one rule set
 * of `@dems/shared/api` (`redaction.ts`), which the mobile runtime log applies too (task 3 row 113,
 * fix round 1, navigator finding N-1): a token of this server by its prefix, whatever follows
 * `Bearer`, the value of every member whose name says credential (in any order, quoting or
 * escaping), and `value` / `ref` in a text that mentions a credential. It fails closed.
 */
export function redactCredentials(text: string): string {
  return redactCredentialText(text)
}

/** A context as the sink keeps it: by member name at any depth; what is too deep to walk is blanked whole. */
function redactValue(value: unknown): unknown {
  return redactCredentialValue(value)
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
          ...(report.context === undefined ? {} : { context: redactValue(report.context) as Record<string, unknown> }),
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
