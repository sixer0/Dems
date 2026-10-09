/**
 * Operation 91 `updateSttConfig`: the one state change of the STT configuration (blueprint row
 * 113; requirement R-8; C3 §2.5; dbc-3 §B.13).
 *
 * ONE UNIT OF WORK of the serial pipeline, committed in one transaction: the lock of the row, the
 * decision, the credential write, the compare-and-set update and the audit row commit together or
 * not at all.
 *
 *   sttConfig.update   lock the singleton row; none: 503 (the seed never ran); decide the body
 *                      against the locked row with the shared rule `planSttConfigUpdate` (the
 *                      simulator decides with the same function); a stale revision: 409; a value
 *                      outside the contract: 422; nothing changed: no statement, no row; a SECRET
 *                      without a sealer: 503; the update (compare-and-set on the revision);
 *                      STT_CONFIG_CHANGED; the configuration as answered.
 *
 * A REFUSAL THROWS inside the unit, so the unit rolls back and nothing is stored, and no audit
 * row is written for it (C3 §2.5 "No row on refusal").
 *
 * WHEN THE CHANGE APPLIES. The unit is accepted while a session is open: it reads, in the same
 * statement as the row, whether one is, and answers `appliesFrom: NEXT_SESSION` then. It does not
 * touch the open session: that session keeps the snapshot of its start (`07_transcript_spec.md`
 * §B.7; the snapshot itself is the runtime row's, row 115).
 *
 * THE CREDENTIAL NEVER LEAVES THIS FUNCTION EXCEPT INTO THE UPDATE. It is not in the audit entry
 * (five keys: field names and two flags), not in the answer (`credentialSet`, `credentialKind`),
 * not in a log line and not in a thrown error: every refusal text is fixed and quotes nothing of
 * the body. A `SECRET` is handed to the sealer and only its ciphertext, nonce and key reference go
 * on; an answer of the sealer that is not a well-formed envelope, or whose "ciphertext" still
 * holds the plaintext, is refused before a statement is sent.
 */
import {
  ApiErrorCode,
  STT_CONFIG_CHANGED_MESSAGE,
  STT_CREDENTIAL_STORE_NOT_READY_REASON,
  STT_REVISION_CONFLICT_REASON,
  SttAppliesFrom,
  SttCredentialKind,
  SttCredentialWriteKind,
  planSttConfigUpdate,
  sttChangeInvalidatesLastTest,
  sttConfigChangedDetails,
  sttCredentialKindAfter,
  type SttConfig,
  type SttConfigField,
  type SttConfigUpdateRequest,
  type SttConfigUpdateResult,
  type SttCredentialWrite,
  type SttLastTest,
} from '@dems/shared/api';
import type { FastifyInstance } from 'fastify';
import type { AuditEntry } from '../../core';
import { ApiFailure } from '../../plugins/error-envelope';
import { isSealedCredential, type SealedSttCredential, type SttCredentialSealer } from './seams';
import { lockSttConfig, updateSttConfig, type CredentialColumns, type StoredSttConfig } from './statements';

/** The label of the unit. It appears in the pipeline's log lines. */
export const STT_CONFIG_UNIT_LABEL = 'sttConfig.update';

/** `details.reason` of the 503 of a database whose seed never wrote the configuration row. */
export const STT_CONFIG_NOT_SEEDED_REASON = 'STT_CONFIG_NOT_SEEDED';

/** Who asked: the operator and the device of the caller's session, never a request field (SR-65). */
export interface Actor {
  readonly operatorId: string;
  readonly deviceId: string | null;
}

export interface SttChangeOutcome {
  readonly result: SttConfigUpdateResult;
  /** The NAMES of the fields that changed; empty when the update changed nothing (no row, no new revision). */
  readonly changedFields: readonly SttConfigField[];
  readonly credentialChanged: boolean;
}

// ── The refusals: fixed texts that quote nothing of the request ────────────────────────────────

/** 503: the table holds no row. The seed writes it (row 114); the runtime role has no INSERT. */
export function sttConfigNotSeeded(): ApiFailure {
  return new ApiFailure(503, ApiErrorCode.NOT_READY, 'The STT configuration is not available. Try again shortly.', {
    details: { reason: STT_CONFIG_NOT_SEEDED_REASON },
  });
}

