/**
 * The two things the STT configuration module asks of other rows (blueprint row 113; C3 §2.5).
 *
 * This module is the CONTRACT and the API of the STT configuration. Two parts of the runtime are
 * not its own, and it reaches each through a provider another unit hands in
 * (`sttConfigControl(app).provide…`), never by doing the work itself:
 *
 *   THE CONNECTION PROBE (operation 92). The server opens no outbound connection of its own
 *   (static guard `test/static/network.test.ts`, SR-03), and the probe of each backend - the
 *   authenticated model-list request of `omlx-server` through the single key-loader, the binary
 *   and model check of `cpu-local` - is the transcriber runtime's (row 115). Until a probe is
 *   provided, operation 92 answers `503 NOT_READY` with `details.reason: TRANSCRIBER_NOT_READY`,
 *   which is the contract's own answer for exactly that (C3 §2.5).
 *
 *   THE CREDENTIAL SEALER (operation 91, `credential.kind: SECRET`). A secret is stored as
 *   AES-256-GCM ciphertext whose key lives in the Core credential store (dbc-3 §B.13, §B.3
 *   SEC35-03). That store is not this module's: it lands with the key-store row. Until a sealer
 *   is provided, a `SECRET` write answers `503 NOT_READY` with
 *   `details.reason: CREDENTIAL_STORE_NOT_READY` and stores nothing - the secret is never kept in
 *   any weaker form. `REFERENCE` and `CLEAR` need no sealer.
 *
 * A probe is given the non-secret part of the stored configuration and NOTHING of the credential
 * but how it is held: a probe that needs the credential reads it through its own key-loader.
 */
import type { SttBackend, SttCredentialKind } from '@dems/shared/api';

/** What a probe is asked to test: the stored configuration, without any credential. */
export interface SttProbeTarget {
  readonly enabled: boolean;
  readonly backend: SttBackend;
  /** Loopback only (OD-13); null for a backend without a server. */
  readonly endpoint: string | null;
  readonly model: string;
  /** How a credential is held, or null when none is set. Never the credential. */
  readonly credentialKind: SttCredentialKind | null;
}

/** What a probe answers. `detailCode` is a SCREAMING_SNAKE code; `reachable: false` is a result, not a failure. */
export interface SttProbeResult {
  readonly reachable: boolean;
  readonly modelAvailable: boolean;
  readonly detailCode: string;
}

export interface SttProbeOptions {
  /**
   * Aborted when the time limit of the test is over. A DUTY of the probe, not a hint: it gives its
   * request up at once. The module answers `TIMEOUT` and lets the next test start; "one test at a
   * time" holds across a timeout only when the probe that ran out of time has really stopped.
   */
  readonly signal: AbortSignal;
  readonly timeoutMs: number;
}

/**
 * One test of the configured backend: a model-list or health request on loopback, or a local
 * presence check. It never sends audio, never starts, stops or restarts the backend (D7(d)) and
 * measures no speed (D230).
 */
export type SttConnectionProbe = (target: SttProbeTarget, options: SttProbeOptions) => Promise<SttProbeResult>;

/** A secret as it may be stored: ciphertext, its nonce and the reference of the key. Never the key. */
export interface SealedSttCredential {
  /** The key reference of the Core credential store: a code, never key material. */
  readonly keyRef: string;
  /** AES-256-GCM ciphertext with its tag: 17 bytes or more (`stt_config_secret_check`). */
  readonly ciphertext: Uint8Array;
  /** The 96-bit GCM nonce: 12 bytes (`stt_config_nonce_check`). */
  readonly nonce: Uint8Array;
}

/** Seals a secret with a key of the Core credential store. The plaintext is not kept by the caller. */
export interface SttCredentialSealer {
  seal(plaintext: string): Promise<SealedSttCredential>;
}

/** The time limit of one test of the connection (C3 §2.5 "a short timeout"). */
export const STT_TEST_TIMEOUT_MS = 3_000;

/**
 * How many tests may run or wait for their turn at once (navigator finding N-6). One more is
 * answered `503 NOT_READY` (`TRANSCRIBER_NOT_READY`) at once: a holder of `CAPTURE_CONFIG` cannot
 * stack tests that each hold the queue for the whole time limit.
 */
export const STT_TEST_QUEUE_LIMIT = 4;

/** The form of a key reference (`capture_device_credentials_key_ref_check`, the same store). */
export const STT_KEY_REF_PATTERN = /^[A-Z][A-Z0-9_]{0,63}$/;
const GCM_NONCE_BYTES = 12;
const GCM_MIN_CIPHERTEXT_BYTES = 17;

/** True when a sealer's answer has the form the table accepts. Checked before any statement is sent. */
export function isSealedCredential(sealed: SealedSttCredential): boolean {
  return (
    typeof sealed.keyRef === 'string' &&
    STT_KEY_REF_PATTERN.test(sealed.keyRef) &&
    sealed.ciphertext instanceof Uint8Array &&
    sealed.ciphertext.byteLength >= GCM_MIN_CIPHERTEXT_BYTES &&
    sealed.nonce instanceof Uint8Array &&
    sealed.nonce.byteLength === GCM_NONCE_BYTES
  );
}
