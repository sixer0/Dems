// The rules of the two writers, database-free (plan row W21; spec §13, SR-54, SR-65, ENG-12;
// database contract §2.4, §5.5): the vocabulary, the row shape, the payload map, the allow-list
// of the nine server-written types, and the never-log rule. A refusal is a `CoreError` whose
// code names the rule and whose text quotes nothing of the row.
import { AUDIT_TYPE_CATEGORY, AuditType, SIM_EVENT_CATEGORY, SimEventType, appendAudit, auditBody, chainHash, type AuditRow } from '@dems/shared/sim';
import { describe, expect, it } from 'vitest';
import { MappingError, auditRowToRow, eventToRow } from '../../db/mapping';
import { AUDIT_DETAIL_FORBIDDEN_KEYS, EVENT_CATEGORY } from '../../db/schema/value-sets';
import {
  MANIFEST_AUDIO_ABSENT_MAX_MS,
  MANIFEST_AUDIO_BUFFERED_MAX_SAMPLES,
  MANIFEST_AUDIO_CAPTURE_GROUP_MAX,
  MANIFEST_AUDIO_CAPTURE_LAYERS,
  MANIFEST_AUDIO_DAY_SAMPLES,
  MANIFEST_AUDIO_INSERTED_RUNS_MAX,
  MANIFEST_AUDIO_INSERTED_RUN_MIN_SAMPLES,
  MANIFEST_AUDIO_SAMPLE_ACCOUNTS,
  MANIFEST_AUDIO_SAMPLE_COUNT_MEMBERS,
  MANIFEST_VIDEO_ABSENCE_ENDS,
  MANIFEST_VIDEO_ABSENT_MAX_MS,
  ManifestAudioInsertedRunSchema,
  ManifestAudioRestartGapSchema,
  ManifestAudioSamplesNotReceivedSchema,
  ManifestVideoAbsenceSchema,
  VIDEO_TRACK_IDS,
} from '@dems/shared/evidence-package';
import { CaptureAudioInputChange, OPERATOR_PASSWORD_SET_DETAILS_EXAMPLE, SYSTEM_BOOT_DETAILS_EXAMPLE, SYSTEM_BOOT_HOST_DETAILS_EXAMPLE, SYSTEM_BOOT_SIGNING_DETAILS_EXAMPLE, SYSTEM_BOOT_SIGNING_STORE_DETAILS_EXAMPLE, captureDeviceConnectionTestedDetails, captureDeviceRetiredDetails } from '@dems/shared/api';
import {
  CAPTURE_AUDIO_ABSENT_MAX_MS,
  CAPTURE_AUDIO_ACCOUNT_NUMBER_KEYS,
  CAPTURE_AUDIO_ACCOUNT_PARTS,
  CAPTURE_AUDIO_ACCOUNT_PART_NUMBER_KEYS,
  CAPTURE_AUDIO_ACCOUNT_PATH_KEYS,
  captureAudioAccountOfParts,
  captureAudioAccountParts,
  type CaptureAudioAccount,
  CAPTURE_AUDIO_BUFFERED_MAX_SAMPLES,
  CAPTURE_AUDIO_CAPTURE_GROUP_MAX,
  CAPTURE_AUDIO_CAPTURE_LAYERS,
  CAPTURE_AUDIO_DAY_SAMPLES,
  CAPTURE_AUDIO_INSERTED_RUNS_MAX,
  CAPTURE_AUDIO_INSERTED_RUN_MIN_SAMPLES,
  CAPTURE_AUDIO_OPEN_RETRIES_MAX,
  CAPTURE_AUDIO_SAMPLE_ACCOUNTS,
  CAPTURE_VIDEO_ABSENCE_ENDS,
  CAPTURE_VIDEO_ABSENT_MAX_MS,
  CAPTURE_VIDEO_ABSENT_TRACK_IDS,
  CAPTURE_CREDENTIAL_REVEAL_REASONS,
  CAPTURE_DEVICE_CONNECTION_TEST_OPERATIONS,
  CAPTURE_AUDIO_INPUT_CHANGES,
  CAPTURE_DISCOVERY_AUDIT_SCOPES,
  HOST_ALIAS_REQUEST_ACTIONS,
  OPERATOR_PASSWORD_SET_METHODS,
  SERVER_AUDIT_DETAIL_RULES,
  SERVER_AUDIT_FIXED_SEVERITY,
  SERVER_AUDIT_OPEN_DETAIL_RULES,
  SYSTEM_BOOT_SIGNING_DETAIL_RULES,
  detailRulesOf,
  fixedSeverityOf,
  openDetailRulesOf,
  type DetailRule,
} from '../audit-details';
import { auditInputOf, checkAuditRow } from '../audit-writer';
import { CoreError } from '../errors';
import { NATIVE_PAYLOAD_KEYS_MAX } from '../limits';
import { checkEvent, eventInputOf } from '../event-writer';
import { looksLikeSecret } from '../payload-rules';
import type { AuditEntry, EventEntry } from '../types';
import { GENESIS } from './support';

/** The code of the refusal: a `CoreError` of the writers, or a `MappingError` of the mapping module. */
function codeOf(work: () => unknown): string {
  try {
    work();
  } catch (error) {
    expect(error instanceof CoreError || error instanceof MappingError).toBe(true);
    return (error as CoreError | MappingError).code;
  }
  return 'accepted';
}

function refusalOf(work: () => unknown): CoreError {
  try {
    work();
  } catch (error) {
    return error as CoreError;
  }
  throw new Error('expected a refusal');
}

const base: AuditEntry = { type: 'SYSTEM_BOOT', actorId: null, deviceId: null, message: 'System booted', details: {} };
const audit = (changes: Record<string, unknown>): AuditEntry => ({ ...base, ...changes }) as AuditEntry;
const event = (changes: Record<string, unknown>): EventEntry => ({ type: 'AUTOSAVE', message: 'Autosaved', ...changes }) as EventEntry;

/** Example values in the form of each credential; never a real one. */
const SECRET_FORMS = {
  sessionToken: `ses_${'A'.repeat(43)}`,
  deviceCredential: `dvc_${'b'.repeat(43)}`,
  biometricToken: `bio_${'0'.repeat(43)}`,
  qrPayload: `DEMS-PAIR:1:${'0'.repeat(6)}`,
};

describe('the vocabulary', () => {
  it('every one of the 90 shared audit types is accepted, with the category of the shared map', () => {
    const types = Object.values(AuditType);
    // C3 §2.5 (blueprint row 113): 62 + STT_CONFIG_CHANGED = 63. C3 §5.2, §10.1 (blueprint row 132,
    // decision D106): + the four of the camera search, the test, the adoption and the no-device warning = 67.
    // Task 4 blueprint row 19 (WP-23a): + the ten of the hardware-input port = 77.
    // Task 4 blueprint row 201 (X-C): + OPERATOR_PASSWORD_SET = 78.
    // Task 4 row V3 (the third vocabulary step; C53, C57, C58, C62): + HOST_ALIAS_REQUESTED, HOST_ALIAS_ADD_FAILED,
    // CAPTURE_AUDIO_ABSENT_ON_RESTART, CAPTURE_DEVICE_CONNECTION_TESTED = 82.
    // Task 4 row R1b (decision C99): + CAPTURE_VIDEO_ABSENT_IN_SESSION = 83.
    // Task 4 row N2 (decisions U25 (3), C110, C112 (3)): + CAPTURE_AUDIO_SAMPLES_NOT_RECEIVED, CAPTURE_AUDIO_SILENCE_INSERTED = 85.
    // Task 4 row RD2 (decision C147): + CAPTURE_DEVICE_RETIRED = 86.
    // Task 4 row D53 (decisions D51, D53): + CAMERA_PREVIEW_OPENED = 87.
    // REVISED 2026-11-02 (principal): RB-9 amended — + USER_CREATED, USER_UPDATED, USER_DELETED = 90.
    // REVISED 2026-11-03 (principal): D57 adds PANEL_SETUP_CHANGED = 91.
    expect(types).toHaveLength(91);
    const typed = new Set<string>(Object.keys(SERVER_AUDIT_DETAIL_RULES));
    for (const type of types.filter((candidate) => !typed.has(candidate))) {
      const input = auditInputOf(audit({ type }));
      const { row } = appendAudit({ rows: [], head: GENESIS, total: 0, dropped: 0 }, input, 1);
      expect(row.category, type).toBe(AUDIT_TYPE_CATEGORY[type]);
      expect(codeOf(() => checkAuditRow(row, 'native')), type).toBe('accepted');
    }
  });

  // REVISED 2026-11-02 (principal): RB-9 amended — `USER_DELETED` is a type of the vocabulary since
  // the amendment (operation 17 writes it), so the example of one that is NOT moved to a name the
  // amendment did not add. The rule it proves is the same: a code outside the closed set is refused.
  it('a type outside the vocabulary is refused, also one that only has the right format', () => {
    for (const type of ['USER_REMOVED', 'system_boot', '', 7, undefined]) {
      expect(codeOf(() => auditInputOf(audit({ type })))).toBe('AUDIT_TYPE_UNKNOWN');
    }
  });

  it('every one of the 46 shared event types is accepted; another one is refused', () => {
    const types = Object.values(SimEventType);
    expect(types).toHaveLength(46);
    for (const type of types) {
      expect(eventInputOf(event({ type })).type).toBe(type);
      expect(EVENT_CATEGORY).toContain(SIM_EVENT_CATEGORY[type]);
    }
    expect(codeOf(() => eventInputOf(event({ type: 'DEVICE_REVOKED' })))).toBe('EVENT_TYPE_UNKNOWN');
  });
});

describe('an entry: what the caller gives and what it cannot give', () => {
  it('the defaults: severity INFO, references null; undefined members of the details are dropped', () => {
    expect(auditInputOf(audit({ details: { reason: 'x', absent: undefined } }))).toEqual({
      type: 'SYSTEM_BOOT',
      message: 'System booted',
      severity: 'INFO',
      actorId: null,
      sessionId: null,
      evidenceId: null,
      deviceId: null,
      details: { reason: 'x' },
    });
    expect(eventInputOf(event({}))).toEqual({ type: 'AUTOSAVE', message: 'Autosaved', severity: 'INFO', params: {}, sessionId: null, deviceId: null });
  });

  it('a member that is the writer\'s (time, sequence, identifier, category, hashes) is refused (SR-65, AC-B-55)', () => {
    for (const member of ['at', 'seq', 'id', 'category', 'prevHash', 'hash', 'actor', 'username']) {
      expect(codeOf(() => auditInputOf(audit({ [member]: 1 }))), member).toBe('AUDIT_ENTRY_INVALID');
    }
    for (const member of ['at', 'seq', 'id', 'category', 'actorId']) {
      expect(codeOf(() => eventInputOf(event({ [member]: 1 }))), member).toBe('EVENT_ENTRY_INVALID');
    }
  });

  it('the actor and the device must be stated, null included', () => {
    expect(codeOf(() => auditInputOf({ type: 'SYSTEM_BOOT', message: 'm', details: {} } as never))).toBe('AUDIT_ENTRY_INVALID');
    expect(codeOf(() => auditInputOf({ type: 'SYSTEM_BOOT', message: 'm', details: {}, actorId: null } as never))).toBe('AUDIT_ENTRY_INVALID');
    expect(codeOf(() => auditInputOf(null as never))).toBe('AUDIT_ENTRY_INVALID');
  });

  it('the actor is an operator ID or null: never a name that was typed', () => {
    expect(auditInputOf(audit({ actorId: 'OPR-001' })).actorId).toBe('OPR-001');
    for (const actorId of ['budi', 'opr-001', 'OPR-1', 'OPR-0001', 'someone@example.test', '', 7, undefined]) {
      expect(codeOf(() => auditInputOf(audit({ actorId }))), String(actorId)).toBe('AUDIT_ACTOR_INVALID');
    }
  });

  it('severity, message and references', () => {
    expect(codeOf(() => auditInputOf(audit({ severity: 'FATAL' })))).toBe('AUDIT_SEVERITY_INVALID');
    expect(auditInputOf(audit({ severity: 'CRITICAL' })).severity).toBe('CRITICAL');
    for (const message of ['', 'x'.repeat(501), 7, null, undefined]) {
      expect(codeOf(() => auditInputOf(audit({ message })))).toBe('AUDIT_MESSAGE_INVALID');
    }
    expect(auditInputOf(audit({ message: 'x'.repeat(500) })).message).toHaveLength(500);
    expect(auditInputOf(audit({ deviceId: 'DEV-0001', sessionId: 'SES-20261001-0001', evidenceId: 'EV-20261001-0001' }))).toMatchObject({
      deviceId: 'DEV-0001',
      sessionId: 'SES-20261001-0001',
      evidenceId: 'EV-20261001-0001',
    });
    for (const deviceId of ['a device', 'x'.repeat(65), '', 7, '-leading']) {
      expect(codeOf(() => auditInputOf(audit({ deviceId }))), String(deviceId)).toBe('AUDIT_REFERENCE_INVALID');
    }
    expect(codeOf(() => eventInputOf(event({ sessionId: 'a session' })))).toBe('EVENT_REFERENCE_INVALID');
    expect(codeOf(() => eventInputOf(event({ message: '' })))).toBe('EVENT_MESSAGE_INVALID');
    expect(codeOf(() => eventInputOf(event({ severity: 'LOW' })))).toBe('EVENT_SEVERITY_INVALID');
  });
});