/** 409: the body was made from an older revision. `currentRevision` is a counter, not a secret. */
export function revisionConflict(currentRevision: number): ApiFailure {
  return new ApiFailure(409, ApiErrorCode.INVALID_STATE, 'The STT configuration changed since it was read. Read it again.', {
    details: { reason: STT_REVISION_CONFLICT_REASON, currentRevision },
  });
}

/** 422 with the named reason of C3 §2.5, or with none for the table's own cross-field rule. */
export function valueRefused(reason: string | null): ApiFailure {
  return new ApiFailure(422, ApiErrorCode.INVALID_INPUT, 'The STT configuration value is not accepted.', {
    details: reason === null ? { in: 'body' } : { in: 'body', reason },
  });
}

/** 503: a secret can be stored only as ciphertext of the Core credential store, which is not mounted. */
export function credentialStoreNotReady(): ApiFailure {
  return new ApiFailure(503, ApiErrorCode.NOT_READY, 'A secret cannot be stored yet: the credential store is not ready. Use a credential reference.', {
    details: { reason: STT_CREDENTIAL_STORE_NOT_READY_REASON },
  });
}

/** An answer of the sealer that may not be stored. The text names the rule, never a byte. */
export class SealedCredentialRefused extends Error {
  readonly code = 'STT_SEALED_CREDENTIAL_INVALID';
  constructor() {
    super('the credential sealer did not answer a well-formed AES-256-GCM envelope; nothing was stored');
    this.name = 'SealedCredentialRefused';
  }
}

// ── The audit row and the answer ───────────────────────────────────────────────────────────────

export interface SttConfigChanged {
  readonly operatorId: string;
  readonly deviceId: string | null;
  readonly changedFields: readonly SttConfigField[];
  readonly enabled: boolean;
  readonly backend: SttConfig['backend'];
  readonly credentialChanged: boolean;
  readonly revision: number;
}

/**
 * The STT_CONFIG_CHANGED row of a change (C3 §2.5): the five keys, the caller as its actor. The
 * message is fixed: it names no field and no value.
 */
export function sttConfigChanged(input: SttConfigChanged): AuditEntry {
  return {
    type: 'STT_CONFIG_CHANGED',
    message: STT_CONFIG_CHANGED_MESSAGE,
    actorId: input.operatorId,
    deviceId: input.deviceId,
    details: sttConfigChangedDetails(input),
  };
}

/** Operation 90's body from the stored row. The shape has no member a credential could sit in. */
export function sttConfigOf(stored: StoredSttConfig, lastTest: SttLastTest | null): SttConfig {
  return {
    enabled: stored.enabled,
    backend: stored.backend,
    ...(stored.endpoint === null ? {} : { endpoint: stored.endpoint }),
    model: stored.model,
    language: 'id',
    diarization: stored.diarization,
    credentialSet: stored.credentialKind !== null,
    ...(stored.credentialKind === null ? {} : { credentialKind: stored.credentialKind }),
    revision: stored.revision,
    ...(stored.updatedBy === null ? {} : { updatedBy: stored.updatedBy }),
    updatedAt: stored.updatedAt,
    // The open session took its snapshot when it started; a row changed at or after that instant
    // is the next session's.
    pendingForNextSession: stored.sessionOpenedAt !== null && stored.updatedAt >= stored.sessionOpenedAt,
    ...(lastTest === null ? {} : { lastTest }),
  };
}

// ── The credential columns of a write ──────────────────────────────────────────────────────────

const holdsPlaintext = (ciphertext: Uint8Array, plaintext: string): boolean => Buffer.from(ciphertext).includes(Buffer.from(plaintext, 'utf8'));

/**
 * Seals the secret of a body BEFORE the unit of work is entered (navigator finding N-7): a slow or
 * hung credential store then holds up this request only, never the serial pipeline, the row lock
 * or a transaction.
 *
 * Nothing is sealed for a body the operation would refuse anyway: the body is first judged against
 * the row as the pool reads it (`preview`), so a stale revision or a value outside the contract
 * leaves no envelope - and no key - behind in the credential store. The unit judges the body again
 * under the lock; that judgement is the one that counts.
 *
 * Null when the body carries no secret, when no sealer is provided (the unit then answers 503,
 * after the revision and the values were judged), or when the preview refuses the body. An answer
 * of the sealer that is no well-formed envelope, or that still holds the plaintext, is refused
 * here: nothing of it goes on.
 */
