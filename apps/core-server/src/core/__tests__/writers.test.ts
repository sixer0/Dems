// The rules of the two writers, database-free (plan row W21; spec §13, SR-54, SR-65, ENG-12;
// database contract §2.4, §5.5): the vocabulary, the row shape, the payload map, the allow-list
// of the nine server-written types, and the never-log rule. A refusal is a `CoreError` whose
// code names the rule and whose text quotes nothing of the row.
import { AUDIT_TYPE_CATEGORY, AuditType, SIM_EVENT_CATEGORY, SimEventType, appendAudit, auditBody, chainHash, type AuditRow } from '@dems/shared/sim';
import { describe, expect, it } from 'vitest';
import { MappingError, auditRowToRow, eventToRow } from '../../db/mapping';
import { AUDIT_DETAIL_FORBIDDEN_KEYS, EVENT_CATEGORY } from '../../db/schema/value-sets';
import { SERVER_AUDIT_DETAIL_RULES, detailRulesOf } from '../audit-details';
import { auditInputOf, checkAuditRow } from '../audit-writer';
import { CoreError } from '../errors';
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
  it('every one of the 67 shared audit types is accepted, with the category of the shared map', () => {
    const types = Object.values(AuditType);
    // C3 §2.5 (blueprint row 113): 62 + STT_CONFIG_CHANGED = 63. C3 §5.2, §10.1 (blueprint row 132,
    // decision D106): + the four of the camera search, the test, the adoption and the no-device warning = 67.
    expect(types).toHaveLength(67);
    const typed = new Set<string>(Object.keys(SERVER_AUDIT_DETAIL_RULES));
    for (const type of types.filter((candidate) => !typed.has(candidate))) {
      const input = auditInputOf(audit({ type }));
      const { row } = appendAudit({ rows: [], head: GENESIS, total: 0, dropped: 0 }, input, 1);
      expect(row.category, type).toBe(AUDIT_TYPE_CATEGORY[type]);
      expect(codeOf(() => checkAuditRow(row, 'native')), type).toBe('accepted');
    }
  });

  it('a type outside the vocabulary is refused, also one that only has the right format', () => {
    for (const type of ['USER_DELETED', 'system_boot', '', 7, undefined]) {
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

describe('the allow-list of the twenty-three server-written types (spec §13.1; C3 §5.2, §2.5)', () => {
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
    CAPTURE_CREDENTIAL_REVEALED: [{ type: 'CAPTURE_CREDENTIAL_REVEALED', actorId: 'OPR-002', deviceId: null, message: 'Credential revealed', details: { deviceId: 'CAM-01', reason: 'MEDIA_DIAGNOSTICS' } }],
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
  };

  it('covers exactly the twenty-three types the server writes; the simulator\'s 44 have no list', () => {
    const typed = Object.keys(SERVER_AUDIT_DETAIL_RULES).sort();
    expect(typed).toEqual(Object.keys(accepted).sort());
    expect(typed).toHaveLength(23);
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
      PAIRING_CODE_ISSUED: ['codeId', 'expiresAt'],
      PAIRING_CODE_CLOSED: ['codeId', 'reason'],
      DEVICE_REVOKED: ['reason', 'sessionsEnded', 'deviceId'],
      DEVICE_CREDENTIAL_ROTATED: ['deviceId'],
      ROLE_CHANGED: ['targetOperatorId', 'from', 'to', 'reason'],
      USER_ENABLED: ['targetOperatorId', 'reason'],
      USER_DISABLED: ['targetOperatorId', 'sessionsEnded', 'reason'],
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
      CAPTURE_CONNECTION_TESTED: ['candidateId', 'searchId', 'outcome', 'authenticated', 'adapter', 'sourceClass', 'operationId', 'host', 'endpointRef', 'guardTripped', 'permission'],
      CAPTURE_CANDIDATE_ADOPTED: ['deviceId', 'candidateId', 'searchId', 'adapter', 'sourceClass', 'credentialSet', 'operationId', 'host', 'endpointRef', 'permission'],
      CAPTURE_DEVICE_UNREACHABLE: ['deviceId', 'deviceKind', 'phase', 'reason', 'degraded', 'sessionId'],
    });
    expect(required).toEqual({
      ACCESS_DENIED: ['operationId'],
      PAIRING_CODE_ISSUED: ['codeId', 'expiresAt'],
      PAIRING_CODE_CLOSED: ['codeId', 'reason'],
      DEVICE_REVOKED: ['reason', 'sessionsEnded'],
      DEVICE_CREDENTIAL_ROTATED: [],
      ROLE_CHANGED: ['targetOperatorId', 'from', 'to'],
      USER_ENABLED: ['targetOperatorId'],
      USER_DISABLED: ['targetOperatorId', 'sessionsEnded'],
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
    });
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
