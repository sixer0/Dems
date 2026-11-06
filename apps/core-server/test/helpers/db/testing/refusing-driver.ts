/**
 * Test support (not a test file): the real driver behind the helper's driver seam
 * (`clientFactory`), with one change. The first forced drops it is handed are NOT sent; they are
 * answered with the refusal PostgreSQL gives while a backend that the owner role may not end is
 * on the database (SQLSTATE 42501, "permission denied to terminate process"). Every other
 * statement, and every later forced drop, goes to the server unchanged.
 *
 * An autovacuum worker cannot be summoned for a test: it comes when the server decides. With
 * this the retry of the helper runs against the real PostgreSQL in every other respect: the
 * catalog read after a refusal, the drop that goes through, the report to the owner of the run.
 * The refusal by the server itself was reproduced once, outside the suite (row W11b).
 */
import { defaultClientFactory, type ClientFactory, type DriverClient, type DriverNotification } from '../session';

const FORCED_DROP = /^DROP DATABASE IF EXISTS "[a-z0-9_]+" WITH \(FORCE\)$/;

export interface RefusingDriver {
  readonly factory: ClientFactory;
  /** The forced drops that were answered with the refusal instead of being sent. */
  readonly refused: string[];
  /** The forced drops that went to the server. */
  readonly sent: string[];
}

/** Refuses the first `refusals` forced drops of all sessions built by the returned factory. */
export function refusingDriver(refusals: number): RefusingDriver {
  let left = refusals;
  const refused: string[] = [];
  const sent: string[] = [];
  const factory: ClientFactory = (options) => {
    const real = defaultClientFactory(options);
    const client: DriverClient = {
      connect: () => real.connect(),
      end: () => real.end(),
      on: (event: 'error' | 'notification', listener: ((error: Error) => void) | ((message: DriverNotification) => void)) =>
        event === 'error'
          ? real.on('error', listener as (error: Error) => void)
          : real.on('notification', listener as (message: DriverNotification) => void),
      query: async (text, values) => {
        if (FORCED_DROP.test(text)) {
          if (left > 0) {
            left -= 1;
            refused.push(text);
            throw Object.assign(new Error('permission denied to terminate process'), { code: '42501' });
          }
          sent.push(text);
        }
        return real.query(text, values);
      },
    };
    return client;
  };
  return { factory, refused, sent };
}