describe('the payload map (database contract FLAT, NO_SECRET_KEYS; SR-54)', () => {
  it('flat values only', () => {
    expect(auditInputOf(audit({ details: { text: 'a', number: 1.5, flag: false, nothing: null } })).details).toEqual({
      text: 'a',
      number: 1.5,
      flag: false,
      nothing: null,
    });
    for (const details of [null, undefined, 'text', 7, [], [1], new Map(), new Date(0)]) {
      expect(codeOf(() => auditInputOf(audit({ details })))).toBe('AUDIT_DETAILS_NOT_FLAT');
    }
    for (const value of [{ nested: 1 }, [1], () => 1, Symbol('s'), 1n]) {
      expect(codeOf(() => auditInputOf(audit({ details: { value } })))).toBe('AUDIT_DETAILS_NOT_FLAT');
    }
    for (const value of [Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(codeOf(() => auditInputOf(audit({ details: { value } })))).toBe('AUDIT_DETAIL_VALUE_INVALID');
    }
    expect(codeOf(() => eventInputOf(event({ params: { value: { nested: 1 } } })))).toBe('EVENT_PARAMS_NOT_FLAT');
    expect(codeOf(() => eventInputOf(event({ params: { value: Number.NaN } })))).toBe('EVENT_PARAM_VALUE_INVALID');
  });

  it('none of the 28 key names that may name a secret, in any letter case', () => {
    expect(AUDIT_DETAIL_FORBIDDEN_KEYS).toHaveLength(28);
    for (const key of AUDIT_DETAIL_FORBIDDEN_KEYS) {
      expect(codeOf(() => auditInputOf(audit({ details: { [key]: 'x' } }))), key).toBe('AUDIT_DETAIL_KEY_FORBIDDEN');
      expect(codeOf(() => eventInputOf(event({ params: { [key]: 'x' } }))), key).toBe('EVENT_PARAM_KEY_FORBIDDEN');
    }
    for (const key of ['Password', 'TOKEN', 'pairingcode', 'sessiontoken', 'userName']) {
      expect(codeOf(() => auditInputOf(audit({ details: { [key]: 'x' } }))), key).toBe('AUDIT_DETAIL_KEY_FORBIDDEN');
    }
    // Integrity values and identifiers are not secrets (database contract §5.5).
    expect(auditInputOf(audit({ details: { manifestHash: 'a'.repeat(64), sha256: 'b'.repeat(64), codeId: 'PCD-000001', tokenId: 'x' } })).details).toHaveProperty('codeId');
  });

  it('a native key is a camelCase name; at most 16 keys; a text of at most 500 characters', () => {
    for (const key of ['with space', 'with-dash', 'With', '1st', '', 'x'.repeat(49)]) {
      expect(codeOf(() => auditInputOf(audit({ details: { [key]: 1 } }))), key).toBe('AUDIT_DETAILS_NOT_FLAT');
    }
    const many = Object.fromEntries(Array.from({ length: 17 }, (_, index) => [`key${index}`, index]));
    expect(codeOf(() => auditInputOf(audit({ details: many })))).toBe('AUDIT_DETAILS_NOT_FLAT');
    expect(codeOf(() => auditInputOf(audit({ details: { text: 'x'.repeat(501) } })))).toBe('AUDIT_DETAIL_VALUE_INVALID');
    expect(codeOf(() => auditInputOf(audit({ details: { text: 'x'.repeat(500) } })))).toBe('accepted');
  });

  it('no text of a row has the form of a credential: not a value, not the message, not a reference', () => {
    for (const [name, value] of Object.entries(SECRET_FORMS)) {
      expect(looksLikeSecret(value), name).toBe(true);
      expect(looksLikeSecret(`Bearer ${value}.`), name).toBe(true);
      expect(codeOf(() => auditInputOf(audit({ details: { note: value } }))), name).toBe('AUDIT_SECRET_SHAPED_VALUE');
      expect(codeOf(() => auditInputOf(audit({ message: `Signed in with ${value}` }))), name).toBe('AUDIT_SECRET_SHAPED_VALUE');
      expect(codeOf(() => eventInputOf(event({ params: { note: value } }))), name).toBe('EVENT_SECRET_SHAPED_VALUE');
      expect(codeOf(() => eventInputOf(event({ message: value }))), name).toBe('EVENT_SECRET_SHAPED_VALUE');
    }
    expect(codeOf(() => auditInputOf(audit({ deviceId: SECRET_FORMS.deviceCredential })))).toBe('AUDIT_SECRET_SHAPED_VALUE');
    // Not a credential form: a hash, an identifier, a prefix that is too short.
    for (const value of ['a'.repeat(64), 'PCD-000001', 'ses_short', 'DEMS-PAIR:1:12345']) {
      expect(looksLikeSecret(value), value).toBe(false);
    }
  });

  it('a text that PostgreSQL could not store unchanged is refused: U+0000 and an unpaired surrogate', () => {
    for (const text of ['a\u0000b', 'a\ud800b', '\udc00']) {
      expect(codeOf(() => auditInputOf(audit({ message: text })))).toBe('AUDIT_TEXT_INVALID');
      expect(codeOf(() => auditInputOf(audit({ details: { note: text } })))).toBe('AUDIT_TEXT_INVALID');
      expect(codeOf(() => eventInputOf(event({ params: { note: text } })))).toBe('EVENT_TEXT_INVALID');
    }
    // A character outside the basic plane is a PAIR of surrogates: well formed, and stored as it is.
    const astral = String.fromCodePoint(0x1f600);
    expect(auditInputOf(audit({ message: `Astral ${astral} dan Bahasa: selesai` })).message).toContain(astral);
  });

  it('a refusal quotes nothing of the row: neither the key nor the value', () => {
    const marker = 'MARK-value-51ad';
    const refusals = [
      refusalOf(() => auditInputOf(audit({ details: { password: marker } }))),
      refusalOf(() => auditInputOf(audit({ details: { markerKeyXyz: { nested: marker } } }))),
      refusalOf(() => auditInputOf(audit({ details: { note: `${marker} ${SECRET_FORMS.sessionToken}` } }))),
      refusalOf(() => auditInputOf(audit({ message: `${marker}\u0000` }))),
      refusalOf(() => auditInputOf(audit({ actorId: marker }))),
      refusalOf(() => auditInputOf({ type: 'ACCESS_DENIED', actorId: null, deviceId: null, message: 'm', details: { operationId: 'x', markerKeyXyz: marker } })),
      refusalOf(() => auditInputOf({ type: 'ROLE_CHANGED', actorId: null, deviceId: null, message: 'm', details: { targetOperatorId: marker, from: 'SUPERVISOR', to: 'TECHNICIAN' } })),
    ];
    for (const refusal of refusals) {
      expect(refusal.message).not.toContain(marker);
      expect(refusal.message).not.toContain('markerKeyXyz');
      expect(refusal.message).not.toContain('ses_');
      expect(refusal.code).toMatch(/^AUDIT_[A-Z_]+$/);
    }
  });
});

describe('the allow-list of the thirty-eight server-written types (spec §13.1; C3 §5.2, §2.5; task 4 rows 19, 201 and V3)', () => {
  const accepted: Record<string, AuditEntry[]> = {
    ACCESS_DENIED: [
      { type: 'ACCESS_DENIED', actorId: 'OPR-003', deviceId: null, message: 'Denied', details: { operationId: 'startSession', permission: 'SESSION_START', role: 'TECHNICIAN' } },
      { type: 'ACCESS_DENIED', actorId: null, deviceId: 'DEV-0001', message: 'Denied', details: { operationId: 'getSessionState', reason: 'DEVICE_REVOKED' } },
    ],
    PAIRING_CODE_ISSUED: [{ type: 'PAIRING_CODE_ISSUED', actorId: 'OPR-002', deviceId: null, message: 'Issued', details: { codeId: 'PCD-000001', expiresAt: 1_790_823_900_000 } }],
    PAIRING_CODE_CLOSED: [
      { type: 'PAIRING_CODE_CLOSED', actorId: 'OPR-002', deviceId: null, message: 'Closed', details: { codeId: 'PCD-000001', reason: 'CANCELLED' } },
      { type: 'PAIRING_CODE_CLOSED', actorId: null, deviceId: null, message: 'Closed', details: { codeId: 'PCD-000002', reason: 'EXHAUSTED' } },
    ],
    DEVICE_REVOKED: [{ type: 'DEVICE_REVOKED', actorId: 'OPR-002', deviceId: 'DEV-0001', message: 'Revoked', details: { reason: 'Tablet reported lost', sessionsEnded: 2 } }],
    DEVICE_CREDENTIAL_ROTATED: [
      { type: 'DEVICE_CREDENTIAL_ROTATED', actorId: null, deviceId: 'DEV-0001', message: 'Rotated', details: {} },
      { type: 'DEVICE_CREDENTIAL_ROTATED', actorId: null, deviceId: 'DEV-0001', message: 'Rotated', details: { deviceId: 'DEV-0001' } },
    ],
    ROLE_CHANGED: [{ type: 'ROLE_CHANGED', actorId: 'OPR-002', deviceId: null, message: 'Role changed', details: { targetOperatorId: 'OPR-003', from: 'TECHNICIAN', to: 'INVESTIGATOR', reason: 'Reassigned' } }],
    USER_ENABLED: [{ type: 'USER_ENABLED', actorId: 'OPR-002', deviceId: null, message: 'Enabled', details: { targetOperatorId: 'OPR-003' } }],
    USER_DISABLED: [{ type: 'USER_DISABLED', actorId: 'OPR-002', deviceId: null, message: 'Disabled', details: { targetOperatorId: 'OPR-003', sessionsEnded: 0 } }],
    // RB-9 as amended (principal PT GSP, 02-11-2026): the three lists of the vendor-only operations.
    // Membership and IDs only: no list holds a username, a password or a hashed value (E-30/E-31).
    USER_CREATED: [{ type: 'USER_CREATED', actorId: 'OPR-004', deviceId: null, message: 'Created', details: { targetOperatorId: 'OPR-006', role: 'TECHNICIAN', reason: 'A new investigator joined' } }],
    USER_UPDATED: [{ type: 'USER_UPDATED', actorId: 'OPR-004', deviceId: null, message: 'Profile updated', details: { targetOperatorId: 'OPR-003', fields: 'name,displayName,initials,rank' } }],
    USER_DELETED: [{ type: 'USER_DELETED', actorId: 'OPR-004', deviceId: null, message: 'Deleted', severity: 'WARNING', details: { targetOperatorId: 'OPR-006', role: 'TECHNICIAN', sessionsEnded: 0, auditRowsRemoved: 2, signInRowsRemoved: 1, recordsLeftUnattributed: 0, credentialsRemoved: 1, reason: 'The account was no longer used' } }],
    // D57 (2026-11-03): facts of a panel setup change - which fields moved, where the logo went.
    PANEL_SETUP_CHANGED: [{ type: 'PANEL_SETUP_CHANGED', actorId: 'OPR-004', deviceId: null, message: 'Panel setup changed', severity: 'WARNING', details: { satkerChanged: true, clientChanged: false, logoQueued: true, logoTarget: 'both', reason: 'Handover branding approved' } }],
    BIOMETRIC_ENROLLMENT_CHANGED: [{ type: 'BIOMETRIC_ENROLLMENT_CHANGED', actorId: 'OPR-001', deviceId: 'DEV-0001', message: 'Enrolment changed', details: { enabled: true } }],
    // The nine capture-phase types of task 3 (C3 §5.2; row 48). Example values in each rule's form.
    CAPTURE_CONFIG_CHANGED: [{ type: 'CAPTURE_CONFIG_CHANGED', actorId: 'OPR-002', deviceId: null, message: 'Selector changed', details: { operationId: 'setPrimaryMic', scope: 'MIC', field: 'SOURCE', inputId: 'MIC-01', deviceId: 'MIC-02', from: 'MIC-02', to: 'MIC-01', permission: 'CAPTURE_CONFIG' } }],
    AUDIO_SOURCE_SWITCHED: [
      { type: 'AUDIO_SOURCE_SWITCHED', actorId: 'OPR-001', deviceId: null, message: 'Switched', details: { fromInput: 'MIC-01', toInput: 'MIC-02', fromMs: 1_790_823_600_000, toMs: 1_790_823_600_200 } },
      { type: 'AUDIO_SOURCE_SWITCHED', actorId: null, deviceId: 'DEV-0001', message: 'Switched', details: { fromInput: 'MIC-02', toInput: 'MIC-01', fromMs: 1_790_823_600_000, toMs: 1_790_823_600_200, sendingDeviceId: 'DEV-0001' } },
      // D144: any numbered mic input (`MIC-NN`), not only the first pair.
      { type: 'AUDIO_SOURCE_SWITCHED', actorId: 'OPR-001', deviceId: null, message: 'Switched', details: { fromInput: 'MIC-03', toInput: 'MIC-01', fromMs: 1_790_823_600_000, toMs: 1_790_823_600_200 } },
      { type: 'AUDIO_SOURCE_SWITCHED', actorId: 'OPR-001', deviceId: null, message: 'Switched', details: { fromInput: 'MIC-02', toInput: 'MIC-03', fromMs: 1_790_823_600_000, toMs: 1_790_823_600_200 } },
    ],
    CAMERA_POE_CYCLED: [{ type: 'CAMERA_POE_CYCLED', actorId: 'OPR-003', deviceId: null, message: 'Port cycled', details: { deviceId: 'CAM-02', poePort: 'POE_CAM_2_AUX', streamWasLost: true, confirmed: true, gapFromMs: 1_790_823_600_000, gapToMs: 1_790_823_604_000 } }],
    TRANSCRIPT_REVISED: [{ type: 'TRANSCRIPT_REVISED', actorId: 'OPR-001', deviceId: null, message: 'Revised', details: { revisionId: 'TRV-000001', authorId: 'OPR-001', number: 1, baseRevision: 0, changeCount: 2, machineTranscriptHash: 'a'.repeat(64), reason: 'Subject name corrected' } }],
    MIC_SILENT: [{ type: 'MIC_SILENT', actorId: null, deviceId: null, message: 'Silent', details: { inputId: 'MIC-01', thresholdDbfs: -60, durationMs: 5_000, sinceMs: 1_790_823_600_000, active: true } }],
    EVIDENCE_MEDIA_SERVED: [{ type: 'EVIDENCE_MEDIA_SERVED', actorId: 'OPR-001', deviceId: null, message: 'Served', details: { fileId: 'VIDEO-01', bytesServed: 4_194_304, rangeStart: 0, rangeEnd: 4_194_303, signed: true, expiresAt: 1_790_823_900_000 } }],
    EVIDENCE_EXPORT_FAILED: [{ type: 'EVIDENCE_EXPORT_FAILED', actorId: 'OPR-002', deviceId: null, message: 'Export failed', details: { jobId: 'EXPJ-000001', kind: 'PACKAGE', reason: 'DISK_FULL' } }],
    CAPTURE_CREDENTIAL_SET: [{ type: 'CAPTURE_CREDENTIAL_SET', actorId: 'OPR-003', deviceId: null, message: 'Credential stored', details: { deviceId: 'CAM-01', operationId: 'setCaptureCredential', permission: 'CAPTURE_CONFIG' } }],
    CAPTURE_CREDENTIAL_REVEALED: [{ type: 'CAPTURE_CREDENTIAL_REVEALED', actorId: 'OPR-002', deviceId: null, message: 'Credential revealed', details: { deviceId: 'CAM-01', reason: 'CONNECTION_TEST' } }],
    // Task 3 M6 (blueprint row 113; C3 §2.5): field NAMES and two flags, never a value.
    STT_CONFIG_CHANGED: [
      { type: 'STT_CONFIG_CHANGED', actorId: 'OPR-003', deviceId: null, message: 'STT configuration changed', details: { changedFields: 'enabled', enabled: false, backend: 'cpu-local', credentialChanged: false, revision: 2 } },
      { type: 'STT_CONFIG_CHANGED', actorId: 'OPR-002', deviceId: 'DEV-0001', message: 'STT configuration changed', details: { changedFields: 'backend,endpoint,model,credential', enabled: true, backend: 'omlx-server', credentialChanged: true, revision: 3 } },
    ],
    // Task 3 R-9, R-10 (blueprint row 132, decision D106; C3 §5.2; M4-AUD-1): ids, counts, codes and
    // facts. `host` and `endpointRef` only on the row of a PRODUCTION candidate (D86 C-3).
    CAPTURE_DISCOVERY_SEARCHED: [
      { type: 'CAPTURE_DISCOVERY_SEARCHED', actorId: 'OPR-003', deviceId: null, message: 'Camera search performed', details: { searchId: 'DSC-000012', scope: 'CAMERA_NETWORK', trigger: 'MANUAL', outcome: 'COMPLETE', responderCount: 0, newCount: 0, registeredCount: 0, interfaceCount: 1 } },
      { type: 'CAPTURE_DISCOVERY_SEARCHED', actorId: 'OPR-002', deviceId: 'DEV-0001', message: 'Camera search could not run', details: { searchId: 'DSC-000013', scope: 'CAMERA_NETWORK', trigger: 'PRECHECK', outcome: 'FAILED', responderCount: 0, newCount: 0, registeredCount: 0, interfaceCount: 0, failureReason: 'SOCKET_ERROR', sessionId: 'SES-20261009-0003', operationId: 'startCaptureDiscovery', permission: 'CAPTURE_CONFIG' } },
      { type: 'CAPTURE_DISCOVERY_SEARCHED', actorId: 'OPR-003', deviceId: null, message: 'Microphone inputs read again', details: { searchId: 'DSC-000014', scope: 'MIC_LOCAL', trigger: 'MANUAL', outcome: 'COMPLETE', responderCount: 2, newCount: 0, registeredCount: 2, interfaceCount: 0, operationId: 'rescanCaptureInputs' } },
    ],
    CAPTURE_CONNECTION_TESTED: [
      { type: 'CAPTURE_CONNECTION_TESTED', actorId: 'OPR-003', deviceId: null, message: 'Camera connection tested', details: { candidateId: 'CND-4F2A91C0D377', searchId: 'DSC-000012', outcome: 'AUTHENTICATION_FAILED', authenticated: true, adapter: 'FAKE', sourceClass: 'DEVELOPMENT', operationId: 'testCaptureCandidateConnection' } },
      { type: 'CAPTURE_CONNECTION_TESTED', actorId: 'OPR-002', deviceId: null, message: 'Camera connection tested', details: { candidateId: 'CND-4F2A91C0D377', searchId: 'DSC-000012', outcome: 'REACHABLE', authenticated: true, adapter: 'ONVIF_RTSP', sourceClass: 'PRODUCTION', operationId: 'adoptCaptureCandidate', host: '192.0.2.10', endpointRef: 'urn:uuid:00000000-0000-0000-0000-000000000000', guardTripped: false, permission: 'CAPTURE_CONFIG' } },
    ],
    CAPTURE_CANDIDATE_ADOPTED: [
      { type: 'CAPTURE_CANDIDATE_ADOPTED', actorId: 'OPR-003', deviceId: null, message: 'Camera added', details: { deviceId: 'CAM-03', candidateId: 'CND-4F2A91C0D377', searchId: 'DSC-000012', adapter: 'FAKE', sourceClass: 'DEVELOPMENT', credentialSet: false, operationId: 'adoptCaptureCandidate' } },
      { type: 'CAPTURE_CANDIDATE_ADOPTED', actorId: 'OPR-002', deviceId: null, message: 'Camera added', details: { deviceId: 'CAM-04', candidateId: 'CND-0000000000AB', searchId: 'DSC-000012', adapter: 'ONVIF_RTSP', sourceClass: 'PRODUCTION', credentialSet: true, operationId: 'adoptCaptureCandidate', host: '192.0.2.10', endpointRef: 'urn:uuid:00000000-0000-0000-0000-000000000000', permission: 'CAPTURE_CONFIG' } },
    ],
    CAPTURE_DEVICE_UNREACHABLE: [
      { type: 'CAPTURE_DEVICE_UNREACHABLE', actorId: 'OPR-001', deviceId: null, message: 'Capture device not reachable', details: { deviceId: 'CAM-02', deviceKind: 'CAMERA', phase: 'PRECHECK', reason: 'UNREACHABLE', degraded: true, sessionId: 'SES-20261009-0003' } },
      { type: 'CAPTURE_DEVICE_UNREACHABLE', actorId: null, deviceId: null, message: 'Capture device not reachable', details: { deviceId: 'MIC-01', deviceKind: 'MIC', phase: 'SESSION_START', reason: 'PERMISSION_DENIED', degraded: false, sessionId: 'SES-20261009-0003' } },
    ],
    // Task 4 blueprint row 19 (WP-23a; design addendum 04 sections 4.2, 8.2): the ten of the
    // hardware-input port. Ids, closed codes, counts and IP literals; no device text.
    CAPTURE_AUDIO_INPUT_CHANGED: [
      { type: 'CAPTURE_AUDIO_INPUT_CHANGED', actorId: 'OPR-003', deviceId: null, message: 'Microphone input registered', details: { deviceId: 'MIC-03', change: 'REGISTERED', inputNumber: 1, channelCount: 2 } },
      { type: 'CAPTURE_AUDIO_INPUT_CHANGED', actorId: 'OPR-002', deviceId: null, message: 'Microphone input enabled again', details: { deviceId: 'MIC-03', change: 'REENABLED', inputNumber: 2, channelCount: 8, operationId: 'registerCaptureAudioInput', permission: 'CAPTURE_CONFIG' } },
      // R-FLEX AU-A1 (row 129): the old input of a microphone moved by `release: true`; same keys.
      { type: 'CAPTURE_AUDIO_INPUT_CHANGED', actorId: 'OPR-002', deviceId: null, message: 'Microphone MIC-03 released from its old input', details: { deviceId: 'MIC-03', change: 'RELEASED', inputNumber: 1, channelCount: 8, operationId: 'registerCaptureAudioInput', permission: 'CAPTURE_CONFIG' } },
    ],
    CAPTURE_NETWORK_CONFIG_CHANGED: [
      { type: 'CAPTURE_NETWORK_CONFIG_CHANGED', actorId: 'OPR-003', deviceId: null, message: 'Camera network configuration changed', details: { changedFields: 'interfaceName', revision: 2 } },
      { type: 'CAPTURE_NETWORK_CONFIG_CHANGED', actorId: 'OPR-003', deviceId: null, message: 'Camera network configuration changed', details: { changedFields: 'cameraSubnet,factoryAddresses,aliasHost,aliasMinutes,cameraIpStart', revision: 3, operationId: 'updateCaptureNetworkConfig', permission: 'CAPTURE_CONFIG' } },
      // Row V7b: the seventh setting by name, and the count of the ports now listed.
      { type: 'CAPTURE_NETWORK_CONFIG_CHANGED', actorId: 'OPR-003', deviceId: null, message: 'Camera network configuration changed', details: { changedFields: 'interfaceName,onvifPorts', revision: 4, onvifPortCount: 8, operationId: 'updateCaptureNetworkConfig', permission: 'CAPTURE_COMMISSION' } },
    ],
    HOST_ALIAS_ADDED: [{ type: 'HOST_ALIAS_ADDED', actorId: 'OPR-003', deviceId: null, message: 'Temporary host address added', details: { aliasId: '00000000-0000-4000-8000-0000000000a1', address: '192.168.1.253', reason: 'FACTORY_SCAN', expiresAt: 1_790_825_400_000 } }],
    HOST_ALIAS_REMOVED: [
      { type: 'HOST_ALIAS_REMOVED', actorId: null, deviceId: null, message: 'Temporary host address removed', details: { aliasId: '00000000-0000-4000-8000-0000000000a1', address: '192.168.1.253', removeReason: 'BOOT_SWEEP' } },
      { type: 'HOST_ALIAS_REMOVED', actorId: 'OPR-003', deviceId: null, message: 'Temporary host address removed', details: { aliasId: '00000000-0000-4000-8000-0000000000a1', address: '192.168.1.253', removeReason: 'MANUAL', operationId: 'removeHostAlias', permission: 'CAPTURE_CONFIG' } },
    ],
    HOST_ALIAS_REMOVE_FAILED: [{ type: 'HOST_ALIAS_REMOVE_FAILED', actorId: null, deviceId: null, message: 'Temporary host address could not be removed', details: { aliasId: '00000000-0000-4000-8000-0000000000a1', address: '192.168.1.253', removeReason: 'EXPIRED', failureReason: 'HELPER_FAILED' } }],
    CAMERA_FACTORY_SCANNED: [
      { type: 'CAMERA_FACTORY_SCANNED', actorId: 'OPR-003', deviceId: null, message: 'Factory address scan performed', details: { outcome: 'COMPLETE', addressCount: 4, responderCount: 1 } },
      { type: 'CAMERA_FACTORY_SCANNED', actorId: 'OPR-003', deviceId: null, message: 'Factory address scan could not run', details: { outcome: 'FAILED', addressCount: 5, responderCount: 0, searchId: 'DSC-000020', aliasId: '00000000-0000-4000-8000-0000000000a1', failureReason: 'NOT_CONFIGURED', operationId: 'scanFactoryCameras', permission: 'CAPTURE_CONFIG' } },
    ],
    CAMERA_NETWORK_SET: [
      { type: 'CAMERA_NETWORK_SET', actorId: 'OPR-003', deviceId: null, message: 'Camera network address requested', details: { phase: 'REQUESTED', fromAddress: '192.168.1.64', toAddress: '192.168.10.101' } },
      { type: 'CAMERA_NETWORK_SET', actorId: 'OPR-003', deviceId: null, message: 'Camera network address not set', details: { phase: 'FAILED', fromAddress: '192.168.1.64', toAddress: '192.168.10.101', mac: 'AA:BB:CC:00:11:22', deviceId: 'CAM-03', candidateId: 'CND-4F2A91C0D377', aliasId: '00000000-0000-4000-8000-0000000000a1', failureReason: 'AUTH_REFUSED', guardTripped: true, operationId: 'setCameraNetwork', permission: 'CAPTURE_CONFIG' } },
    ],
    CAPTURE_DEVICE_ADDRESS_CHANGED: [{ type: 'CAPTURE_DEVICE_ADDRESS_CHANGED', actorId: 'OPR-003', deviceId: null, message: 'Camera address changed', details: { deviceId: 'CAM-01', fromAddress: '192.168.1.64', toAddress: '192.168.10.101', reason: 'SET_CAMERA_ADDRESS' } }],
    INSTALLATION_ACCEPTED: [{ type: 'INSTALLATION_ACCEPTED', actorId: 'OPR-002', deviceId: null, message: 'Installation accepted', details: { acceptanceId: '00000000-0000-4000-8000-0000000000c1', stepCount: 12, passedCount: 11 } }],
    INSTALLATION_ACCEPTANCE_REVOKED: [{ type: 'INSTALLATION_ACCEPTANCE_REVOKED', actorId: 'OPR-002', deviceId: null, message: 'Installation acceptance revoked', details: { acceptanceId: '00000000-0000-4000-8000-0000000000c1' } }],
    // Task 4 blueprint row 201 (X-C; SX-14): the row of the host command. Actor null, severity the type's fixed one.
    OPERATOR_PASSWORD_SET: [
      { type: 'OPERATOR_PASSWORD_SET', actorId: null, deviceId: null, severity: 'WARNING', message: 'Operator password set from the host', details: { targetOperatorId: 'OPR-002', method: 'HOST_COMMAND', sessionsEnded: 0, earlierWasDemo: true } },
      { type: 'OPERATOR_PASSWORD_SET', actorId: null, deviceId: null, severity: 'WARNING', message: 'Operator password set from the host', details: { targetOperatorId: 'OPR-001', method: 'HOST_COMMAND', sessionsEnded: 3, earlierWasDemo: false, invokerUid: 1000 } },
    ],
    // Task 4 row V3 (the third vocabulary step): the four types of that step.
    // The INTENT of a change of the host's own addresses, before the line is sent: an add with its lifetime, a removal with its cause.
    HOST_ALIAS_REQUESTED: [
      { type: 'HOST_ALIAS_REQUESTED', actorId: 'OPR-003', deviceId: null, message: 'Temporary host address requested', details: { action: 'ADD', address: '192.168.1.253', reason: 'FACTORY_SCAN', minutes: 30, operationId: 'scanFactoryCameras', permission: 'CAPTURE_COMMISSION' } },
      { type: 'HOST_ALIAS_REQUESTED', actorId: 'OPR-003', deviceId: null, message: 'Temporary host address requested', details: { action: 'ADD', address: '192.168.1.253', reason: 'SET_CAMERA_ADDRESS', minutes: 480, aliasId: '00000000-0000-4000-8000-0000000000a1' } },
      { type: 'HOST_ALIAS_REQUESTED', actorId: null, deviceId: null, message: 'Temporary host address removal requested', details: { action: 'REMOVE', address: '192.168.1.253', removeReason: 'BOOT_SWEEP', aliasId: '00000000-0000-4000-8000-0000000000a1' } },
      { type: 'HOST_ALIAS_REQUESTED', actorId: 'OPR-003', deviceId: null, message: 'Temporary host address removal requested', details: { action: 'REMOVE', address: '192.168.1.253', removeReason: 'MANUAL', operationId: 'removeHostAlias', permission: 'CAPTURE_COMMISSION' } },
    ],
    HOST_ALIAS_ADD_FAILED: [
      { type: 'HOST_ALIAS_ADD_FAILED', actorId: 'OPR-003', deviceId: null, severity: 'WARNING', message: 'Temporary host address could not be added', details: { address: '192.168.1.253', reason: 'FACTORY_SCAN', failureReason: 'HELPER_ADDRESS_IN_USE' } },
      { type: 'HOST_ALIAS_ADD_FAILED', actorId: 'OPR-003', deviceId: null, severity: 'WARNING', message: 'Temporary host address could not be added', details: { address: '192.168.1.253', reason: 'SET_CAMERA_ADDRESS', failureReason: 'HELPER_FAILED', aliasId: '00000000-0000-4000-8000-0000000000a1', operationId: 'setCameraNetwork', permission: 'CAPTURE_COMMISSION' } },
    ],
    // The capture worker was replaced inside a session: the session, the two attempts, the measured bounds of the gap (C57). No actor.
    CAPTURE_AUDIO_ABSENT_ON_RESTART: [
      { type: 'CAPTURE_AUDIO_ABSENT_ON_RESTART', actorId: null, deviceId: null, severity: 'WARNING', message: 'Audio was not recorded while the capture worker was replaced', details: { sessionId: 'SES-20261001-0024', earlierAttempt: 1, laterAttempt: 2, audioAbsentAtLeastMs: 275, audioAbsentAtMostMs: 637 } },
      { type: 'CAPTURE_AUDIO_ABSENT_ON_RESTART', actorId: null, deviceId: null, severity: 'WARNING', message: 'Audio was not recorded while the capture worker was replaced', details: { sessionId: 'SES-20261001-0024', earlierAttempt: 2, laterAttempt: 3, audioAbsentAtMostMs: 612 } },
      { type: 'CAPTURE_AUDIO_ABSENT_ON_RESTART', actorId: null, deviceId: null, severity: 'WARNING', message: 'Audio was not recorded while the capture worker was replaced', details: { sessionId: 'SES-20261001-0024', earlierAttempt: 1, laterAttempt: 2 } },
    ],
    // The OUTCOME of a connection test of a registered camera with its stored credential (C58): no candidate, no address.
    CAPTURE_DEVICE_CONNECTION_TESTED: [
      { type: 'CAPTURE_DEVICE_CONNECTION_TESTED', actorId: 'OPR-003', deviceId: null, message: 'Registered camera connection tested', details: { deviceId: 'CAM-01', outcome: 'REACHABLE', adapter: 'ONVIF_RTSP', sourceClass: 'PRODUCTION', operationId: 'testCaptureDeviceConnection', permission: 'CAPTURE_CONFIG' } },
      { type: 'CAPTURE_DEVICE_CONNECTION_TESTED', actorId: 'OPR-002', deviceId: null, message: 'Registered camera connection tested', details: { deviceId: 'CAM-03', outcome: 'AUTHENTICATION_FAILED', adapter: 'ONVIF_RTSP', sourceClass: 'PRODUCTION', operationId: 'testCaptureDeviceConnection', guardTripped: true } },
      { type: 'CAPTURE_DEVICE_CONNECTION_TESTED', actorId: 'OPR-002', deviceId: null, message: 'Registered camera connection tested', details: { deviceId: 'CAM-03', outcome: 'AUTHENTICATION_FAILED', adapter: 'ONVIF_RTSP', sourceClass: 'PRODUCTION', operationId: 'testCaptureDeviceConnection', reason: 'SCHEME_NOT_ALLOWED' } },
    ],
    // Row R1b (C99): a camera absent inside a session - the session, the camera, its track, the attempt, the relay's loss number, both bounds, how it ended. No actor.
    CAPTURE_VIDEO_ABSENT_IN_SESSION: [
      { type: 'CAPTURE_VIDEO_ABSENT_IN_SESSION', actorId: null, deviceId: null, severity: 'WARNING', message: 'Video was not recorded while a camera of the session was absent', details: { sessionId: 'SES-20261001-0024', deviceId: 'CAM-01', trackId: 'VIDEO-01', attempt: 1, loss: 1, tries: 1, videoAbsentAtLeastMs: 3048, videoAbsentAtMostMs: 8049, ended: 'RE_OPENED' } },
      { type: 'CAPTURE_VIDEO_ABSENT_IN_SESSION', actorId: null, deviceId: null, severity: 'WARNING', message: 'Video was not recorded while a camera of the session was absent', details: { sessionId: 'SES-20261001-0024', deviceId: 'CAM-02', trackId: 'VIDEO-02', attempt: 2, loss: 3, videoAbsentAtLeastMs: 41000, videoAbsentAtMostMs: 46210, ended: 'NOT_RE_OPENED' } },
      { type: 'CAPTURE_VIDEO_ABSENT_IN_SESSION', actorId: null, deviceId: null, severity: 'WARNING', message: 'Video was not recorded while a camera of the session was absent', details: { sessionId: 'SES-20261001-0024', deviceId: 'CAM-01', trackId: 'VIDEO-01', attempt: 1, loss: 2, ended: 'NOT_RE_OPENED' } },
    ],
    // Row N2 (U25 (3), C110, C112 (3)): THE ACCOUNT of a microphone whose path is not sample-continuous, in the form with no number at
    // all (`NONE`: not measured). No actor; the row's device is the microphone. The forms WITH the thirteen numbers hold 19 and 20 keys,
    // which the audit writer refuses today (16 keys at most): they are held by the case of row N2 below, key by key, with that refusal stated.
    CAPTURE_AUDIO_SAMPLES_NOT_RECEIVED: [
      { type: 'CAPTURE_AUDIO_SAMPLES_NOT_RECEIVED', actorId: null, deviceId: null, severity: 'WARNING', message: 'Audio samples were not received from a microphone; the amount was not measured', details: { sessionId: 'SES-20261001-0024', attempt: 1, part: 1, captureLayer: 'AVFOUNDATION', captureGroup: 1, account: 'NONE', openRetries: 0 } },
      { type: 'CAPTURE_AUDIO_SAMPLES_NOT_RECEIVED', actorId: null, deviceId: null, severity: 'WARNING', message: 'Audio samples were not received from a microphone; the amount was not measured', details: { sessionId: 'SES-20261001-0024', attempt: 3, part: 2, captureLayer: 'AVFOUNDATION', captureGroup: 2, account: 'NONE', openRetries: 1 } },
    ],
    // Row N2 (C112 (3)): ONE LISTED RUN of inserted silence - the session, the attempt, the worker's number of the run, where it starts, how long it is.
    CAPTURE_AUDIO_SILENCE_INSERTED: [
      { type: 'CAPTURE_AUDIO_SILENCE_INSERTED', actorId: null, deviceId: null, severity: 'WARNING', message: 'Silence was inserted into the audio track in one piece', details: { sessionId: 'SES-20261001-0024', attempt: 1, index: 1, fromSample: 1_440_000, samples: 5_280 } },
      { type: 'CAPTURE_AUDIO_SILENCE_INSERTED', actorId: null, deviceId: null, severity: 'WARNING', message: 'Silence was inserted into the audio track in one piece', details: { sessionId: 'SES-20261001-0024', attempt: 1, index: 1024, fromSample: 0, samples: 4_800 } },
    ],
    // Row RD2 (decision C147): a camera retired with its stored credential destroyed; a microphone, which has none.
    CAPTURE_DEVICE_RETIRED: [
      { type: 'CAPTURE_DEVICE_RETIRED', actorId: 'OPR-003', deviceId: 'CAM-03', message: 'Device retired: CAM-03', details: { deviceId: 'CAM-03', kind: 'CAMERA', reason: 'STATEMENT_CHANGED', credentialDestroyed: true, streamRowsKept: 2, operationId: 'retireCaptureDevice', permission: 'CAPTURE_COMMISSION' } },
      { type: 'CAPTURE_DEVICE_RETIRED', actorId: 'OPR-003', deviceId: 'MIC-03', message: 'Device retired: MIC-03', details: { deviceId: 'MIC-03', kind: 'MIC', reason: 'REMOVED', credentialDestroyed: false, streamRowsKept: 0, operationId: 'retireCaptureDevice' } },
    ],
    // Row D53 (decisions D51, D53): a live camera preview session opened, by an investigator (SESSION_START) and without the optional permission.
    CAMERA_PREVIEW_OPENED: [
      { type: 'CAMERA_PREVIEW_OPENED', actorId: 'OPR-001', deviceId: 'CAM-03', message: 'Live camera preview opened for CAM-03', details: { deviceId: 'CAM-03', expiresAt: 1_790_825_000_000, operationId: 'createCameraPreviewSession', permission: 'SESSION_START' } },
      { type: 'CAMERA_PREVIEW_OPENED', actorId: 'OPR-003', deviceId: 'CAM-01', message: 'Live camera preview opened for CAM-01', details: { deviceId: 'CAM-01', expiresAt: 1_790_825_000_000, operationId: 'createCameraPreviewSession' } },
    ],
  };

  // REVISED 2026-11-02 (principal): RB-9 amended — 43 + the three of the vendor-only operations = 46.
  it('covers exactly the forty-seven types the server writes; the simulator\'s 44 have no list', () => {
    const typed = Object.keys(SERVER_AUDIT_DETAIL_RULES).sort();
    expect(typed).toEqual(Object.keys(accepted).sort());
    // Task 4 blueprint row 19: 23 + the ten of the hardware-input port = 33; the simulator's 44 do not move.
    // Task 4 blueprint row 201 (X-C): + OPERATOR_PASSWORD_SET = 34; the 44 still do not move (SYSTEM_BOOT stays one of them).
    // Task 4 row V3 (the third vocabulary step): + the four of that step = 38; the 44 still do not move.
    // Task 4 row R1b (decision C99): + CAPTURE_VIDEO_ABSENT_IN_SESSION = 39; the 44 still do not move.
    // Task 4 row N2: + CAPTURE_AUDIO_SAMPLES_NOT_RECEIVED, CAPTURE_AUDIO_SILENCE_INSERTED = 41; the 44 still do not move.
    // Task 4 row RD2: + CAPTURE_DEVICE_RETIRED = 42; the 44 still do not move.
    // Task 4 row D53: + CAMERA_PREVIEW_OPENED = 43; the 44 still do not move.
    // REVISED 2026-11-02 (principal): RB-9 amended: + USER_CREATED, USER_UPDATED, USER_DELETED = 46; the 44 still do not move.
    // D57 (2026-11-03, principal): + PANEL_SETUP_CHANGED = 47; the 44 still do not move (the Core's
    // console module writes it; the simulator never sees the panel backend).
    expect(typed).toHaveLength(47);
    expect(Object.values(AuditType).filter((type) => detailRulesOf(type) === undefined)).toHaveLength(44);
    for (const type of typed) expect(Object.values(AuditType)).toContain(type);
  });

  it('the keys of each type are those of the specification\'s table', () => {
    const keys = Object.fromEntries(Object.entries(SERVER_AUDIT_DETAIL_RULES).map(([type, rules]) => [type, Object.keys(rules)]));
    const required = Object.fromEntries(
      Object.entries(SERVER_AUDIT_DETAIL_RULES).map(([type, rules]) => [type, Object.entries(rules).filter(([, rule]) => rule.required).map(([key]) => key)]),
    );
    expect(keys).toEqual({
      ACCESS_DENIED: ['operationId', 'permission', 'role', 'reason'],
      PANEL_SETUP_CHANGED: ['satkerChanged', 'clientChanged', 'logoQueued', 'logoTarget', 'reason'],
      PAIRING_CODE_ISSUED: ['codeId', 'expiresAt'],
      PAIRING_CODE_CLOSED: ['codeId', 'reason'],
      DEVICE_REVOKED: ['reason', 'sessionsEnded', 'deviceId'],
      DEVICE_CREDENTIAL_ROTATED: ['deviceId'],
      ROLE_CHANGED: ['targetOperatorId', 'from', 'to', 'reason'],
      USER_ENABLED: ['targetOperatorId', 'reason'],
      USER_DISABLED: ['targetOperatorId', 'sessionsEnded', 'reason'],
      // RB-9 as amended (02-11-2026): the three key lists of the vendor-only operations.
      USER_CREATED: ['targetOperatorId', 'role', 'reason'],
      USER_UPDATED: ['targetOperatorId', 'fields', 'reason'],
      USER_DELETED: ['targetOperatorId', 'role', 'sessionsEnded', 'auditRowsRemoved', 'signInRowsRemoved', 'recordsLeftUnattributed', 'credentialsRemoved', 'reason'],
      BIOMETRIC_ENROLLMENT_CHANGED: ['enabled', 'deviceId'],
      CAPTURE_CONFIG_CHANGED: ['operationId', 'scope', 'field', 'trackId', 'inputId', 'deviceId', 'from', 'to', 'permission'],
      AUDIO_SOURCE_SWITCHED: ['fromInput', 'toInput', 'fromMs', 'toMs', 'sendingDeviceId'],
      CAMERA_POE_CYCLED: ['deviceId', 'poePort', 'streamWasLost', 'confirmed', 'gapFromMs', 'gapToMs'],
      TRANSCRIPT_REVISED: ['revisionId', 'authorId', 'number', 'baseRevision', 'changeCount', 'machineTranscriptHash', 'reason', 'permission'],
      MIC_SILENT: ['inputId', 'thresholdDbfs', 'durationMs', 'sinceMs', 'active'],
      EVIDENCE_MEDIA_SERVED: ['fileId', 'bytesServed', 'rangeStart', 'rangeEnd', 'signed', 'expiresAt'],
      EVIDENCE_EXPORT_FAILED: ['jobId', 'kind', 'reason'],
      CAPTURE_CREDENTIAL_SET: ['deviceId', 'operationId', 'permission'],
      CAPTURE_CREDENTIAL_REVEALED: ['deviceId', 'reason'],
      STT_CONFIG_CHANGED: ['changedFields', 'enabled', 'backend', 'credentialChanged', 'revision'],
      // C3 §5.2 (blueprint row 132): the key lists "12 + 11 + 10 + 6" of erratum PE-128-39.
      CAPTURE_DISCOVERY_SEARCHED: ['searchId', 'scope', 'trigger', 'outcome', 'responderCount', 'newCount', 'registeredCount', 'interfaceCount', 'failureReason', 'sessionId', 'operationId', 'permission'],
      // `reason`: fix wave I (G70b-05) - optional, only on the row of a scheme refusal (the credential was not sent).
      CAPTURE_CONNECTION_TESTED: ['candidateId', 'searchId', 'outcome', 'authenticated', 'adapter', 'sourceClass', 'operationId', 'host', 'endpointRef', 'guardTripped', 'reason', 'permission'],
      CAPTURE_CANDIDATE_ADOPTED: ['deviceId', 'candidateId', 'searchId', 'adapter', 'sourceClass', 'credentialSet', 'operationId', 'host', 'endpointRef', 'permission'],
      CAPTURE_DEVICE_UNREACHABLE: ['deviceId', 'deviceKind', 'phase', 'reason', 'degraded', 'sessionId'],
      // Task 4 blueprint row 19 (WP-23a): the ten closed lists.
      CAPTURE_AUDIO_INPUT_CHANGED: ['deviceId', 'change', 'inputNumber', 'channelCount', 'operationId', 'permission'],
      CAPTURE_NETWORK_CONFIG_CHANGED: ['changedFields', 'revision', 'onvifPortCount', 'operationId', 'permission'],
      HOST_ALIAS_ADDED: ['aliasId', 'address', 'reason', 'expiresAt', 'operationId', 'permission'],
      HOST_ALIAS_REMOVED: ['aliasId', 'address', 'removeReason', 'operationId', 'permission'],
      HOST_ALIAS_REMOVE_FAILED: ['aliasId', 'address', 'removeReason', 'failureReason', 'operationId', 'permission'],
      CAMERA_FACTORY_SCANNED: ['outcome', 'addressCount', 'responderCount', 'searchId', 'aliasId', 'failureReason', 'operationId', 'permission'],
      CAMERA_NETWORK_SET: ['phase', 'fromAddress', 'toAddress', 'mac', 'deviceId', 'candidateId', 'aliasId', 'deviceCount', 'failureReason', 'guardTripped', 'operationId', 'permission'],
      CAPTURE_DEVICE_ADDRESS_CHANGED: ['deviceId', 'fromAddress', 'toAddress', 'reason', 'operationId', 'permission'],
      INSTALLATION_ACCEPTED: ['acceptanceId', 'stepCount', 'passedCount', 'operationId', 'permission'],
      INSTALLATION_ACCEPTANCE_REVOKED: ['acceptanceId', 'operationId', 'permission'],
      // Task 4 blueprint row 201 (X-C; SX-14): the one closed list of the password command.
      OPERATOR_PASSWORD_SET: ['targetOperatorId', 'method', 'sessionsEnded', 'earlierWasDemo', 'invokerUid'],
      // Task 4 row V3 (the third vocabulary step): the four closed lists of that step.
      HOST_ALIAS_REQUESTED: ['action', 'address', 'reason', 'removeReason', 'minutes', 'aliasId', 'operationId', 'permission'],
      HOST_ALIAS_ADD_FAILED: ['address', 'reason', 'failureReason', 'aliasId', 'operationId', 'permission'],
      CAPTURE_AUDIO_ABSENT_ON_RESTART: ['sessionId', 'earlierAttempt', 'laterAttempt', 'audioAbsentAtLeastMs', 'audioAbsentAtMostMs'],
      // Row V4 (C75 (1)): + `unreachableReason` and `usableProfileCount`, both optional.
      // Rows PR, V7 (decision C117): + the closed word `profiles` and its three counts, before `permission`.
      CAPTURE_DEVICE_CONNECTION_TESTED: ['deviceId', 'outcome', 'adapter', 'sourceClass', 'operationId', 'guardTripped', 'reason', 'unreachableReason', 'usableProfileCount', 'profiles', 'storedProfileCount', 'statedProfileCount', 'differingProfileCount', 'permission'],
      // Task 4 row R1b (decision C99): the one closed list of a camera absent inside a session.
      CAPTURE_VIDEO_ABSENT_IN_SESSION: ['sessionId', 'deviceId', 'trackId', 'attempt', 'loss', 'tries', 'videoAbsentAtLeastMs', 'videoAbsentAtMostMs', 'ended'],
      // Task 4 row N2 (design 06 revision 3, section 8.4): the two closed lists of an audio path that is not sample-continuous - 20 details and 5.
      CAPTURE_AUDIO_SAMPLES_NOT_RECEIVED: [
        // Row V7 (decision C119 (1)): + `part` - the account is two entries, each within the writer's bound of 16 keys.
        'sessionId', 'attempt', 'part', 'captureLayer', 'captureGroup', 'account', 'openRetries',
        'timelineSamples', 'receivedSamples', 'insertedSamples', 'discardedSamples', 'bufferedSamples', 'nonFiniteSamples',
        'fedSamples', 'fedInsertedSamples', 'fedRuns', 'fedLongestRunSamples', 'listedRuns', 'runsNotListed', 'runsNotListedSamples', 'openRunFromSample',
      ],
      CAPTURE_AUDIO_SILENCE_INSERTED: ['sessionId', 'attempt', 'index', 'fromSample', 'samples'],
      CAPTURE_DEVICE_RETIRED: ['deviceId', 'kind', 'reason', 'credentialDestroyed', 'streamRowsKept', 'operationId', 'permission'],
      CAMERA_PREVIEW_OPENED: ['deviceId', 'expiresAt', 'operationId', 'permission'],
    });
    expect(required).toEqual({
      ACCESS_DENIED: ['operationId'],
      // D57: the three facts are always told; where the logo went and why are the caller's words.
      PANEL_SETUP_CHANGED: ['satkerChanged', 'clientChanged', 'logoQueued'],
      PAIRING_CODE_ISSUED: ['codeId', 'expiresAt'],
      PAIRING_CODE_CLOSED: ['codeId', 'reason'],
      DEVICE_REVOKED: ['reason', 'sessionsEnded'],
      DEVICE_CREDENTIAL_ROTATED: [],
      ROLE_CHANGED: ['targetOperatorId', 'from', 'to'],
      USER_ENABLED: ['targetOperatorId'],
      USER_DISABLED: ['targetOperatorId', 'sessionsEnded'],
      // RB-9 as amended (02-11-2026): what each of the three must carry.
      USER_CREATED: ['targetOperatorId', 'role'],
      USER_UPDATED: ['targetOperatorId', 'fields'],
      USER_DELETED: ['targetOperatorId', 'role', 'sessionsEnded', 'auditRowsRemoved', 'signInRowsRemoved', 'recordsLeftUnattributed', 'credentialsRemoved'],
      BIOMETRIC_ENROLLMENT_CHANGED: ['enabled'],
      CAPTURE_CONFIG_CHANGED: ['operationId', 'scope', 'field'],
      AUDIO_SOURCE_SWITCHED: ['fromInput', 'toInput', 'fromMs', 'toMs'],
      CAMERA_POE_CYCLED: ['deviceId', 'poePort', 'streamWasLost', 'confirmed'],
      TRANSCRIPT_REVISED: ['revisionId', 'authorId', 'number', 'baseRevision', 'changeCount', 'machineTranscriptHash'],
      MIC_SILENT: ['inputId', 'thresholdDbfs', 'durationMs', 'sinceMs', 'active'],
      EVIDENCE_MEDIA_SERVED: ['fileId', 'bytesServed', 'signed'],
      EVIDENCE_EXPORT_FAILED: ['jobId', 'kind', 'reason'],
      CAPTURE_CREDENTIAL_SET: ['deviceId', 'operationId'],
      CAPTURE_CREDENTIAL_REVEALED: ['deviceId', 'reason'],
      STT_CONFIG_CHANGED: ['changedFields', 'enabled', 'backend', 'credentialChanged', 'revision'],
      CAPTURE_DISCOVERY_SEARCHED: ['searchId', 'scope', 'trigger', 'outcome', 'responderCount', 'newCount', 'registeredCount', 'interfaceCount'],
      CAPTURE_CONNECTION_TESTED: ['candidateId', 'searchId', 'outcome', 'authenticated', 'adapter', 'sourceClass', 'operationId'],
      CAPTURE_CANDIDATE_ADOPTED: ['deviceId', 'candidateId', 'searchId', 'adapter', 'sourceClass', 'credentialSet', 'operationId'],
      CAPTURE_DEVICE_UNREACHABLE: ['deviceId', 'deviceKind', 'phase', 'reason', 'degraded', 'sessionId'],
      CAPTURE_AUDIO_INPUT_CHANGED: ['deviceId', 'change', 'inputNumber', 'channelCount'],
      CAPTURE_NETWORK_CONFIG_CHANGED: ['changedFields', 'revision'],
      HOST_ALIAS_ADDED: ['aliasId', 'address', 'reason', 'expiresAt'],
      // Row V4 (C74): `aliasId` left the required keys of the two removal results (a row-less boot sweep has no row id).
      HOST_ALIAS_REMOVED: ['address', 'removeReason'],
      HOST_ALIAS_REMOVE_FAILED: ['address', 'removeReason', 'failureReason'],
      CAMERA_FACTORY_SCANNED: ['outcome', 'addressCount', 'responderCount'],
      CAMERA_NETWORK_SET: ['phase', 'fromAddress', 'toAddress'],
      CAPTURE_DEVICE_ADDRESS_CHANGED: ['deviceId', 'fromAddress', 'toAddress', 'reason'],
      INSTALLATION_ACCEPTED: ['acceptanceId', 'stepCount', 'passedCount'],
      INSTALLATION_ACCEPTANCE_REVOKED: ['acceptanceId'],
      OPERATOR_PASSWORD_SET: ['targetOperatorId', 'method', 'sessionsEnded', 'earlierWasDemo'],
      HOST_ALIAS_REQUESTED: ['action', 'address'],
      HOST_ALIAS_ADD_FAILED: ['address', 'reason', 'failureReason'],
      CAPTURE_AUDIO_ABSENT_ON_RESTART: ['sessionId', 'earlierAttempt', 'laterAttempt'],
      CAPTURE_DEVICE_CONNECTION_TESTED: ['deviceId', 'outcome', 'adapter', 'sourceClass', 'operationId'],
      CAPTURE_VIDEO_ABSENT_IN_SESSION: ['sessionId', 'deviceId', 'trackId', 'attempt', 'loss', 'ended'],
      CAPTURE_AUDIO_SAMPLES_NOT_RECEIVED: ['sessionId', 'attempt', 'part', 'captureLayer', 'captureGroup', 'account', 'openRetries'],
      CAPTURE_AUDIO_SILENCE_INSERTED: ['sessionId', 'attempt', 'index', 'fromSample', 'samples'],
      CAPTURE_DEVICE_RETIRED: ['deviceId', 'kind', 'reason', 'credentialDestroyed', 'streamRowsKept', 'operationId'],
      CAMERA_PREVIEW_OPENED: ['deviceId', 'expiresAt', 'operationId'],
    });
  });

  it('task 4 row D53 (decisions D51, D53): CAMERA_PREVIEW_OPENED is the last type, category DEVICE; accepted in its stated forms; refuses a token, a URL, an address, a credential and a value outside its form', () => {
    expect(Object.values(AuditType).at(-1)).toBe('CAMERA_PREVIEW_OPENED');
    expect(AUDIT_TYPE_CATEGORY.CAMERA_PREVIEW_OPENED).toBe('DEVICE');
    const withDetail = (item: AuditEntry, key: string, value: unknown): AuditEntry => ({ ...item, details: { ...item.details, [key]: value } as AuditEntry['details'] });
    const without = (item: AuditEntry, key: string): AuditEntry => ({ ...item, details: Object.fromEntries(Object.entries(item.details ?? {}).filter(([name]) => name !== key)) as AuditEntry['details'] });
    const codeOf = (run: () => unknown): string => {
      try {
        run();
      } catch (error) {
        return (error as { code?: string }).code ?? 'threw';
      }
      return 'accepted';
    };
    const [held, plain] = accepted['CAMERA_PREVIEW_OPENED'] as [AuditEntry, AuditEntry];
    for (const item of [held, plain]) expect(codeOf(() => auditInputOf(item)), item.deviceId ?? '').toBe('accepted');
    for (const key of ['token', 'url', 'path', 'host', 'address', 'username', 'secret', 'sessionToken']) {
      expect(codeOf(() => auditInputOf(withDetail(held, key, 'cps_x'))), key).not.toBe('accepted');
    }
    for (const key of ['deviceId', 'expiresAt', 'operationId']) expect(codeOf(() => auditInputOf(without(held, key))), key).not.toBe('accepted');
    for (const [key, value] of [['deviceId', 'cam-03'], ['deviceId', '192.168.10.101'], ['expiresAt', -1], ['expiresAt', 'soon'], ['operationId', 'createEvidenceMediaSession']] as const) {
      expect(codeOf(() => auditInputOf(withDetail(held, key, value))), `${key} ${String(value)}`).not.toBe('accepted');
    }
  });

  it('task 4 row RD2 (C147): CAPTURE_DEVICE_RETIRED is the last type, category SECURITY; accepted in its stated forms (the shared builder\'s output); refuses an address, a hardware id, a serial, a credential, free text and a value outside its form', () => {
    // MUTATIONS THIS CASE WAS SEEN RED ON: `kind` given the word POE; `deviceId` taken as any hardware id; `reason` taken as a code.
    // Row D53: one type joined the end (86 -> 87); the position moves by that delta of one.
    expect(Object.values(AuditType).at(-2)).toBe('CAPTURE_DEVICE_RETIRED');
    expect(AUDIT_TYPE_CATEGORY.CAPTURE_DEVICE_RETIRED).toBe('SECURITY');
    const withDetail = (item: AuditEntry, key: string, value: unknown): AuditEntry => ({ ...item, details: { ...item.details, [key]: value } as AuditEntry['details'] });
    const without = (item: AuditEntry, key: string): AuditEntry => ({ ...item, details: Object.fromEntries(Object.entries(item.details ?? {}).filter(([name]) => name !== key)) as AuditEntry['details'] });
    const codeOf = (run: () => unknown): string => {
      try {
        run();
      } catch (error) {
        return (error as { code?: string }).code ?? 'threw';
      }
      return 'accepted';
    };
    const [camera, microphone] = accepted['CAPTURE_DEVICE_RETIRED'] as [AuditEntry, AuditEntry];
    for (const item of [camera, microphone]) {
      expect(codeOf(() => auditInputOf(item)), item.deviceId ?? '').toBe('accepted');
      const { row } = appendAudit({ rows: [], head: GENESIS, total: 0, dropped: 0 }, auditInputOf(item), 1);
      expect([row.type, row.category]).toEqual(['CAPTURE_DEVICE_RETIRED', 'SECURITY']);
    }
    // The shared builder writes exactly the accepted form.
    expect(captureDeviceRetiredDetails({ deviceId: 'CAM-03', kind: 'CAMERA', reason: 'STATEMENT_CHANGED', credentialDestroyed: true, streamRowsKept: 2, permission: 'CAPTURE_COMMISSION' })).toEqual(camera.details);
    // No locator, no identity of the unit, no credential, no free text: no such key exists.
    for (const key of ['host', 'address', 'endpointRef', 'url', 'onvifUuid', 'mac', 'usbSerial', 'usbPort', 'cardId', 'model', 'firmware', 'username', 'password', 'secret', 'note', 'text', 'previousDeviceId', 'retiredBy']) {
      // Off the list, or one of the names the general rule forbids for every type (a credential, an identity of a unit).
      expect(codeOf(() => auditInputOf(withDetail(camera, key, 'x'))), key).toMatch(/^AUDIT_DETAIL_KEY_(NOT_ALLOWED|FORBIDDEN)$/);
    }
    for (const key of ['deviceId', 'kind', 'reason', 'credentialDestroyed', 'streamRowsKept', 'operationId']) expect(codeOf(() => auditInputOf(without(camera, key))), key).not.toBe('accepted');
    for (const [key, value] of [
      ['deviceId', 'POE-SWITCH'], ['deviceId', 'CND-000000000001'], ['deviceId', '192.168.10.101'],
      ['kind', 'POE'], ['kind', 'camera'],
      ['reason', 'BROKEN'], ['reason', 'The camera fell off the wall.'],
      ['credentialDestroyed', 'yes'], ['streamRowsKept', -1], ['streamRowsKept', 1.5],
      ['operationId', 'testCaptureDeviceConnection'],
    ] as const) expect(codeOf(() => auditInputOf(withDetail(camera, key, value))), `${key} ${String(value)}`).not.toBe('accepted');
  });

  it('task 4 row N2 (U25 (3), C110, C112 (3)): the two types of an audio path that is not sample-continuous are the last two, category DEVICE; accepted in their stated forms; refuse a foreign key, device or card text, a percentage, a value outside its form; their sets and bounds are the manifest\'s', () => {
    // MUTATIONS THIS CASE WAS SEEN RED ON: the bound of `bufferedSamples` raised to one day; `samples` of a run admitted from 0; `captureLayer` given a second word.
    const TYPES = ['CAPTURE_AUDIO_SAMPLES_NOT_RECEIVED', 'CAPTURE_AUDIO_SILENCE_INSERTED'] as const;
    // Row RD2: one type joined the end (85 -> 86); the positions move by that delta of one. Row D53: one more (86 -> 87).
    expect(Object.values(AuditType).slice(-4, -2)).toEqual([...TYPES]);
    expect(TYPES.map((type) => AUDIT_TYPE_CATEGORY[type])).toEqual(['DEVICE', 'DEVICE']);
    const withDetail = (item: AuditEntry, key: string, value: unknown): AuditEntry => ({ ...item, details: { ...item.details, [key]: value } as AuditEntry['details'] });
    const without = (item: AuditEntry, key: string): AuditEntry => ({ ...item, details: Object.fromEntries(Object.entries(item.details ?? {}).filter(([name]) => name !== key)) as AuditEntry['details'] });
    const codeOf = (run: () => unknown): string => {
      try {
        run();
      } catch (error) {
        return (error as { code?: string }).code ?? 'threw';
      }
      return 'accepted';
    };
    for (const type of TYPES) {
      for (const item of accepted[type] ?? []) {
        expect(codeOf(() => auditInputOf(item)), type).toBe('accepted');
        const { row } = appendAudit({ rows: [], head: GENESIS, total: 0, dropped: 0 }, auditInputOf(item), 1);
        expect([row.type, row.category], type).toEqual([type, 'DEVICE']);
        expect(Object.keys(row.details).sort(), type).toEqual(Object.keys(item.details ?? {}).sort());
      }
    }
    const account = accepted['CAPTURE_AUDIO_SAMPLES_NOT_RECEIVED']?.[0] as AuditEntry;
    const run = accepted['CAPTURE_AUDIO_SILENCE_INSERTED']?.[0] as AuditEntry;
    // No device text, no card text, no file name, no percentage, no operation: no such key exists in either list.
    for (const key of ['deviceId', 'micDeviceId', 'cardId', 'cardName', 'usbPort', 'usbSerial', 'deviceName', 'file', 'percent', 'shortfallPercent', 'ratio', 'role', 'operationId', 'permission', 'insertedRuns']) {
      for (const item of [account, run]) expect(codeOf(() => auditInputOf(withDetail(item, key, 'x'))), `${item.type}.${key}`).toBe('AUDIT_DETAIL_KEY_NOT_ALLOWED');
    }
    // A key of one type is no key of the other: the run has no count of an account, the account no position of a run.
    for (const key of ['index', 'fromSample', 'samples']) expect(codeOf(() => auditInputOf(withDetail(account, key, 4_800))), key).toBe('AUDIT_DETAIL_KEY_NOT_ALLOWED');
    for (const key of ['account', 'timelineSamples', 'captureGroup']) expect(codeOf(() => auditInputOf(withDetail(run, key, 1))), key).toBe('AUDIT_DETAIL_KEY_NOT_ALLOWED');
    // THE ACCOUNT: six keys are required; the thirteen numbers and the open run are optional, key by key (the row's writer states all thirteen or none).
    for (const key of ['sessionId', 'attempt', 'part', 'captureLayer', 'captureGroup', 'account', 'openRetries']) expect(codeOf(() => auditInputOf(without(account, key))), key).not.toBe('accepted');
    for (const part of [0, 3, '1', 1.5, null]) expect(codeOf(() => auditInputOf(withDetail(account, 'part', part))), `part ${String(part)}`).not.toBe('accepted');
    const accountRules = SERVER_AUDIT_DETAIL_RULES.CAPTURE_AUDIO_SAMPLES_NOT_RECEIVED as Readonly<Record<string, DetailRule>>;
    for (const key of [...CAPTURE_AUDIO_ACCOUNT_NUMBER_KEYS, 'openRunFromSample']) {
      expect(accountRules[key]?.required, key).toBe(false);
      expect(codeOf(() => auditInputOf(withDetail(account, key, 0))), key).toBe('accepted');
    }
    expect([...CAPTURE_AUDIO_ACCOUNT_NUMBER_KEYS]).toHaveLength(13);
    for (const key of CAPTURE_AUDIO_ACCOUNT_NUMBER_KEYS) expect(Object.keys(SERVER_AUDIT_DETAIL_RULES.CAPTURE_AUDIO_SAMPLES_NOT_RECEIVED), key).toContain(key);
    // THE RUN: all five are required.
    for (const key of ['sessionId', 'attempt', 'index', 'fromSample', 'samples']) expect(codeOf(() => auditInputOf(without(run, key))), key).not.toBe('accepted');
    const refusedOfAccount: ReadonlyArray<readonly [string, unknown]> = [
      ['sessionId', 'session 24'],
      ['attempt', 0],
      ['attempt', '1'],
      ['captureLayer', 'ALSA'],
      ['captureLayer', 'avfoundation'],
      ['captureGroup', 0],
      ['captureGroup', 3],
      ['captureGroup', '1'],
      ['account', 'OPEN'],
      ['account', true],
      ['openRetries', 2],
      ['openRetries', -1],
      ['timelineSamples', -1],
      ['timelineSamples', 0.5],
      ['timelineSamples', '2880000'],
      ['timelineSamples', CAPTURE_AUDIO_DAY_SAMPLES + 1],
      ['receivedSamples', CAPTURE_AUDIO_DAY_SAMPLES + 1],
      ['insertedSamples', null],
      ['bufferedSamples', CAPTURE_AUDIO_BUFFERED_MAX_SAMPLES + 1],
      ['listedRuns', CAPTURE_AUDIO_INSERTED_RUNS_MAX + 1],
      ['fedRuns', 1.5],
      ['openRunFromSample', -1],
      ['openRunFromSample', 'none'],
    ];
    for (const [key, value] of refusedOfAccount) expect(codeOf(() => auditInputOf(withDetail(account, key, value))), `${key} ${String(value)}`).not.toBe('accepted');
    const refusedOfRun: ReadonlyArray<readonly [string, unknown]> = [
      ['index', 0],
      ['index', CAPTURE_AUDIO_INSERTED_RUNS_MAX + 1],
      ['fromSample', -1],
      ['fromSample', CAPTURE_AUDIO_DAY_SAMPLES + 1],
      ['samples', CAPTURE_AUDIO_INSERTED_RUN_MIN_SAMPLES - 1],
      ['samples', 0],
      ['samples', CAPTURE_AUDIO_DAY_SAMPLES + 1],
      ['samples', '4800'],
    ];
    for (const [key, value] of refusedOfRun) expect(codeOf(() => auditInputOf(withDetail(run, key, value))), `${key} ${String(value)}`).not.toBe('accepted');
    // The bounds themselves pass.
    expect(codeOf(() => auditInputOf(withDetail(withDetail(account, 'bufferedSamples', CAPTURE_AUDIO_BUFFERED_MAX_SAMPLES), 'timelineSamples', CAPTURE_AUDIO_DAY_SAMPLES)))).toBe('accepted');
    expect(codeOf(() => auditInputOf(withDetail(withDetail(run, 'samples', CAPTURE_AUDIO_DAY_SAMPLES), 'fromSample', CAPTURE_AUDIO_DAY_SAMPLES)))).toBe('accepted');
    // `audio.samplesNotReceived` of the manifest (fields 139-158) states what these two types state: the same words, the same bounds, the same names.
    expect([CAPTURE_AUDIO_DAY_SAMPLES, CAPTURE_AUDIO_BUFFERED_MAX_SAMPLES, CAPTURE_AUDIO_INSERTED_RUN_MIN_SAMPLES, CAPTURE_AUDIO_INSERTED_RUNS_MAX, CAPTURE_AUDIO_CAPTURE_GROUP_MAX, CAPTURE_AUDIO_OPEN_RETRIES_MAX]).toEqual([
      MANIFEST_AUDIO_DAY_SAMPLES,
      MANIFEST_AUDIO_BUFFERED_MAX_SAMPLES,
      MANIFEST_AUDIO_INSERTED_RUN_MIN_SAMPLES,
      MANIFEST_AUDIO_INSERTED_RUNS_MAX,
      MANIFEST_AUDIO_CAPTURE_GROUP_MAX,
      1,
    ]);
    expect([...CAPTURE_AUDIO_CAPTURE_LAYERS]).toEqual([...MANIFEST_AUDIO_CAPTURE_LAYERS]);
    expect([...CAPTURE_AUDIO_SAMPLE_ACCOUNTS]).toEqual([...MANIFEST_AUDIO_SAMPLE_ACCOUNTS]);
    // The thirteen numbers of the row are the twelve counts of the manifest record and `listedRuns`, which the manifest states as the length of its list.
    expect(CAPTURE_AUDIO_ACCOUNT_NUMBER_KEYS.filter((key) => key !== 'listedRuns')).toEqual([...MANIFEST_AUDIO_SAMPLE_COUNT_MEMBERS]);
    // THE ACCOUNT WITH ITS NUMBERS, as the design states it (section 8.4): a closed account of one minute that reconciles to the sample
    // (2,606,592 received + 273,408 inserted = 2,880,000 expected), and one that is not closed, with a run still open.
    const closed = { sessionId: 'SES-20261001-0024', attempt: 1, captureLayer: 'AVFOUNDATION', captureGroup: 1, account: 'CLOSED', openRetries: 0, timelineSamples: 2_880_000, receivedSamples: 2_606_592, insertedSamples: 273_408, discardedSamples: 0, bufferedSamples: 0, nonFiniteSamples: 0, fedSamples: 2_880_000, fedInsertedSamples: 273_408, fedRuns: 534, fedLongestRunSamples: 5_280, listedRuns: 1, runsNotListed: 0, runsNotListedSamples: 0 };
    const notClosed = { ...closed, attempt: 2, account: 'NOT_CLOSED', openRetries: 1, receivedSamples: 2_600_000, insertedSamples: 282_400, bufferedSamples: 2_400, fedSamples: 0, fedInsertedSamples: 0, fedRuns: 0, fedLongestRunSamples: 0, listedRuns: 0, openRunFromSample: 2_870_400 };
    // Every value of both has the form of its key, and every key is a key of the list.
    for (const details of [closed, notClosed]) for (const [key, value] of Object.entries(details)) expect(accountRules[key]?.accepts(value), `${details.account}.${key}`).toBe(true);
    // Row V7: the list holds one key more, `part`; the account itself still states 19 or 20.
    expect([Object.keys(closed).length, Object.keys(notClosed).length, Object.keys(accountRules).length]).toEqual([19, 20, 21]);
    // A FINDING OF ROW N2, STATED AS A TEST SO THAT IT CANNOT BE MISSED (`implementation/n2_mic_contract.md`, section 6): the audit
    // writer holds a native row to 16 keys (`NATIVE_PAYLOAD_KEYS_MAX`, `core/limits.ts`), and an account with its thirteen numbers holds
    // 19 or 20. So the writer REFUSES the designed row today - before it looks at one key. The same row cut to 16 keys is accepted: the
    // forms are right, the count stops it. The bound is the audit writer's and not this row's to move; when it is moved (or the list is
    // re-cut) this expectation turns red and is replaced by "accepted".
    const asRow = (details: Record<string, unknown>): AuditEntry => ({ ...account, details: details as AuditEntry['details'] });
    expect(NATIVE_PAYLOAD_KEYS_MAX).toBe(16);
    expect([codeOf(() => auditInputOf(asRow(closed))), codeOf(() => auditInputOf(asRow(notClosed)))]).toEqual(['AUDIT_DETAILS_NOT_FLAT', 'AUDIT_DETAILS_NOT_FLAT']);
    // Row V7: the cut to 16 keys lacks `part` since that row and is refused for it; with `part` (and one number less) it is accepted - the count was what stopped it.
    expect(codeOf(() => auditInputOf(asRow(Object.fromEntries(Object.entries(closed).slice(0, NATIVE_PAYLOAD_KEYS_MAX)))))).not.toBe('accepted');
    expect(codeOf(() => auditInputOf(asRow({ ...Object.fromEntries(Object.entries(closed).slice(0, NATIVE_PAYLOAD_KEYS_MAX - 1)), part: 1 })))).toBe('accepted');

    // ── ROW V7 (decision C119 (1); finding F-1 above): THE BOUND STAYS AND THE ACCOUNT IS TWO ENTRIES. ──────────────────────────────
    // MUTATIONS THIS BLOCK WAS SEEN RED ON: (1) `captureAudioAccountParts` putting `fedSamples` into part 1 as well (a part then holds a
    // number of the other: the join refuses, and part 1 no longer has its key count); (2) `captureAudioAccountOfParts` accepting one part alone.
    expect(NATIVE_PAYLOAD_KEYS_MAX).toBe(16);
    expect(CAPTURE_AUDIO_ACCOUNT_PARTS).toBe(2);
    expect([...CAPTURE_AUDIO_ACCOUNT_PART_NUMBER_KEYS[1], ...CAPTURE_AUDIO_ACCOUNT_PART_NUMBER_KEYS[2]]).toEqual([...CAPTURE_AUDIO_ACCOUNT_NUMBER_KEYS]);
    const none = { sessionId: 'SES-20261001-0024', attempt: 3, captureLayer: 'AVFOUNDATION', captureGroup: 2, account: 'NONE', openRetries: 1 };
    for (const whole of [closed, notClosed, none] as unknown as CaptureAudioAccount[]) {
      const parts = captureAudioAccountParts(whole);
      expect(parts.map((part) => part['part']), whole.account).toEqual([1, 2]);
      for (const part of parts) {
        // Each part is within the writer's bound, every key is a key of the list in its form, and THE WRITER ACCEPTS IT.
        expect(Object.keys(part).length, whole.account).toBeLessThanOrEqual(NATIVE_PAYLOAD_KEYS_MAX);
        for (const key of CAPTURE_AUDIO_ACCOUNT_PATH_KEYS) expect(Object.hasOwn(part, key), `${whole.account}.${key}`).toBe(true);
        expect(codeOf(() => auditInputOf(asRow(part))), `${whole.account} part ${String(part['part'])}`).toBe('accepted');
      }
      // The two parts hold the account between them, and nothing twice but the path.
      expect(Object.keys(parts[0]).filter((key) => Object.hasOwn(parts[1], key)).sort(), whole.account).toEqual([...CAPTURE_AUDIO_ACCOUNT_PATH_KEYS].sort());
      // THE JOIN gives the account back, key for key, in either order of the entries.
      expect(captureAudioAccountOfParts(parts), whole.account).toEqual({ ok: true, account: whole });
      expect(captureAudioAccountOfParts([parts[1], parts[0]]), whole.account).toEqual({ ok: true, account: whole });
    }
    expect(captureAudioAccountParts(closed as unknown as CaptureAudioAccount).map((part) => Object.keys(part).length)).toEqual([13, 14]);
    expect(captureAudioAccountParts(notClosed as unknown as CaptureAudioAccount).map((part) => Object.keys(part).length)).toEqual([14, 14]);
    expect(captureAudioAccountParts(none as unknown as CaptureAudioAccount).map((part) => Object.keys(part).length)).toEqual([7, 7]);
    // A MISSING PART IS NO ACCOUNT, and neither is a part twice, two parts of different accounts, or a part with a number of the other.
    const [one, two] = captureAudioAccountParts(closed as unknown as CaptureAudioAccount);
    expect(captureAudioAccountOfParts([one])).toEqual({ ok: false, reason: 'ACCOUNT_PART_MISSING' });
    expect(captureAudioAccountOfParts([two])).toEqual({ ok: false, reason: 'ACCOUNT_PART_MISSING' });
    expect(captureAudioAccountOfParts([])).toEqual({ ok: false, reason: 'ACCOUNT_PART_MISSING' });
    expect(captureAudioAccountOfParts([one, two, { ...two, part: 3 }])).toEqual({ ok: false, reason: 'ACCOUNT_PART_MISSING' });
    expect(captureAudioAccountOfParts([one, one, two])).toEqual({ ok: false, reason: 'ACCOUNT_PART_REPEATED' });
    for (const [key, value] of [['attempt', 2], ['account', 'NOT_CLOSED'], ['captureGroup', 2], ['openRetries', 1], ['sessionId', 'SES-20261001-0025']] as const) {
      expect(captureAudioAccountOfParts([one, { ...two, [key]: value }]), key).toEqual({ ok: false, reason: 'ACCOUNT_PARTS_DIFFER' });
    }
    expect(captureAudioAccountOfParts([{ ...one, fedSamples: 1 }, two])).toEqual({ ok: false, reason: 'ACCOUNT_PART_KEYS' });
    expect(captureAudioAccountOfParts([one, { ...two, openRunFromSample: 1 }])).toEqual({ ok: false, reason: 'ACCOUNT_PART_KEYS' });
    expect(captureAudioAccountOfParts([one, Object.fromEntries(Object.entries(two).filter(([key]) => key !== 'fedRuns'))])).toEqual({ ok: false, reason: 'ACCOUNT_PART_KEYS' });
    expect(captureAudioAccountOfParts([{ ...one, account: 'NONE' }, { ...two, account: 'NONE' }])).toEqual({ ok: false, reason: 'ACCOUNT_PART_KEYS' });
    // The writer's own rule, held at the cut: all thirteen numbers or none, and no number under NONE.
    expect(() => captureAudioAccountParts({ ...closed, fedRuns: undefined } as unknown as CaptureAudioAccount)).toThrow(TypeError);
    expect(() => captureAudioAccountParts({ ...closed, account: 'NONE' } as unknown as CaptureAudioAccount)).toThrow(TypeError);
    expect(() => captureAudioAccountParts({ ...none, openRunFromSample: 1 } as unknown as CaptureAudioAccount)).toThrow(TypeError);
    // The closed account IS a record the manifest accepts (the manifest has no such bound), and the run row a listed run.
    const { sessionId: _session, openRetries: _retries, listedRuns: _listed, ...numbers } = closed;
    expect(ManifestAudioSamplesNotReceivedSchema.safeParse({ micDeviceId: 'MIC-01', ...numbers, openRunFromSample: null, insertedRuns: [{ fromSample: 1_440_000, samples: 5_280 }] }).success).toBe(true);
    expect(ManifestAudioInsertedRunSchema.safeParse({ fromSample: 1_440_000, samples: CAPTURE_AUDIO_INSERTED_RUN_MIN_SAMPLES - 1 }).success).toBe(false);
  });

  it('task 4 row R1b (C99): CAPTURE_VIDEO_ABSENT_IN_SESSION is the last type, category DEVICE; accepted in its stated forms; refuses a foreign key, a locator, a profile, a cause, a value outside its form; its sets and bound are the manifest\'s', () => {
    // Row N2: two types follow it (83 -> 85); the position moves by that delta of two. Row RD2: one more (85 -> 86).
    expect(Object.values(AuditType).at(-5)).toBe('CAPTURE_VIDEO_ABSENT_IN_SESSION'); // row D53: + one (86 -> 87)
    expect([AUDIT_TYPE_CATEGORY.CAPTURE_VIDEO_ABSENT_IN_SESSION, AUDIT_TYPE_CATEGORY.CAPTURE_AUDIO_ABSENT_ON_RESTART, AUDIT_TYPE_CATEGORY.CAPTURE_DEVICE_UNREACHABLE]).toEqual(['DEVICE', 'DEVICE', 'DEVICE']);
    const rows = accepted['CAPTURE_VIDEO_ABSENT_IN_SESSION'] as AuditEntry[];
    const withDetail = (item: AuditEntry, key: string, value: unknown): AuditEntry => ({ ...item, details: { ...item.details, [key]: value } as AuditEntry['details'] });
    const without = (item: AuditEntry, key: string): AuditEntry => ({ ...item, details: Object.fromEntries(Object.entries(item.details ?? {}).filter(([name]) => name !== key)) as AuditEntry['details'] });
    const codeOf = (run: () => unknown): string => {
      try {
        run();
      } catch (error) {
        return (error as { code?: string }).code ?? 'threw';
      }
      return 'accepted';
    };
    for (const row of rows) expect(codeOf(() => auditInputOf(row))).toBe('accepted');
    const full = rows[0] as AuditEntry;
    for (const key of ['host', 'address', 'locator', 'profile', 'cause', 'heldBack', 'relayGapMs', 'lostAt', 'file', 'operationId', 'permission', 'earlierAttempt']) {
      expect(codeOf(() => auditInputOf(withDetail(full, key, 'x'))), key).toBe('AUDIT_DETAIL_KEY_NOT_ALLOWED');
    }
    for (const key of ['sessionId', 'deviceId', 'trackId', 'attempt', 'loss', 'ended']) expect(codeOf(() => auditInputOf(without(full, key))), key).not.toBe('accepted');
    for (const key of ['tries', 'videoAbsentAtLeastMs', 'videoAbsentAtMostMs']) expect(codeOf(() => auditInputOf(without(full, key))), key).toBe('accepted');
    const refusedForms: ReadonlyArray<readonly [string, unknown]> = [
      ['sessionId', 'session 24'],
      ['deviceId', 'MIC-01'],
      ['deviceId', '192.168.1.64'],
      ['trackId', 'VIDEO-05'],
      ['trackId', 'AUDIO-01'],
      ['attempt', 0],
      ['attempt', '1'],
      ['loss', 0],
      ['loss', 1.5],
      ['loss', 1_000_000_000],
      ['tries', 0],
      ['videoAbsentAtLeastMs', -1],
      ['videoAbsentAtLeastMs', 0.5],
      ['videoAbsentAtMostMs', 86_400_001],
      ['videoAbsentAtMostMs', 'without end'],
      ['ended', 'REOPENED'],
      ['ended', 'RE-OPENED'],
      ['ended', true],
    ];
    for (const [key, value] of refusedForms) expect(codeOf(() => auditInputOf(withDetail(full, key, value))), `${key} ${String(value)}`).not.toBe('accepted');
    expect(codeOf(() => auditInputOf(withDetail(withDetail(full, 'videoAbsentAtLeastMs', 0), 'videoAbsentAtMostMs', 86_400_000)))).toBe('accepted');
    // `tracks[].absentInSession` of the manifest (fields 134-138) states what this type states: the same bound, the same two words, the same tracks.
    expect(MANIFEST_VIDEO_ABSENT_MAX_MS).toBe(CAPTURE_VIDEO_ABSENT_MAX_MS);
    expect([...MANIFEST_VIDEO_ABSENCE_ENDS]).toEqual([...CAPTURE_VIDEO_ABSENCE_ENDS]);
    expect([...VIDEO_TRACK_IDS]).toEqual([...CAPTURE_VIDEO_ABSENT_TRACK_IDS]);
    const absence = { attempt: 1, loss: 1, absentAtLeastMs: CAPTURE_VIDEO_ABSENT_MAX_MS, absentAtMostMs: CAPTURE_VIDEO_ABSENT_MAX_MS, ended: 'RE_OPENED' };
    expect(ManifestVideoAbsenceSchema.safeParse(absence).success).toBe(true);
    expect(ManifestVideoAbsenceSchema.safeParse({ ...absence, absentAtMostMs: CAPTURE_VIDEO_ABSENT_MAX_MS + 1 }).success).toBe(false);
  });

  it('task 4 row V3 (C53, C57, C58): the four types of the third vocabulary step are accepted in their stated forms and refuse a foreign key, a credential, a locator, device text and a value outside its form', () => {
    const NEW_TYPES = ['HOST_ALIAS_REQUESTED', 'HOST_ALIAS_ADD_FAILED', 'CAPTURE_AUDIO_ABSENT_ON_RESTART', 'CAPTURE_DEVICE_CONNECTION_TESTED'] as const;
    // The four are the last of the vocabulary, in this order (78 -> 82), each in an existing category.
    // Row R1b: one type follows them (82 -> 83); the positions move by that delta of one.
    // Row N2: two more follow (83 -> 85); the positions move by that delta of two. Row RD2: one more (85 -> 86).
    expect(Object.values(AuditType).slice(-9, -5)).toEqual([...NEW_TYPES]); // row D53: + one (86 -> 87)
    expect(NEW_TYPES.map((type) => AUDIT_TYPE_CATEGORY[type])).toEqual(['SECURITY', 'SECURITY', 'DEVICE', 'SECURITY']);
    // As the existing types of their kind: the three alias types, the capture-fault types, the candidate's test.
    expect([AUDIT_TYPE_CATEGORY.HOST_ALIAS_ADDED, AUDIT_TYPE_CATEGORY.MIC_SILENT, AUDIT_TYPE_CATEGORY.CAPTURE_DEVICE_UNREACHABLE, AUDIT_TYPE_CATEGORY.CAPTURE_CONNECTION_TESTED]).toEqual(['SECURITY', 'DEVICE', 'DEVICE', 'SECURITY']);
    expect([[...HOST_ALIAS_REQUEST_ACTIONS], [...CAPTURE_DEVICE_CONNECTION_TEST_OPERATIONS], CAPTURE_AUDIO_ABSENT_MAX_MS]).toEqual([['ADD', 'REMOVE'], ['testCaptureDeviceConnection'], 86_400_000]);
    const withDetail = (item: AuditEntry, key: string, value: unknown): AuditEntry => ({ ...item, details: { ...item.details, [key]: value } as AuditEntry['details'] });
    const first = (type: string): AuditEntry => accepted[type]?.[0] as AuditEntry;
    for (const type of NEW_TYPES) {
      // The writer accepts every stated row of the type, and stores it in the type's category ...
      for (const item of accepted[type] ?? []) {
        expect(codeOf(() => auditInputOf(item)), type).toBe('accepted');
        const { row } = appendAudit({ rows: [], head: GENESIS, total: 0, dropped: 0 }, auditInputOf(item), 1);
        expect([row.type, row.category], type).toEqual([type, AUDIT_TYPE_CATEGORY[type]]);
        expect(Object.keys(row.details).sort(), type).toEqual(Object.keys(item.details ?? {}).sort());
      }
      // ... refuses a credential name by the key rule ...
      for (const key of ['username', 'secret', 'password', 'credential', 'onvifUuid', 'token']) expect(codeOf(() => auditInputOf(withDetail(first(type), key, 'x'))), `${type}.${key}`).toBe('AUDIT_DETAIL_KEY_FORBIDDEN');
      // ... and a locator, device text, a name of the host or free text by the list: no such key exists.
      for (const key of ['url', 'uri', 'rtspUrl', 'port', 'path', 'interfaceName', 'interface', 'subnet', 'model', 'vendor', 'product', 'name', 'error', 'errorText', 'helperOutput', 'line', 'note', 'message']) {
        expect(codeOf(() => auditInputOf(withDetail(first(type), key, 'x'))), `${type}.${key}`).toBe('AUDIT_DETAIL_KEY_NOT_ALLOWED');
      }
      // Each required key is required: a row without it is refused.
      for (const key of Object.entries(SERVER_AUDIT_DETAIL_RULES[type]).filter(([, rule]) => (rule as DetailRule).required).map(([name]) => name)) {
        const { [key]: _dropped, ...rest } = first(type).details as Record<string, unknown>;
        expect(codeOf(() => auditInputOf({ ...first(type), details: rest as AuditEntry['details'] })), `${type} without ${key}`).not.toBe('accepted');
      }
    }
    // The stored-credential test names its device by the registry id ONLY: the keys the candidate's row
    // has for an address, an announced reference, a candidate and "was a credential supplied" do not exist here.
    for (const key of ['host', 'endpointRef', 'address', 'candidateId', 'searchId', 'authenticated']) {
      expect(codeOf(() => auditInputOf(withDetail(first('CAPTURE_DEVICE_CONNECTION_TESTED'), key, 'x'))), key).toBe('AUDIT_DETAIL_KEY_NOT_ALLOWED');
    }
    // The audio gap is numbers and one id: no device, no card, no file.
    for (const key of ['deviceId', 'inputId', 'cardId', 'fileId', 'role', 'reason', 'operationId', 'permission']) {
      expect(codeOf(() => auditInputOf(withDetail(first('CAPTURE_AUDIO_ABSENT_ON_RESTART'), key, 'MIC-01'))), key).toBe('AUDIT_DETAIL_KEY_NOT_ALLOWED');
    }
    // The contract's own builder gives a row the writer accepts, with and without its optional members.
    const built = captureDeviceConnectionTestedDetails({ deviceId: 'CAM-01', outcome: 'AUTHENTICATION_FAILED', adapter: 'ONVIF_RTSP', sourceClass: 'PRODUCTION', guardTripped: true, reason: 'SCHEME_NOT_ALLOWED', permission: 'CAPTURE_CONFIG' });
    expect(codeOf(() => auditInputOf({ ...first('CAPTURE_DEVICE_CONNECTION_TESTED'), details: built as AuditEntry['details'] }))).toBe('accepted');
    // Row V4 (C75 (1)): a test that reached the reader and asked NO camera has an outcome entry too - UNREACHABLE and
    // the closed reason why nothing was sent; a camera that was asked states its count of usable profiles.
    const testedBase = { deviceId: 'CAM-01', adapter: 'ONVIF_RTSP', sourceClass: 'PRODUCTION' } as const;
    for (const unreachableReason of ['CREDENTIAL_NOT_READ', 'NOT_SENT'] as const) {
      const notAsked = captureDeviceConnectionTestedDetails({ ...testedBase, outcome: 'UNREACHABLE', unreachableReason, usableProfileCount: 0 });
      expect(notAsked).toEqual({ ...testedBase, outcome: 'UNREACHABLE', operationId: 'testCaptureDeviceConnection', unreachableReason });
      expect(codeOf(() => auditInputOf({ ...first('CAPTURE_DEVICE_CONNECTION_TESTED'), details: notAsked as AuditEntry['details'] })), unreachableReason).toBe('accepted');
    }
    const asked = captureDeviceConnectionTestedDetails({ ...testedBase, outcome: 'REACHABLE', usableProfileCount: 2, unreachableReason: 'NOT_SENT' });
    expect(asked).toEqual({ ...testedBase, outcome: 'REACHABLE', operationId: 'testCaptureDeviceConnection', usableProfileCount: 2 });
    expect(codeOf(() => auditInputOf({ ...first('CAPTURE_DEVICE_CONNECTION_TESTED'), details: asked as AuditEntry['details'] }))).toBe('accepted');
    for (const [key, value] of [['unreachableReason', 'TIMEOUT'], ['unreachableReason', 'no route to host'], ['unreachableReason', true], ['usableProfileCount', -1], ['usableProfileCount', 17], ['usableProfileCount', 1.5], ['usableProfileCount', '2'], ['usableProfileCount', 'H.264 main']] as const) {
      expect(codeOf(() => auditInputOf(withDetail(first('CAPTURE_DEVICE_CONNECTION_TESTED'), key, value))), `${key}=${String(value)}`).toBe('AUDIT_DETAIL_VALUE_INVALID');
    }
    for (const count of [0, 16]) expect(codeOf(() => auditInputOf(withDetail(first('CAPTURE_DEVICE_CONNECTION_TESTED'), 'usableProfileCount', count))), String(count)).toBe('accepted');
    // Rows PR, V7 (decision C117): what the test found about the camera's STORED profiles - a closed word and three counts, all four or none.
    // MUTATION SEEN RED: the builder emitting `profiles` without its counts.
    const stored = captureDeviceConnectionTestedDetails({ ...testedBase, outcome: 'REACHABLE', usableProfileCount: 2, profiles: 'PROFILES_STORED', storedProfileCount: 0, statedProfileCount: 2, differingProfileCount: 0 });
    expect(stored).toEqual({ ...testedBase, outcome: 'REACHABLE', operationId: 'testCaptureDeviceConnection', usableProfileCount: 2, profiles: 'PROFILES_STORED', storedProfileCount: 0, statedProfileCount: 2, differingProfileCount: 0 });
    const differs = captureDeviceConnectionTestedDetails({ ...testedBase, outcome: 'REACHABLE', usableProfileCount: 2, profiles: 'STREAM_PROFILE_DIFFERS', storedProfileCount: 1, statedProfileCount: 2, differingProfileCount: 3, permission: 'CAPTURE_CONFIG' });
    for (const details of [stored, differs]) expect(codeOf(() => auditInputOf({ ...first('CAPTURE_DEVICE_CONNECTION_TESTED'), details: details as AuditEntry['details'] }))).toBe('accepted');
    expect(Object.keys(differs).length).toBeLessThanOrEqual(NATIVE_PAYLOAD_KEYS_MAX);
    // The word without its numbers, a word outside the set, a count outside its bound, a test that asked no camera: none of the four is written.
    const plain = { ...testedBase, outcome: 'REACHABLE', operationId: 'testCaptureDeviceConnection', usableProfileCount: 2 };
    for (const facts of [
      { profiles: 'PROFILES_STORED' },
      { profiles: 'PROFILES_STORED', storedProfileCount: 0, statedProfileCount: 2 },
      { profiles: 'PROFILES_AGREE', storedProfileCount: 2, statedProfileCount: 2, differingProfileCount: 0 },
      { profiles: 'STREAM_PROFILE_DIFFERS', storedProfileCount: 17, statedProfileCount: 2, differingProfileCount: 1 },
      { storedProfileCount: 1, statedProfileCount: 2, differingProfileCount: 1 },
    ]) {
      expect(captureDeviceConnectionTestedDetails({ ...testedBase, outcome: 'REACHABLE', usableProfileCount: 2, ...facts } as never), JSON.stringify(facts)).toEqual(plain);
    }
    expect(captureDeviceConnectionTestedDetails({ ...testedBase, outcome: 'UNREACHABLE', unreachableReason: 'NOT_SENT', profiles: 'PROFILES_STORED', storedProfileCount: 0, statedProfileCount: 2, differingProfileCount: 0 })).toEqual({ ...testedBase, outcome: 'UNREACHABLE', operationId: 'testCaptureDeviceConnection', unreachableReason: 'NOT_SENT' });
    for (const [key, value] of [['profiles', 'PROFILES_AGREE'], ['profiles', 'HEVC_1080P'], ['profiles', true], ['storedProfileCount', 17], ['statedProfileCount', -1], ['differingProfileCount', '1']] as const) {
      expect(codeOf(() => auditInputOf(withDetail(first('CAPTURE_DEVICE_CONNECTION_TESTED'), key, value))), `${key}=${String(value)}`).toBe('AUDIT_DETAIL_VALUE_INVALID');
    }
    const invalid: Array<[string, string, unknown]> = [
      ['HOST_ALIAS_REQUESTED', 'action', 'add'],
      ['HOST_ALIAS_REQUESTED', 'action', 'DEL'],
      ['HOST_ALIAS_REQUESTED', 'address', '192.168.1.253/24'],
      ['HOST_ALIAS_REQUESTED', 'address', 'camera-1.local'],
      ['HOST_ALIAS_REQUESTED', 'address', 'add 192.168.1.253/24 30'],
      ['HOST_ALIAS_REQUESTED', 'reason', 'because'],
      ['HOST_ALIAS_REQUESTED', 'removeReason', 'FACTORY_SCAN'],
      ['HOST_ALIAS_REQUESTED', 'minutes', 4],
      ['HOST_ALIAS_REQUESTED', 'minutes', 481],
      ['HOST_ALIAS_REQUESTED', 'minutes', 30.5],
      ['HOST_ALIAS_REQUESTED', 'minutes', '30'],
      ['HOST_ALIAS_REQUESTED', 'aliasId', 'eth1'],
      ['HOST_ALIAS_ADD_FAILED', 'address', 'fe80::1'],
      ['HOST_ALIAS_ADD_FAILED', 'reason', 'EXPIRED'],
      ['HOST_ALIAS_ADD_FAILED', 'failureReason', 'RTNETLINK answers: File exists'],
      ['HOST_ALIAS_ADD_FAILED', 'failureReason', 'helper_failed'],
      ['HOST_ALIAS_ADD_FAILED', 'aliasId', '192.168.1.253'],
      ['CAPTURE_AUDIO_ABSENT_ON_RESTART', 'sessionId', 'session 24'],
      ['CAPTURE_AUDIO_ABSENT_ON_RESTART', 'earlierAttempt', 0],
      ['CAPTURE_AUDIO_ABSENT_ON_RESTART', 'laterAttempt', 1.5],
      ['CAPTURE_AUDIO_ABSENT_ON_RESTART', 'laterAttempt', '2'],
      ['CAPTURE_AUDIO_ABSENT_ON_RESTART', 'audioAbsentAtLeastMs', -1],
      ['CAPTURE_AUDIO_ABSENT_ON_RESTART', 'audioAbsentAtLeastMs', 0.5],
      ['CAPTURE_AUDIO_ABSENT_ON_RESTART', 'audioAbsentAtMostMs', 86_400_001],
      ['CAPTURE_AUDIO_ABSENT_ON_RESTART', 'audioAbsentAtMostMs', 'without end'],
      ['CAPTURE_DEVICE_CONNECTION_TESTED', 'deviceId', '192.168.10.21'],
      ['CAPTURE_DEVICE_CONNECTION_TESTED', 'deviceId', 'CND-4F2A91C0D377'],
      ['CAPTURE_DEVICE_CONNECTION_TESTED', 'outcome', 'OK'],
      ['CAPTURE_DEVICE_CONNECTION_TESTED', 'adapter', 'onvif rtsp'],
      ['CAPTURE_DEVICE_CONNECTION_TESTED', 'sourceClass', 'REAL'],
      ['CAPTURE_DEVICE_CONNECTION_TESTED', 'operationId', 'testCaptureCandidateConnection'],
      ['CAPTURE_DEVICE_CONNECTION_TESTED', 'operationId', 'adoptCaptureCandidate'],
      ['CAPTURE_DEVICE_CONNECTION_TESTED', 'guardTripped', 'yes'],
      ['CAPTURE_DEVICE_CONNECTION_TESTED', 'reason', '401 Unauthorized'],
    ];
    for (const [type, key, value] of invalid) expect(codeOf(() => auditInputOf(withDetail(first(type), key, value))), `${type}.${key}=${String(value)}`).toBe('AUDIT_DETAIL_VALUE_INVALID');
    // The bounds themselves pass: 0 ms, one day, the least and the most minutes of the helper.
    expect(codeOf(() => auditInputOf(withDetail(withDetail(first('CAPTURE_AUDIO_ABSENT_ON_RESTART'), 'audioAbsentAtLeastMs', 0), 'audioAbsentAtMostMs', 86_400_000)))).toBe('accepted');
    for (const minutes of [5, 480]) expect(codeOf(() => auditInputOf(withDetail(first('HOST_ALIAS_REQUESTED'), 'minutes', minutes))), String(minutes)).toBe('accepted');
    // The candidate's test is what it was: its list still REQUIRES the candidate and the search, and still names two operations only.
    expect(Object.entries(SERVER_AUDIT_DETAIL_RULES.CAPTURE_CONNECTION_TESTED).filter(([, rule]) => rule.required).map(([key]) => key)).toEqual(['candidateId', 'searchId', 'outcome', 'authenticated', 'adapter', 'sourceClass', 'operationId']);
    expect(SERVER_AUDIT_DETAIL_RULES.CAPTURE_CONNECTION_TESTED.operationId.accepts('testCaptureDeviceConnection')).toBe(false);
  });

  it('task 4 row 201 (X-C; SX-14): OPERATOR_PASSWORD_SET is accepted and refuses every foreign key, among them each name of a password, a length, a salt, a tag or a hash parameter; its severity is fixed', () => {
    // The one type follows the ten of row 19 (77 -> 78), category SECURITY; the four of row V3 follow it (78 -> 82).
    // Row N2: two types joined the end (83 -> 85); the position moves by that delta of two. Row RD2: one more (85 -> 86).
    expect(Object.values(AuditType).at(-10)).toBe('OPERATOR_PASSWORD_SET'); // row D53: + one (86 -> 87)
    expect(AUDIT_TYPE_CATEGORY.OPERATOR_PASSWORD_SET).toBe('SECURITY');
    expect(SERVER_AUDIT_FIXED_SEVERITY).toEqual({ OPERATOR_PASSWORD_SET: 'WARNING' });
    expect(fixedSeverityOf(AuditType.OPERATOR_PASSWORD_SET)).toBe('WARNING');
    expect(Object.values(AuditType).filter((type) => fixedSeverityOf(type) !== undefined)).toEqual(['OPERATOR_PASSWORD_SET']);
    expect([...OPERATOR_PASSWORD_SET_METHODS]).toEqual(['HOST_COMMAND']);
    const withDetail = (item: AuditEntry, key: string, value: unknown): AuditEntry => ({ ...item, details: { ...item.details, [key]: value } as AuditEntry['details'] });
    const [first, second] = accepted['OPERATOR_PASSWORD_SET'] as [AuditEntry, AuditEntry];
    for (const item of [first, second]) {
      expect(codeOf(() => auditInputOf(item))).toBe('accepted');
      const { row } = appendAudit({ rows: [], head: GENESIS, total: 0, dropped: 0 }, auditInputOf(item), 1);
      expect([row.type, row.category, row.severity, row.actorId]).toEqual(['OPERATOR_PASSWORD_SET', 'SECURITY', 'WARNING', null]);
    }
    // The contract example is a row the writer accepts.
    expect(codeOf(() => auditInputOf({ ...first, details: { ...OPERATOR_PASSWORD_SET_DETAILS_EXAMPLE } }))).toBe('accepted');
    // A name the general key rule already forbids ...
    for (const key of ['password', 'passwordHash', 'salt', 'secret', 'credential', 'credentialHash', 'token', 'username', 'nonce', 'keyRef']) {
      expect(codeOf(() => auditInputOf(withDetail(first, key, 'x'))), key).toBe('AUDIT_DETAIL_KEY_FORBIDDEN');
    }
    // ... and every other name of a password, a length, a salt, a tag or a hash parameter: no such key is on the list.
    const foreign = [
      'newPassword', 'oldPassword', 'passwordLength', 'length', 'minLength', 'characters', 'codePoints',
      'saltHex', 'saltLength', 'passwordSalt', 'tag', 'authTag', 'tagLength', 'hash', 'hashHex', 'digest', 'hashedAt',
      'algorithm', 'hashAlgorithm', 'parameters', 'hashParameters', 'memoryCost', 'timeCost', 'parallelism', 'iterations', 'cost', 'keyLength', 'version',
      'n', 'r', 'p', 'operationId', 'permission', 'reason', 'user', 'operatorName', 'terminal', 'hostname', 'biometricTokensRevoked',
    ];
    for (const key of foreign) expect(codeOf(() => auditInputOf(withDetail(first, key, 1))), key).toBe('AUDIT_DETAIL_KEY_NOT_ALLOWED');
    const invalid: Array<[string, unknown]> = [
      ['targetOperatorId', 'fixture.supervisor'],
      ['targetOperatorId', 'OPR-2'],
      ['method', 'CONSOLE'],
      ['method', 'host command'],
      ['sessionsEnded', -1],
      ['sessionsEnded', '3'],
      ['earlierWasDemo', 'yes'],
      ['earlierWasDemo', 1],
      ['invokerUid', 'root'],
      ['invokerUid', -1],
      ['invokerUid', 1.5],
      ['invokerUid', 4_294_967_296],
    ];
    for (const [key, value] of invalid) expect(codeOf(() => auditInputOf(withDetail(first, key, value))), `${key}=${String(value)}`).toBe('AUDIT_DETAIL_VALUE_INVALID');
  });

  it('task 4 row 201 (X-C): a SYSTEM_BOOT row with and without `signingKeyId` and `signingCertificateSha256` is accepted; the two values have a stated form', () => {
    expect(detailRulesOf(AuditType.SYSTEM_BOOT)).toBeUndefined();
    expect(Object.keys(SYSTEM_BOOT_SIGNING_DETAIL_RULES)).toEqual(['signingKeyId', 'signingCertificateSha256']);
    expect(Object.values(SYSTEM_BOOT_SIGNING_DETAIL_RULES).map((rule) => rule.required)).toEqual([false, false]);
    const boot = (details: Record<string, unknown>): AuditEntry => ({ type: 'SYSTEM_BOOT', actorId: null, deviceId: null, message: 'Core started', details }) as AuditEntry;
    for (const details of [SYSTEM_BOOT_DETAILS_EXAMPLE, SYSTEM_BOOT_SIGNING_DETAILS_EXAMPLE, { captureOperation: 'REAL_PRODUCTION', signingKeyId: 'CORE-KEY-EVSIGN-01' }, {}]) {
      expect(codeOf(() => auditInputOf(boot({ ...details }))), JSON.stringify(Object.keys(details))).toBe('accepted');
    }
    const input = auditInputOf(boot({ ...SYSTEM_BOOT_SIGNING_DETAILS_EXAMPLE }));
    expect(input.details).toEqual(SYSTEM_BOOT_SIGNING_DETAILS_EXAMPLE);
    // The two names are not names of a secret, and the two example values pass their form.
    for (const key of Object.keys(SYSTEM_BOOT_SIGNING_DETAIL_RULES)) expect(AUDIT_DETAIL_FORBIDDEN_KEYS.map((name) => name.toLowerCase())).not.toContain(key.toLowerCase());
    const { signingKeyId, signingCertificateSha256 } = SYSTEM_BOOT_SIGNING_DETAIL_RULES;
    for (const value of ['CORE-KEY-EVSIGN-01', 'CORE-KEY-EVSIGN-02', 'DEMO-KEY-EVSIGN-01']) expect(signingKeyId.accepts(value), value).toBe(true);
    for (const value of ['core-key', '', 'CORE KEY', '-----BEGIN PRIVATE KEY-----', 'K'.repeat(65), 1, null]) expect(signingKeyId.accepts(value), String(value)).toBe(false);
    expect(signingCertificateSha256.accepts(SYSTEM_BOOT_SIGNING_DETAILS_EXAMPLE.signingCertificateSha256)).toBe(true);
    for (const value of ['5D'.repeat(32), '5d'.repeat(31), 'sha256:' + '5d'.repeat(32), '-----BEGIN CERTIFICATE-----', '', 7, null]) expect(signingCertificateSha256.accepts(value), String(value)).toBe(false);
  });

  it('task 4 row V4 (C71 C-6, C72 F-04, C76 item 8): the writer itself holds the two signing members of ANY SYSTEM_BOOT row to their form or null, and a fixed severity to its value - native and prepared', () => {
    // An OPEN rule: the type keeps no closed list (any other key is free), two named members have a form.
    expect(detailRulesOf(AuditType.SYSTEM_BOOT)).toBeUndefined();
    expect(Object.keys(SERVER_AUDIT_OPEN_DETAIL_RULES)).toEqual(['SYSTEM_BOOT']);
    // Task 4 row V5 (C84 R-1): + the four members of the signer store's state, 2 -> 6 named members; the type stays open.
    // Task 4 row P1 (U21 (2)): + the two members of a production boot's host, 6 -> 8 named members; the type stays open.
    expect(Object.keys(openDetailRulesOf(AuditType.SYSTEM_BOOT) ?? {})).toEqual([...Object.keys(SYSTEM_BOOT_SIGNING_DETAIL_RULES), 'signingKeysRetained', 'signingKeysCompromised', 'signingCertificatesSha256', 'signingStoreChange', 'hostPlatform', 'hostProfile', 'addressHelperSocket', 'microphonePermission']);
    expect(Object.values(AuditType).filter((type) => openDetailRulesOf(type) !== undefined)).toEqual(['SYSTEM_BOOT']);
    const boot = (details: Record<string, unknown>): AuditEntry => ({ type: 'SYSTEM_BOOT', actorId: null, deviceId: null, message: 'Core started', details }) as AuditEntry;
    const SHA = SYSTEM_BOOT_SIGNING_DETAILS_EXAMPLE.signingCertificateSha256;
    // Accepted: no member, the pair, THE NULL PAIR of a boot that read no certificate (SX-15; rows 201, 209), one null, and any other key as before.
    const admitted: Array<Record<string, unknown>> = [
      {},
      { ...SYSTEM_BOOT_DETAILS_EXAMPLE },
      { ...SYSTEM_BOOT_SIGNING_DETAILS_EXAMPLE },
      { captureOperation: 'REAL_PRODUCTION', signingKeyId: null, signingCertificateSha256: null },
      { signingKeyId: null },
      { signingCertificateSha256: null },
      { captureOperation: 'REAL_DEVELOPMENT', note: 'a key of the simulator', count: 3 },
      // Row V5 (C84 R-1): the state of the signer store - the contract's example, the four members null (the store was not read), none marked.
      { ...SYSTEM_BOOT_SIGNING_STORE_DETAILS_EXAMPLE },
      { ...SYSTEM_BOOT_SIGNING_DETAILS_EXAMPLE, signingKeysRetained: null, signingKeysCompromised: null, signingCertificatesSha256: null, signingStoreChange: 'NOT_READ' },
      { ...SYSTEM_BOOT_SIGNING_DETAILS_EXAMPLE, signingKeysRetained: 1, signingKeysCompromised: '', signingCertificatesSha256: SHA, signingStoreChange: 'NO_EARLIER_STATEMENT' },
    ];
    for (const details of admitted) expect(codeOf(() => auditInputOf(boot(details))), JSON.stringify(details)).toBe('accepted');
    // Row V5: a member of the store's state that is not of its form is refused for EVERY writer, by the code of a detail value.
    for (const [key, value] of [['signingKeysRetained', 100], ['signingKeysRetained', '2'], ['signingKeysCompromised', 'CORE-KEY-EVSIGN-01'], ['signingKeysCompromised', '02,01'], ['signingCertificatesSha256', 'x'], ['signingStoreChange', 'ROTATED'], ['signingStoreChange', 'NONE,KEY_ROTATED']] as const) {
      expect(codeOf(() => auditInputOf(boot({ ...SYSTEM_BOOT_SIGNING_STORE_DETAILS_EXAMPLE, [key]: value }))), `${key}: ${String(value)}`).toBe('AUDIT_DETAIL_VALUE_INVALID');
    }
    // Row P1 (U21 (2)): the host of a production boot. Accepted: Linux asked, macOS not asked, a platform no production Core starts on (null + its code).
    for (const host of [{ hostPlatform: 'linux', hostProfile: 'WILL_BE_ASKED' }, { hostPlatform: 'darwin', hostProfile: 'WILL_NOT_BE_ASKED' }, { hostPlatform: null, hostProfile: 'PLATFORM_NOT_SUPPORTED' }]) {
      expect(codeOf(() => auditInputOf(boot({ ...SYSTEM_BOOT_SIGNING_STORE_DETAILS_EXAMPLE, ...host }))), JSON.stringify(host)).toBe('accepted');
    }
    // The contract's own example of such a row is one the writer takes.
    expect(codeOf(() => auditInputOf(boot({ ...SYSTEM_BOOT_HOST_DETAILS_EXAMPLE })))).toBe('accepted');
    // Refused for EVERY writer: a platform word outside the closed list (the word of the host never reaches the trail), a code that is none, a null code.
    for (const [key, value] of [['hostPlatform', 'win32'], ['hostPlatform', 'Darwin'], ['hostPlatform', ''], ['hostPlatform', 1], ['hostProfile', 'ASKED'], ['hostProfile', 'NOT_ASKED'], ['hostProfile', null], ['hostProfile', true]] as const) {
      expect(codeOf(() => auditInputOf(boot({ ...SYSTEM_BOOT_SIGNING_STORE_DETAILS_EXAMPLE, [key]: value }))), `${key}: ${String(value)}`).toBe('AUDIT_DETAIL_VALUE_INVALID');
    }
    // Row HC (C94 (j)): the address helper's socket path of a production boot on Linux. Accepted: the two codes, and a row without the member.
    for (const addressHelperSocket of ['PRESENT', 'NOT_PRESENT']) {
      expect(codeOf(() => auditInputOf(boot({ ...SYSTEM_BOOT_HOST_DETAILS_EXAMPLE, hostPlatform: 'linux', hostProfile: 'WILL_BE_ASKED', addressHelperSocket }))), addressHelperSocket).toBe('accepted');
    }
    // Refused for EVERY writer: a code that is none, a path, a truth value and null (a boot that does not state the member leaves it out).
    for (const value of ['ABSENT', 'present', '', '/run/dems-core-netalias/socket', true, 1, null]) {
      expect(codeOf(() => auditInputOf(boot({ ...SYSTEM_BOOT_SIGNING_STORE_DETAILS_EXAMPLE, addressHelperSocket: value }))), `addressHelperSocket: ${String(value)}`).toBe('AUDIT_DETAIL_VALUE_INVALID');
    }
    // Row NB (design 06 row N13, SM-15): the microphone permission of a production boot on darwin. Accepted: the one code; refused for EVERY writer: null, empty, another code, another case, a number.
    expect(codeOf(() => auditInputOf(boot({ ...SYSTEM_BOOT_HOST_DETAILS_EXAMPLE, hostPlatform: 'darwin', hostProfile: 'WILL_BE_ASKED', microphonePermission: 'NOT_KNOWN' }))), 'NOT_KNOWN').toBe('accepted');
    for (const value of [null, '', 'KNOWN', 'not_known', 1]) {
      expect(codeOf(() => auditInputOf(boot({ ...SYSTEM_BOOT_SIGNING_STORE_DETAILS_EXAMPLE, microphonePermission: value }))), `microphonePermission: ${String(value)}`).toBe('AUDIT_DETAIL_VALUE_INVALID');
    }
    expect(auditInputOf(boot({ captureOperation: 'REAL_PRODUCTION', signingKeyId: null, signingCertificateSha256: null })).details).toEqual({ captureOperation: 'REAL_PRODUCTION', signingKeyId: null, signingCertificateSha256: null });
    // Refused, for a writer that is NOT the fence: a member that is neither null nor of its form.
    const refused: Array<[string, unknown]> = [
      ['signingKeyId', 'core-key'], ['signingKeyId', ''], ['signingKeyId', 'CORE KEY'], ['signingKeyId', 'K'.repeat(65)], ['signingKeyId', 1], ['signingKeyId', true], ['signingKeyId', SHA],
      ['signingCertificateSha256', '5D'.repeat(32)], ['signingCertificateSha256', '5d'.repeat(31)], ['signingCertificateSha256', `sha256:${SHA}`], ['signingCertificateSha256', ''], ['signingCertificateSha256', 7], ['signingCertificateSha256', false], ['signingCertificateSha256', 'CORE-KEY-EVSIGN-01'],
    ];
    for (const [key, value] of refused) {
      const entry = boot({ ...SYSTEM_BOOT_SIGNING_DETAILS_EXAMPLE, [key]: value });
      expect(codeOf(() => auditInputOf(entry)), `${key}=${String(value)}`).toBe('AUDIT_DETAIL_VALUE_INVALID');
      // The refusal names the key and the form, never the value.
      const text = refusalOf(() => auditInputOf(entry)).message;
      expect(text).toContain(key);
      if (typeof value === 'string' && value.length > 3) expect(text.includes(value), `${key}: the value is quoted`).toBe(false);
    }
    // A PREPARED row (the engine's path, `appendPrepared`) is held to the same rule: the row is refused before it is stored.
    const prepared = (details: AuditRow['details'], severity?: AuditRow['severity'], type: AuditRow['type'] = 'SYSTEM_BOOT'): AuditRow =>
      appendAudit({ rows: [], head: GENESIS, total: 0, dropped: 0 }, { type, message: 'Prepared', ...(severity === undefined ? {} : { severity }), details }, 1).row;
    expect(codeOf(() => checkAuditRow(prepared({ signingKeyId: null, signingCertificateSha256: null }), 'prepared'))).toBe('accepted');
    expect(codeOf(() => checkAuditRow(prepared({ ...SYSTEM_BOOT_SIGNING_DETAILS_EXAMPLE }), 'prepared'))).toBe('accepted');
    expect(codeOf(() => checkAuditRow(prepared({ reason: 'POWER_RESTORED' }, 'WARNING'), 'prepared'))).toBe('accepted');
    expect(codeOf(() => checkAuditRow(prepared({ signingKeyId: 'core-key' }), 'prepared'))).toBe('AUDIT_DETAIL_VALUE_INVALID');
    expect(codeOf(() => checkAuditRow(prepared({ signingCertificateSha256: 'not a digest' }), 'prepared'))).toBe('AUDIT_DETAIL_VALUE_INVALID');
    // SYSTEM_BOOT has NO fixed severity (the shared code writes it INFO and, after a power failure, WARNING): every severity passes.
    expect(fixedSeverityOf(AuditType.SYSTEM_BOOT)).toBeUndefined();
    for (const severity of ['INFO', 'SUCCESS', 'WARNING', 'CRITICAL']) expect(codeOf(() => auditInputOf({ ...boot({}), severity } as AuditEntry)), severity).toBe('accepted');
    // THE FIXED SEVERITY (F-04): a row of OPERATOR_PASSWORD_SET is WARNING or it is not written - stated otherwise, or not stated (INFO).
    const [password] = accepted['OPERATOR_PASSWORD_SET'] as [AuditEntry];
    expect(password.severity).toBe('WARNING');
    expect(codeOf(() => auditInputOf(password))).toBe('accepted');
    for (const severity of ['INFO', 'SUCCESS', 'CRITICAL']) expect(codeOf(() => auditInputOf({ ...password, severity } as AuditEntry)), severity).toBe('AUDIT_SEVERITY_INVALID');
    const { severity: _stated, ...unstated } = password;
    expect(codeOf(() => auditInputOf(unstated as AuditEntry))).toBe('AUDIT_SEVERITY_INVALID');
    expect(refusalOf(() => auditInputOf(unstated as AuditEntry)).message).toBe('the severity of OPERATOR_PASSWORD_SET is fixed: WARNING');
    const passwordDetails = password.details as AuditRow['details'];
    expect(codeOf(() => checkAuditRow(prepared(passwordDetails, 'WARNING', 'OPERATOR_PASSWORD_SET'), 'prepared'))).toBe('accepted');
    expect(codeOf(() => checkAuditRow(prepared(passwordDetails, 'INFO', 'OPERATOR_PASSWORD_SET'), 'prepared'))).toBe('AUDIT_SEVERITY_INVALID');
  });

  it('task 4 row V4 (C74): the result entry of a ROW-LESS alias removal is accepted - `aliasId` is optional on HOST_ALIAS_REMOVED and HOST_ALIAS_REMOVE_FAILED, and still a row id when stated', () => {
    for (const type of ['HOST_ALIAS_REMOVED', 'HOST_ALIAS_REMOVE_FAILED'] as const) {
      expect(SERVER_AUDIT_DETAIL_RULES[type].aliasId.required, type).toBe(false);
      const [withRow] = accepted[type] as [AuditEntry];
      expect(codeOf(() => auditInputOf(withRow)), type).toBe('accepted');
      const { aliasId: _row, ...rowless } = withRow.details as Record<string, unknown>;
      expect(codeOf(() => auditInputOf({ ...withRow, details: rowless } as AuditEntry)), `${type} without a row`).toBe('accepted');
      for (const value of ['eth1', '192.168.1.253', '', null, 7]) {
        expect(codeOf(() => auditInputOf({ ...withRow, details: { ...rowless, aliasId: value } } as AuditEntry)), `${type}.aliasId=${String(value)}`).toBe('AUDIT_DETAIL_VALUE_INVALID');
      }
      // The address and the reason stay required: a result entry still says what was removed and why.
      for (const key of ['address', 'removeReason']) {
        const { [key]: _gone, ...rest } = withRow.details as Record<string, unknown>;
        expect(codeOf(() => auditInputOf({ ...withRow, details: rest } as AuditEntry)), `${type} without ${key}`).toBe('AUDIT_DETAIL_MISSING');
      }
    }
    // The ADD result keeps its row: an address that is in place always has one.
    expect(SERVER_AUDIT_DETAIL_RULES.HOST_ALIAS_ADDED.aliasId.required).toBe(true);
  });

  it('task 4 row V4 (C73): the audit row of an audio gap and the SIGNED manifest member for it have one bound and one meaning of a bound', () => {
    // `audio.absentOnRestart` of the manifest (fields 129-132) states what CAPTURE_AUDIO_ABSENT_ON_RESTART states: one day at most.
    expect(MANIFEST_AUDIO_ABSENT_MAX_MS).toBe(CAPTURE_AUDIO_ABSENT_MAX_MS);
    const gap = { earlierAttempt: 1, laterAttempt: 2, absentAtLeastMs: CAPTURE_AUDIO_ABSENT_MAX_MS, absentAtMostMs: CAPTURE_AUDIO_ABSENT_MAX_MS };
    expect(ManifestAudioRestartGapSchema.safeParse(gap).success).toBe(true);
    expect(ManifestAudioRestartGapSchema.safeParse({ ...gap, absentAtMostMs: CAPTURE_AUDIO_ABSENT_MAX_MS + 1 }).success).toBe(false);
    const { audioAbsentAtLeastMs, audioAbsentAtMostMs, earlierAttempt, laterAttempt } = SERVER_AUDIT_DETAIL_RULES.CAPTURE_AUDIO_ABSENT_ON_RESTART;
    expect([audioAbsentAtLeastMs.accepts(CAPTURE_AUDIO_ABSENT_MAX_MS), audioAbsentAtMostMs.accepts(CAPTURE_AUDIO_ABSENT_MAX_MS + 1), earlierAttempt.accepts(0), laterAttempt.accepts(2)]).toEqual([true, false, false, true]);
    // The manifest states a bound that was not measured as null; the audit row leaves the key out. Neither invents a number.
    expect(ManifestAudioRestartGapSchema.safeParse({ ...gap, absentAtLeastMs: null, absentAtMostMs: null }).success).toBe(true);
    expect([audioAbsentAtLeastMs.required, audioAbsentAtMostMs.required]).toEqual([false, false]);
  });

  it('task 4 row 19: the ten types of the hardware-input port refuse a foreign key, device text and a value outside their form; the reveal reason is one of three; the sound-card scope is accepted', () => {
    const NEW_TYPES = [
      'CAPTURE_AUDIO_INPUT_CHANGED',
      'CAPTURE_NETWORK_CONFIG_CHANGED',
      'HOST_ALIAS_ADDED',
      'HOST_ALIAS_REMOVED',
      'HOST_ALIAS_REMOVE_FAILED',
      'CAMERA_FACTORY_SCANNED',
      'CAMERA_NETWORK_SET',
      'CAPTURE_DEVICE_ADDRESS_CHANGED',
      'INSTALLATION_ACCEPTED',
      'INSTALLATION_ACCEPTANCE_REVOKED',
    ] as const;
    // The ten are in this order (67 -> 77); the one type of row 201 follows them (77 -> 78), then the four of row V3 (78 -> 82).
    // Row N2: two types joined the end (83 -> 85); the positions move by that delta of two. Row RD2: one more (85 -> 86).
    expect(Object.values(AuditType).slice(-20, -10)).toEqual([...NEW_TYPES]); // row D53: + one (86 -> 87)
    const withDetail = (item: AuditEntry, key: string, value: unknown): AuditEntry => ({ ...item, details: { ...item.details, [key]: value } as AuditEntry['details'] });
    const first = (type: string): AuditEntry => accepted[type]?.[0] as AuditEntry;
    for (const type of NEW_TYPES) {
      // The writer accepts every stated row of the type ...
      for (const item of accepted[type] ?? []) expect(codeOf(() => auditInputOf(item)), type).toBe('accepted');
      // ... refuses a credential name by the key rule, and device text or a name of the host by the list.
      for (const key of ['username', 'secret', 'password', 'credential', 'onvifUuid']) expect(codeOf(() => auditInputOf(withDetail(first(type), key, 'x'))), `${type}.${key}`).toBe('AUDIT_DETAIL_KEY_FORBIDDEN');
      for (const key of ['productName', 'cardName', 'usbId', 'model', 'vendor', 'label', 'interfaceName', 'subnet', 'url', 'host', 'steps', 'siteAddress']) {
        expect(codeOf(() => auditInputOf(withDetail(first(type), key, 'x'))), `${type}.${key}`).toBe('AUDIT_DETAIL_KEY_NOT_ALLOWED');
      }
    }
    const invalid: Array<[string, string, unknown]> = [
      ['CAPTURE_AUDIO_INPUT_CHANGED', 'deviceId', 'USB Audio CODEC'],
      ['CAPTURE_AUDIO_INPUT_CHANGED', 'change', 'RENAMED'],
      ['CAPTURE_AUDIO_INPUT_CHANGED', 'inputNumber', '1'],
      ['CAPTURE_AUDIO_INPUT_CHANGED', 'channelCount', -2],
      // Field NAMES only: a value, an unknown name and a repeated name are refused.
      ['CAPTURE_NETWORK_CONFIG_CHANGED', 'changedFields', 'interfaceName=eth1'],
      ['CAPTURE_NETWORK_CONFIG_CHANGED', 'changedFields', 'revision'],
      ['CAPTURE_NETWORK_CONFIG_CHANGED', 'changedFields', 'aliasHost,aliasHost'],
      ['CAPTURE_NETWORK_CONFIG_CHANGED', 'changedFields', ''],
      ['CAPTURE_NETWORK_CONFIG_CHANGED', 'revision', 0],
      // Row V7b: a count of 1 to 8, never the ports themselves.
      ['CAPTURE_NETWORK_CONFIG_CHANGED', 'onvifPortCount', 0],
      ['CAPTURE_NETWORK_CONFIG_CHANGED', 'onvifPortCount', 9],
      ['CAPTURE_NETWORK_CONFIG_CHANGED', 'onvifPortCount', 1.5],
      ['CAPTURE_NETWORK_CONFIG_CHANGED', 'onvifPortCount', '80,8080'],
      ['HOST_ALIAS_ADDED', 'aliasId', 'eth1:192.168.1.253'],
      // An IPv4 literal: never with a prefix length, never a name, a URL or a part above 255.
      ['HOST_ALIAS_ADDED', 'address', '192.168.1.253/24'],
      ['HOST_ALIAS_ADDED', 'address', 'eth1'],
      ['HOST_ALIAS_ADDED', 'address', '192.168.1.256'],
      ['HOST_ALIAS_ADDED', 'reason', 'operator asked'],
      ['HOST_ALIAS_ADDED', 'expiresAt', '30 minutes'],
      ['HOST_ALIAS_REMOVED', 'removeReason', 'FACTORY_SCAN'],
      ['HOST_ALIAS_REMOVE_FAILED', 'failureReason', 'RTNETLINK answers: Cannot assign requested address'],
      ['CAMERA_FACTORY_SCANNED', 'outcome', 'PARTIAL'],
      ['CAMERA_FACTORY_SCANNED', 'addressCount', '192.168.1.64'],
      ['CAMERA_FACTORY_SCANNED', 'searchId', 'scan-1'],
      ['CAMERA_NETWORK_SET', 'phase', 'WAITING'],
      ['CAMERA_NETWORK_SET', 'fromAddress', 'http://192.168.1.64/onvif/device_service'],
      ['CAMERA_NETWORK_SET', 'toAddress', 'admin:pass@192.168.10.101'],
      ['CAMERA_NETWORK_SET', 'mac', 'aa-bb-cc-00-11-22'],
      ['CAMERA_NETWORK_SET', 'failureReason', 'wrong password'],
      ['CAMERA_NETWORK_SET', 'guardTripped', 'yes'],
      ['CAPTURE_DEVICE_ADDRESS_CHANGED', 'fromAddress', 'camera.local'],
      ['CAPTURE_DEVICE_ADDRESS_CHANGED', 'toAddress', 'rtsp://192.168.10.101:554/stream1'],
      ['CAPTURE_DEVICE_ADDRESS_CHANGED', 'reason', 'the camera moved'],
      ['INSTALLATION_ACCEPTED', 'acceptanceId', 'ACC-1'],
      ['INSTALLATION_ACCEPTED', 'passedCount', 11.5],
      ['INSTALLATION_ACCEPTANCE_REVOKED', 'acceptanceId', 'Room 2 was rebuilt'],
    ];
    for (const [type, key, value] of invalid) expect(codeOf(() => auditInputOf(withDetail(first(type), key, value))), `${type}.${key}=${String(value)}`).toBe('AUDIT_DETAIL_VALUE_INVALID');

    // AD-03 (1): the reveal reason is the closed set of four (decisions D51 / D53: + PREVIEW_OPEN); any other code is refused.
    const revealed = first('CAPTURE_CREDENTIAL_REVEALED');
    expect([...CAPTURE_CREDENTIAL_REVEAL_REASONS]).toEqual(['SESSION_OPEN', 'RELAY_RESTART', 'CONNECTION_TEST', 'PREVIEW_OPEN']);
    for (const reason of CAPTURE_CREDENTIAL_REVEAL_REASONS) expect(codeOf(() => auditInputOf(withDetail(revealed, 'reason', reason))), reason).toBe('accepted');
    for (const reason of ['MEDIA_DIAGNOSTICS', 'SUPPORT', 'session_open', 'SET_CAMERA_ADDRESS', '']) {
      expect(codeOf(() => auditInputOf(withDetail(revealed, 'reason', reason))), reason).toBe('AUDIT_DETAIL_VALUE_INVALID');
    }
    expect(Object.keys(SERVER_AUDIT_DETAIL_RULES.CAPTURE_CREDENTIAL_REVEALED)).toEqual(['deviceId', 'reason']);

    // Design addendum 04 section 4.2: the third scope of a search, the listing of sound cards.
    const searched = first('CAPTURE_DISCOVERY_SEARCHED');
    expect([...CAPTURE_DISCOVERY_AUDIT_SCOPES]).toEqual(['CAMERA_NETWORK', 'MIC_LOCAL', 'AUDIO_CARDS']);
    for (const scope of CAPTURE_DISCOVERY_AUDIT_SCOPES) expect(codeOf(() => auditInputOf(withDetail(searched, 'scope', scope))), scope).toBe('accepted');
    expect(codeOf(() => auditInputOf(withDetail(searched, 'scope', 'USB')))).toBe('AUDIT_DETAIL_VALUE_INVALID');

    // R-FLEX AU-A1 (row 129): the `change` list has four values, `RELEASED` among them, and equals the shared list.
    expect([...CAPTURE_AUDIO_INPUT_CHANGES]).toEqual(['REGISTERED', 'CARD_CHANGED', 'REENABLED', 'RELEASED']);
    expect([...CAPTURE_AUDIO_INPUT_CHANGES]).toEqual(Object.values(CaptureAudioInputChange));
    const audioInput = first('CAPTURE_AUDIO_INPUT_CHANGED');
    for (const change of CAPTURE_AUDIO_INPUT_CHANGES) expect(codeOf(() => auditInputOf(withDetail(audioInput, 'change', change))), change).toBe('accepted');
  });

  it('M4-AUD-1: the four types of the camera search refuse a username, a secret, a URL, a label and a value outside their form', () => {
    const searched = accepted['CAPTURE_DISCOVERY_SEARCHED']?.[0] as AuditEntry;
    const tested = accepted['CAPTURE_CONNECTION_TESTED']?.[1] as AuditEntry;
    const adopted = accepted['CAPTURE_CANDIDATE_ADOPTED']?.[1] as AuditEntry;
    const unreachable = accepted['CAPTURE_DEVICE_UNREACHABLE']?.[0] as AuditEntry;
    const withDetail = (item: AuditEntry, key: string, value: unknown): AuditEntry => ({ ...item, details: { ...item.details, [key]: value } as AuditEntry['details'] });
    // The control of M4-AUD-1: a planted `username` (and the other credential names) is refused by the key rule.
    for (const item of [searched, tested, adopted, unreachable]) {
      for (const key of ['username', 'secret', 'password', 'credential', 'onvifUuid']) expect(codeOf(() => auditInputOf(withDetail(item, key, 'x'))), `${item.type}.${key}`).toBe('AUDIT_DETAIL_KEY_FORBIDDEN');
      for (const key of ['url', 'streamUri', 'label', 'name', 'model', 'vendor', 'address', 'interfaceName', 'profile']) {
        expect(codeOf(() => auditInputOf(withDetail(item, key, 'x'))), `${item.type}.${key}`).toBe('AUDIT_DETAIL_KEY_NOT_ALLOWED');
      }
    }
    const invalid: Array<[AuditEntry, string, unknown]> = [
      [searched, 'searchId', 'DSC-12'],
      [searched, 'scope', 'LAN'],
      [searched, 'responderCount', -1],
      [searched, 'interfaceCount', 'en0'],
      [searched, 'failureReason', 'bind EADDRINUSE 192.0.2.1:3702'],
      [tested, 'candidateId', '192.0.2.10'],
      [tested, 'outcome', 'TIMEOUT'],
      [tested, 'authenticated', 'admin'],
      [tested, 'operationId', 'setCaptureDeviceCredential'],
      // `host` is an IP literal: never a URL, never a credential-bearing address, never a name.
      [tested, 'host', 'http://192.0.2.10/onvif/device_service'],
      [tested, 'host', 'admin:pass@192.0.2.10'],
      [tested, 'host', 'camera.local'],
      [tested, 'endpointRef', 'http://admin:pass@192.0.2.10/'],
      [tested, 'endpointRef', 'x'.repeat(121)],
      // Pass D1a (D134): a closed form, `urn:uuid:<UUID>` - free text a device announced is refused, and `uuid:` without `urn:` too.
      [tested, 'endpointRef', 'free-text-a-device-announced'],
      [adopted, 'endpointRef', 'uuid:00000000-0000-4000-8000-000000000001'],
      [tested, 'guardTripped', 1],
      [adopted, 'deviceId', 'DEV-0001x'.toLowerCase()],
      [adopted, 'operationId', 'testCaptureCandidateConnection'],
      [adopted, 'credentialSet', 'yes'],
      [unreachable, 'deviceKind', 'POE'],
      [unreachable, 'phase', 'RECORDING'],
      [unreachable, 'reason', 'Connection refused by 192.0.2.10'],
      [unreachable, 'sessionId', 'the open session'],
    ];
    for (const [item, key, value] of invalid) expect(codeOf(() => auditInputOf(withDetail(item, key, value))), `${item.type}.${key}=${String(value)}`).toBe('AUDIT_DETAIL_VALUE_INVALID');
    // D145: `inputId` of CAPTURE_CONFIG_CHANGED and of MIC_SILENT take the same rule: MIC-03 is written, the other forms are refused.
    const selector: AuditEntry = { type: 'CAPTURE_CONFIG_CHANGED', actorId: 'OPR-002', deviceId: null, message: 'Selector changed', details: { operationId: 'setPrimaryMic', scope: 'MIC', field: 'SOURCE', inputId: 'MIC-03', deviceId: 'MIC-02', from: 'MIC-02', to: 'MIC-01', permission: 'CAPTURE_CONFIG' } };
    const silent: AuditEntry = { type: 'MIC_SILENT', actorId: null, deviceId: null, message: 'Silent', details: { inputId: 'MIC-03', thresholdDbfs: -60, durationMs: 5_000, sinceMs: 1_790_823_600_000, active: true } };
    for (const item of [selector, silent]) {
      expect(() => auditInputOf(item), item.type).not.toThrow();
      for (const value of ['MIC-3', 'CAM-01', 'the desk microphone', 'mic-03', 'MIC-03 ', '', 3]) {
        expect(codeOf(() => auditInputOf(withDetail(item, 'inputId', value))), `${item.type}.inputId=${String(value)}`).toBe('AUDIT_DETAIL_VALUE_INVALID');
      }
    }
    // D144: `fromInput` / `toInput` of AUDIO_SOURCE_SWITCHED take the numbered mic rule (`MIC-NN`) and nothing else.
    const switched: AuditEntry = { type: 'AUDIO_SOURCE_SWITCHED', actorId: 'OPR-001', deviceId: null, message: 'Switched', details: { fromInput: 'MIC-01', toInput: 'MIC-03', fromMs: 1, toMs: 2 } };
    expect(() => auditInputOf(switched)).not.toThrow();
    for (const key of ['fromInput', 'toInput']) {
      for (const value of ['MIC-3', 'CAM-01', 'the desk microphone', 'mic-03', 'MIC-03 ', '', 3]) {
        expect(codeOf(() => auditInputOf(withDetail(switched, key, value))), `${key}=${String(value)}`).toBe('AUDIT_DETAIL_VALUE_INVALID');
      }
    }
  });

  it.each(Object.entries(accepted))('%s: the rows of the specification are accepted', (_type, entries) => {
    for (const item of entries) expect(codeOf(() => auditInputOf(item))).toBe('accepted');
  });

  it.each(Object.entries(accepted))('%s: a key the specification does not name is refused', (_type, entries) => {
    const [item] = entries;
    for (const extra of ['body', 'note', 'operator', 'expires']) {
      const details = { ...(item as AuditEntry).details, [extra]: 'x' };
      expect(codeOf(() => auditInputOf({ ...(item as AuditEntry), details })), extra).toBe('AUDIT_DETAIL_KEY_NOT_ALLOWED');
    }
  });

  it.each(Object.entries(accepted))('%s: a required key that is missing is refused', (type, entries) => {
    const [item] = entries;
    const rules = detailRulesOf(type as AuditType) ?? {};
    for (const [key, rule] of Object.entries(rules)) {
      if (!rule.required) continue;
      const details = Object.fromEntries(Object.entries((item as AuditEntry).details).filter(([name]) => name !== key));
      expect(codeOf(() => auditInputOf({ ...(item as AuditEntry), details })), key).toBe('AUDIT_DETAIL_MISSING');
    }
  });

  it('a value that does not have the form of its key is refused: a pairing code is not a code ID', () => {
    const cases: Array<[AuditEntry, string, unknown]> = [
      [accepted['PAIRING_CODE_ISSUED']?.[0] as AuditEntry, 'codeId', '123456'],
      [accepted['PAIRING_CODE_ISSUED']?.[0] as AuditEntry, 'expiresAt', '2026-10-04'],
      [accepted['PAIRING_CODE_CLOSED']?.[0] as AuditEntry, 'reason', 'WRONG_CODE_123456'],
      [accepted['ACCESS_DENIED']?.[0] as AuditEntry, 'role', 'ADMIN'],
      [accepted['ACCESS_DENIED']?.[0] as AuditEntry, 'operationId', '/api/v1/session?x=1'],
      [accepted['ACCESS_DENIED']?.[0] as AuditEntry, 'permission', 'session start'],
      [accepted['ROLE_CHANGED']?.[0] as AuditEntry, 'targetOperatorId', 'fixture.supervisor'],
      [accepted['ROLE_CHANGED']?.[0] as AuditEntry, 'to', 'ROOT'],
      [accepted['USER_DISABLED']?.[0] as AuditEntry, 'sessionsEnded', -1],
      [accepted['USER_DISABLED']?.[0] as AuditEntry, 'sessionsEnded', 1.5],
      [accepted['DEVICE_REVOKED']?.[0] as AuditEntry, 'reason', ''],
      [accepted['DEVICE_REVOKED']?.[0] as AuditEntry, 'deviceId', 'CAM-01'],
      [accepted['BIOMETRIC_ENROLLMENT_CHANGED']?.[0] as AuditEntry, 'enabled', 'true'],
    ];
    for (const [item, key, value] of cases) {
      const details = { ...item.details, [key]: value } as AuditEntry['details'];
      expect(codeOf(() => auditInputOf({ ...item, details })), `${item.type}.${key}`).toBe('AUDIT_DETAIL_VALUE_INVALID');
    }
  });
});

describe('a row as it is stored (both origins)', () => {
  const built = (): AuditRow =>
    appendAudit(
      { rows: [], head: GENESIS, total: 0, dropped: 0 },
      { type: 'RECORDING_STARTED', message: 'Recording started', actorId: 'OPR-001', sessionId: 'SES-20261001-0001', details: { profile: 'STANDARD_1080P25' } },
      1_790_823_600_000,
    ).row;

  it('a row the shared code built is accepted as it is', () => {
    expect(codeOf(() => checkAuditRow(built(), 'prepared'))).toBe('accepted');
    expect(codeOf(() => checkAuditRow(built(), 'native'))).toBe('accepted');
  });

  it('a prepared row keeps the simulator\'s freedom: any key, any length, an empty message', () => {
    const body = { ...auditBody(built()), message: '', details: { 'Free Key': 'x'.repeat(5_000), also_this: 1 } };
    const row: AuditRow = { ...body, prevHash: GENESIS, hash: chainHash(GENESIS, body) };
    expect(codeOf(() => checkAuditRow(row, 'prepared'))).toBe('accepted');
    expect(codeOf(() => checkAuditRow(row, 'native'))).toBe('AUDIT_MESSAGE_INVALID');
  });

  it('and still: no forbidden key, no credential form, flat values, storable text', () => {
    const rehash = (body: ReturnType<typeof auditBody>): AuditRow => ({ ...body, prevHash: GENESIS, hash: chainHash(GENESIS, body) });
    const base = auditBody(built());
    expect(codeOf(() => checkAuditRow(rehash({ ...base, details: { token: 'x' } }), 'prepared'))).toBe('AUDIT_DETAIL_KEY_FORBIDDEN');
    expect(codeOf(() => checkAuditRow(rehash({ ...base, details: { note: SECRET_FORMS.biometricToken } }), 'prepared'))).toBe('AUDIT_SECRET_SHAPED_VALUE');
    expect(codeOf(() => checkAuditRow(rehash({ ...base, details: { nested: { a: 1 } as never } }), 'prepared'))).toBe('AUDIT_DETAILS_NOT_FLAT');
    expect(codeOf(() => checkAuditRow(rehash({ ...base, message: 'a\ud800' }), 'prepared'))).toBe('AUDIT_TEXT_INVALID');
    expect(codeOf(() => checkAuditRow(rehash({ ...base, actorId: 'a typed name' }), 'prepared'))).toBe('AUDIT_ACTOR_INVALID');
  });

  it('the stored form of a row is the mapping module\'s: the writers map nothing themselves (MR-1)', () => {
    const row = built();
    expect(checkAuditRow(row, 'prepared')).toEqual(auditRowToRow(row));
    // A row with no default in it: every member is carried over as it is.
    const full = appendAudit(
      { rows: [row], head: row.hash, total: 1, dropped: 0 },
      { type: 'FAULT_RAISED', message: 'Fault raised', severity: 'CRITICAL', actorId: 'OPR-002', sessionId: 'SES-20261001-0002', evidenceId: 'EV-20261001-0002', deviceId: 'CAM-01', details: { kind: 'TAMPER', count: 2, cleared: false, target: null } },
      1_790_823_600_500,
    ).row;
    expect(checkAuditRow(full, 'prepared')).toEqual({
      seq: 2,
      id: 'AUD-000002',
      at: 1_790_823_600_500,
      type: 'FAULT_RAISED',
      category: 'DEVICE',
      severity: 'CRITICAL',
      actorId: 'OPR-002',
      message: 'Fault raised',
      sessionId: 'SES-20261001-0002',
      evidenceId: 'EV-20261001-0002',
      deviceId: 'CAM-01',
      details: { kind: 'TAMPER', count: 2, cleared: false, target: null },
      prevHash: row.hash,
      hash: full.hash,
    });
    expect(checkAuditRow(row, 'native')).toEqual({
      seq: 1,
      id: 'AUD-000001',
      at: 1_790_823_600_000,
      type: 'RECORDING_STARTED',
      category: 'SESSION',
      severity: 'INFO',
      actorId: 'OPR-001',
      message: 'Recording started',
      sessionId: 'SES-20261001-0001',
      evidenceId: null,
      deviceId: null,
      details: { profile: 'STANDARD_1080P25' },
      prevHash: GENESIS,
      hash: row.hash,
    });
    const event = { id: 'LOG-000003', seq: 3, at: 5, type: 'FAULT_RAISED', severity: 'CRITICAL', message: 'Fault', params: { kind: 'TAMPER' }, sessionId: null, deviceId: 'CAM-01' } as const;
    expect(checkEvent(event, 'prepared')).toEqual(eventToRow(event));
    // The category column is derived by the mapping module with the shared `eventCategory`.
    expect(checkEvent(event, 'prepared').category).toBe('SECURITY');
  });

  it('what cannot be stored exactly is refused by the mapping module\'s own rule, not by a copy of it', () => {
    const rehash = (body: ReturnType<typeof auditBody>): AuditRow => ({ ...body, prevHash: GENESIS, hash: chainHash(GENESIS, body) });
    const base = auditBody(built());
    expect(codeOf(() => checkAuditRow(rehash({ ...base, at: 1.5 }), 'prepared'))).toBe('NOT_SAFE_INTEGER');
    expect(codeOf(() => checkAuditRow(rehash({ ...base, at: Number.MAX_SAFE_INTEGER + 2 }), 'prepared'))).toBe('NOT_SAFE_INTEGER');
    const event = { id: 'LOG-000007', seq: 7, at: 1.5, type: 'AUTOSAVE', severity: 'INFO', message: 'Autosaved', params: {}, sessionId: null, deviceId: null } as const;
    expect(codeOf(() => checkEvent(event, 'prepared'))).toBe('NOT_SAFE_INTEGER');
    const refusal = (() => {
      try {
        checkAuditRow(rehash({ ...base, at: 1.5 }), 'prepared');
      } catch (error) {
        return error;
      }
      return null;
    })();
    expect(refusal).toBeInstanceOf(MappingError);
    expect((refusal as MappingError).place).toBe('audit_log.at (seq 1)');
  });

  it('the digest, the identifier, the category and the link fields are checked', () => {
    const row = built();
    expect(codeOf(() => checkAuditRow({ ...row, message: `${row.message} [altered]` }, 'prepared'))).toBe('AUDIT_ROW_HASH_MISMATCH');
    expect(codeOf(() => checkAuditRow({ ...row, hash: 'f'.repeat(64) }, 'prepared'))).toBe('AUDIT_ROW_HASH_MISMATCH');
    expect(codeOf(() => checkAuditRow({ ...row, id: 'AUD-000002' }, 'prepared'))).toBe('AUDIT_ROW_INVALID');
    expect(codeOf(() => checkAuditRow({ ...row, category: 'AUTH' }, 'prepared'))).toBe('AUDIT_ROW_INVALID');
    expect(codeOf(() => checkAuditRow({ ...row, seq: 0 }, 'prepared'))).toBe('AUDIT_ROW_INVALID');
    expect(codeOf(() => checkAuditRow({ ...row, seq: Number.NaN }, 'prepared'))).toBe('AUDIT_ROW_INVALID');
    expect(codeOf(() => checkAuditRow({ ...row, at: -1 }, 'prepared'))).toBe('AUDIT_ROW_INVALID');
    expect(codeOf(() => checkAuditRow({ ...row, prevHash: 'short' }, 'prepared'))).toBe('AUDIT_ROW_INVALID');
    expect(codeOf(() => checkAuditRow({ ...row, hash: row.prevHash }, 'prepared'))).toBe('AUDIT_ROW_INVALID');
    expect(codeOf(() => checkAuditRow({ ...row, type: 'NOT_A_TYPE' as never }, 'prepared'))).toBe('AUDIT_TYPE_UNKNOWN');
  });

  it('an event: sequence, identifier, time and type', () => {
    const good = { id: 'LOG-000007', seq: 7, at: 1, type: 'AUTOSAVE', severity: 'INFO', message: 'Autosaved', params: {}, sessionId: null, deviceId: null } as const;
    expect(codeOf(() => checkEvent(good, 'prepared'))).toBe('accepted');
    expect(codeOf(() => checkEvent({ ...good, id: 'LOG-000008' }, 'prepared'))).toBe('EVENT_ROW_INVALID');
    expect(codeOf(() => checkEvent({ ...good, seq: 0, id: 'LOG-000000' }, 'prepared'))).toBe('EVENT_ROW_INVALID');
    expect(codeOf(() => checkEvent({ ...good, at: -1 }, 'prepared'))).toBe('EVENT_ROW_INVALID');
    expect(codeOf(() => checkEvent({ ...good, type: 'NOPE' as never }, 'prepared'))).toBe('EVENT_TYPE_UNKNOWN');
    expect(codeOf(() => checkEvent({ ...good, params: { cookie: 'x' } }, 'prepared'))).toBe('EVENT_PARAM_KEY_FORBIDDEN');
  });
});
