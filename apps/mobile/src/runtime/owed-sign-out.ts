/**
 * The tablet's owed-sign-out port (row 224, G172-2; decisions D80, D90, D188). The mobile twin of
 * the web console's `apps/core-web/src/runtime/owed-sign-out-storage.ts`: the shared Live source's
 * `options.owedSignOut` (`LiveOwedSignOutPort`, `packages/shared/src/live/source/types.ts`).
 *
 * Why it exists. When the operator signs out while the Core cannot be reached, the Live source ends
 * the session HERE and owes the Core a sign-out (a debt). It pays the debt only on an OPERATOR socket
 * (`live-sim.ts` `onHello`), so the socket must be opened with the session's own token. The tablet
 * used to drop that token at the local end (`sessionCleared`), so the next socket was the device's
 * and the Core session stayed open after the operator had signed out. This port keeps the token of
 * an owed sign-out, apart from the signed-in session, until the debt is paid or found not owed.
 *
 * | Rule | Why |
 * |------|-----|
 * | `read`, `write` and `clear` are SYNCHRONOUS on memory; the secure store follows in the background, one call after another | The Live source orders them by construction and never times them out (CPC1-34). The store is what survives a cold start |
 * | `write` keeps the token only for a debt of `USER` or `LOCK` | Only those are ever paid. A reckoned expiry (D90) owes no sign-out, and a re-taken session would have no bearer here: the token is dropped as before |
 * | The token is taken from the session in memory at `write` | The Live source writes the debt before it reports the end (`endLocally`), so the token is still there; `sessionCleared` drops it from the session slot right after |
 * | `token()` is read for the socket header and for the two settlement operations only (`getAuthSession`, `signOut`) | Every other request goes as before (device credential when nobody is signed in) |
 * | `clear` forgets the token at once and deletes the item | Paid, found not owed, or a new sign-in: nothing is presented for it again, so the sign-out is sent once |
 * | `read` returns the debt WITHOUT the token | The record the source keeps holds no credential |
 * | An item that cannot be read at `load` is deleted and reads as "nothing owed" (one `warn`) | Unlike the web, where the cookie names a session that must not be taken, the tablet's socket then carries the device credential, which names no session: failing closed would gain nothing, and a `read` that throws stops the source from asking the port again (`debtPortFailed`), which would bring G172-2 back for the whole process |
 * | Reports carry codes and the item name only | No token in a log (the wrapper `./secure-credentials` records its own failures by code) |
 *
 * Residual, stated: a failed store write leaves the debt in memory only (it is still paid while the
 * process lives); a cold start then forgets it. The failure is logged by code.
 */
import type { LiveOwedSignOut, LiveOwedSignOutPort } from '@dems/shared/live/source';
import type { SecureStoreOutcome, SecureStoreRead, StoredOwedSignOut } from './secure-credentials';
import { reportRuntimeIssue } from './log';

const SOURCE = 'runtime.live.owedSignOut';

/** The secure-store calls the port uses (`./secure-credentials`; a test passes its own). */
export interface OwedSignOutStore {
  read(): Promise<SecureStoreRead<StoredOwedSignOut>>;
  write(value: StoredOwedSignOut): Promise<SecureStoreOutcome>;
  remove(): Promise<SecureStoreOutcome>;
}

export interface MobileOwedSignOutOptions {
  readonly store: OwedSignOutStore;
  /** The token of the session that is signed in now (the runtime's memory), `null` when none. */
  readonly sessionToken: () => string | null;
  /** Default: the persistent runtime log. Never handed a credential. */
  readonly report?: typeof reportRuntimeIssue;
}

export interface MobileOwedSignOut {
  /** What the Live source is given as `owedSignOut`. */
  readonly port: LiveOwedSignOutPort;
  /** The session token an owed sign-out must be sent with; `null` when nothing is owed. */
  token(): string | null;
  /** Reads the stored item once, at start, BEFORE the Live source starts. Never rejects. */
  load(): Promise<void>;
  /** Settles when the secure store has finished every call asked for so far. Never rejects. */
  idle(): Promise<void>;
}

type Owed = { readonly debt: LiveOwedSignOut; readonly token: string };

function isOperatorReason(reason: LiveOwedSignOut['reason']): reason is 'USER' | 'LOCK' {
  return reason === 'USER' || reason === 'LOCK';
}

export function createMobileOwedSignOut(options: MobileOwedSignOutOptions): MobileOwedSignOut {
  const { store, sessionToken } = options;
  const report = options.report ?? reportRuntimeIssue;
  let owed: Owed | null = null;
  let tail: Promise<void> = Promise.resolve();

  /** One store call after the earlier ones; a failure is logged by code, never thrown. */
  const queue = (operation: 'write' | 'delete', work: () => Promise<SecureStoreOutcome>): void => {
    tail = tail
      .then(work)
      .then((outcome) => {
        if (!outcome.ok) report('error', SOURCE, `The owed sign-out was not ${operation === 'write' ? 'stored' : 'deleted'}: ${outcome.code}`, { operation, code: outcome.code });
      })
      .catch((error: unknown) => report('error', SOURCE, `The owed sign-out ${operation} threw`, { operation, errorName: error instanceof Error ? error.name : typeof error }));
  };

  const port: LiveOwedSignOutPort = {
    read(): LiveOwedSignOut | null {
      // The record the source keeps: the four members of the debt, no credential.
      return owed === null ? null : { ...owed.debt };
    },
    write(debt: LiveOwedSignOut): void {
      const token = isOperatorReason(debt.reason) ? sessionToken() : null;
      if (token === null) {
        // Nothing will be sent for it: no token is kept, and an older item goes.
        owed = null;
        queue('delete', () => store.remove());
        return;
      }
      const record: LiveOwedSignOut = { operatorId: debt.operatorId, issuedAt: debt.issuedAt, reason: debt.reason, at: debt.at };
      owed = { debt: record, token };
      const stored: StoredOwedSignOut = { operatorId: record.operatorId, issuedAt: record.issuedAt, reason: debt.reason as 'USER' | 'LOCK', at: record.at, sessionToken: token };
      queue('write', () => store.write(stored));
      report('info', SOURCE, 'A sign-out is owed to the Core; it is sent when the link is back', { reason: record.reason });
    },
    clear(): void {
      const had = owed !== null;
      owed = null;
      queue('delete', () => store.remove());
      if (had) report('info', SOURCE, 'The owed sign-out is settled; its token is forgotten', {});
    },
  };

  let loading: Promise<void> | null = null;
  const load = (): Promise<void> => {
    loading ??= (async () => {
      try {
        const read = await store.read();
        if (!read.ok) {
          // The wrapper logged it by code. Its token cannot be presented, so it cannot be paid: it goes.
          report('warn', SOURCE, `The stored owed sign-out cannot be read (${read.code}); it is deleted`, { code: read.code });
          if (owed === null) queue('delete', () => store.remove());
          return;
        }
        // A debt written by this process meanwhile is newer than the stored one.
        if (read.value === null || owed !== null) return;
        const { sessionToken: token, ...debt } = read.value;
        owed = { debt, token };
      } catch (error) {
        report('error', SOURCE, 'The owed sign-out could not be read', { errorName: error instanceof Error ? error.name : typeof error });
      }
    })();
    return loading;
  };

  return {
    port,
    token: () => owed?.token ?? null,
    load,
    idle: () => tail,
  };
}