async function sealSecretOf(update: SttConfigUpdateRequest, sealer: SttCredentialSealer | null, preview: () => Promise<StoredSttConfig | null>): Promise<SealedSttCredential | null> {
  const write = update.credential;
  if (sealer === null || write === undefined || write.kind !== SttCredentialWriteKind.SECRET || write.value === undefined) return null;
  const stored = await preview();
  if (stored === null || !planSttConfigUpdate(stored, update).ok) return null;
  const sealed = await sealer.seal(write.value);
  if (!isSealedCredential(sealed) || holdsPlaintext(sealed.ciphertext, write.value)) throw new SealedCredentialRefused();
  return sealed;
}

function credentialColumnsOf(write: SttCredentialWrite, sealed: SealedSttCredential | null, sealerProvided: boolean, currentRevision: number): CredentialColumns {
  switch (write.kind) {
    case SttCredentialWriteKind.CLEAR:
      return { kind: null, ref: null, ciphertext: null, nonce: null };
    case SttCredentialWriteKind.REFERENCE:
      // The contract's schema ties `ref` to the kind (stage 7); the same rule again, at the write.
      if (write.ref === undefined) throw valueRefused(null);
      return { kind: SttCredentialKind.REFERENCE, ref: write.ref, ciphertext: null, nonce: null };
    case SttCredentialWriteKind.SECRET: {
      if (write.value === undefined) throw valueRefused(null);
      if (!sealerProvided) throw credentialStoreNotReady();
      // A sealer is there, yet nothing was sealed: the row moved between the preview and the lock.
      // The caller read an older configuration; it reads again, as for any stale revision.
      if (sealed === null) throw revisionConflict(currentRevision);
      return { kind: SttCredentialKind.ENCRYPTED, ref: sealed.keyRef, ciphertext: sealed.ciphertext, nonce: sealed.nonce };
    }
  }
}

// ── The unit ───────────────────────────────────────────────────────────────────────────────────

export async function changeSttConfig(
  app: FastifyInstance,
  actor: Actor,
  update: SttConfigUpdateRequest,
  support: { readonly sealer: SttCredentialSealer | null; readonly lastTest: SttLastTest | null; readonly preview: () => Promise<StoredSttConfig | null> },
): Promise<SttChangeOutcome> {
  const sealed = await sealSecretOf(update, support.sealer, support.preview);
  return app.pipeline.run(STT_CONFIG_UNIT_LABEL, async (unit): Promise<SttChangeOutcome> => {
    const now = app.clock.now();
    const stored = await lockSttConfig(unit);
    if (stored === null) throw sttConfigNotSeeded();
    const appliesFrom = stored.sessionOpenedAt === null ? SttAppliesFrom.NOW : SttAppliesFrom.NEXT_SESSION;

    const plan = planSttConfigUpdate(stored, update);
    if (!plan.ok) throw plan.status === 409 ? revisionConflict(plan.currentRevision) : valueRefused(plan.reason);
    if (plan.changedFields.length === 0) {
      // Nothing to store: no statement, no row, the revision stays (the precedent of operation 55).
      return { result: { ...sttConfigOf(stored, support.lastTest), appliesFrom }, changedFields: [], credentialChanged: false };
    }

    const credential = plan.credential === null ? null : credentialColumnsOf(plan.credential, sealed, support.sealer !== null, stored.revision);
    // N-5: the last test tested the configuration as it was; after a change of what a test tests it says nothing.
    const lastTest = sttChangeInvalidatesLastTest(plan.changedFields) ? null : support.lastTest;
    const revision = await updateSttConfig(unit, { values: plan.values, operatorId: actor.operatorId, now, expectedRevision: stored.revision, credential });
    if (revision === null) throw new Error('the STT configuration row changed under the lock of the unit that changes it');

    await unit.audit.append(
      sttConfigChanged({
        operatorId: actor.operatorId,
        deviceId: actor.deviceId,
        changedFields: plan.changedFields,
        enabled: plan.values.enabled,
        backend: plan.values.backend,
        credentialChanged: plan.credentialChanged,
        revision,
      }),
    );
    const after: StoredSttConfig = {
      ...plan.values,
      credentialKind: sttCredentialKindAfter(stored.credentialKind, plan.credential),
      revision,
      updatedBy: actor.operatorId,
      updatedAt: now,
      sessionOpenedAt: stored.sessionOpenedAt,
    };
    return { result: { ...sttConfigOf(after, lastTest), appliesFrom }, changedFields: plan.changedFields, credentialChanged: plan.credentialChanged };
  });
}
