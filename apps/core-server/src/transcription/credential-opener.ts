/**
 * THE OPENER OF AN `ENCRYPTED` STT CREDENTIAL (integration pass A, decision D109; closes the seam
 * of rows 84 and 115; SEC35-03, SEC35-14, D68(c)).
 *
 * THE ONE FILE of this unit that reaches the Core credential store (`CREDENTIAL_STORE_USERS` of
 * `credential-store/__tests__/static.test.ts`). It builds the function the transcriber's
 * key-loader is handed: the sealed envelope the reveal caller read goes in, the API key comes out
 * - synchronously, in memory, straight into the key-loader's opaque holder. `@dems/transcriber`
 * itself never sees the store.
 *
 * The store of the app is asked WHEN A CREDENTIAL IS OPENED, never at mount: its availability is
 * decided at its own first call, and an app whose store is absent or refuses to work answers with
 * a code here (the key-loader then reports the credential as unavailable; nothing is connected).
 *
 * Nothing here logs. A failure is a code: the store's own `CredentialStoreError`, or the one below.
 */
import { coreCredentialStore, type CredentialStoreHost, type SealedSecret } from '../credential-store';

/** Opens the sealed envelope of the stored STT credential. Throws an error that carries a `code`. */
export type SttEnvelopeOpener = (sealed: SealedSecret) => string;

export const SttCredentialOpenFailure = { STORE_NOT_READY: 'CREDENTIAL_STORE_NOT_READY' } as const;

/** The store of the app is absent or refuses to work. `storeStatus` is its state, never a value. */
export class SttCredentialOpenError extends Error {
  readonly code = SttCredentialOpenFailure.STORE_NOT_READY;
  readonly storeStatus: 'ABSENT' | 'UNAVAILABLE';
  constructor(storeStatus: 'ABSENT' | 'UNAVAILABLE') {
    super('the Core credential store cannot open the stored STT credential');
    this.name = 'SttCredentialOpenError';
    this.storeStatus = storeStatus;
  }
}

export function coreSttEnvelopeOpener(app: CredentialStoreHost): SttEnvelopeOpener {
  return (sealed) => {
    const opened = coreCredentialStore(app);
    if (opened.status !== 'READY') throw new SttCredentialOpenError(opened.status);
    return opened.store.stt.open(sealed);
  };
}
