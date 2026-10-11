/**
 * STT configuration: operations 90 to 92 of the Core API (task 3, blueprint row 113; requirement
 * R-8, decisions D20 and D24 — Q-STT-CFG confirmed; `masterplan/03_api_contract.md` (C3) §2.5;
 * table `stt_config`, `04_database_contract.md` §B.13).
 *
 * | # | operationId | Access | Audit on success |
 * |--:|-------------|--------|------------------|
 * | 90 | `getSttConfig` | AUTHENTICATED (every role) | NONE-R |
 * | 91 | `updateSttConfig` | CAPTURE_CONFIG (SUPERVISOR, TECHNICIAN); a body with `credential`: a web console session only (S99-09) | STT_CONFIG_CHANGED; none when nothing changed |
 * | 92 | `testSttConnection` | CAPTURE_CONFIG | none (no state change) |
 *
 * THE CREDENTIAL IS WRITE-ONLY (E-30/E-31; SEC35-14; the RK-12 pattern of op 89). A request may
 * carry a `credential` member; no answer, slice, log line or audit row ever carries the credential,
 * its reference target, a ciphertext or a nonce. An answer says only WHETHER one is configured
 * (`credentialSet`) and HOW it is held (`credentialKind`).
 *
 * A CHANGE APPLIES TO THE NEXT SESSION. Operation 91 is accepted while a session is open; the open
 * session keeps the snapshot taken at its start (`07_transcript_spec.md` §B.7). The answer says so
 * with `appliesFrom: 'NEXT_SESSION'`, and operation 90 with `pendingForNextSession: true`.
 *
 * LOOPBACK ONLY (OD-13). `endpoint` is `http://127.0.0.1` or `http://localhost` with an optional
 * port and path; anything else is `422 INVALID_INPUT` with `details.reason: ENDPOINT_NOT_LOOPBACK`.
 * The same pattern is the CHECK `stt_config_endpoint_loopback_check` of the table.
 *
 * The pure rule of an update (`planSttConfigUpdate`) lives here so that the in-app simulator and
 * the Core server decide every body the same way: one code path, two answerers.
 */
import { z } from 'zod';
import { AuditType, Permission } from '../sim/vocabulary';
import { API_BASE_PATH } from './constants';
import {
  AUTHENTICATED_ACCESS,
  CORE_SERVER_ONLY,
  CoreApiAuditNone,
  CoreApiMode,
  CoreApiTag,
  WEB_CONSOLE_ONLY_REASON,
  permissionAccess,
  type CoreApiRegistryOperation,
} from './contract-model';
import { BASIC_403_EXAMPLES, ERROR_EXAMPLES, EXAMPLE_INSTANT_MS, apiErrorExample, deniedExamples } from './example-parts';
import type { OperationExamples } from './examples';
import { INVALID_JSON, NOT_SIGNED_IN, SIM_V2_NOTE, forbidden, notPermitted } from './operation-parts';
import { API_ERROR_CODE_PATTERN } from './patterns';
import { epochMs, operatorId } from './schema-parts';
import { apiText } from './text';

// ═══════════════════════════════════════════════════════════════════════════════════════
// Value sets and constants
// ═══════════════════════════════════════════════════════════════════════════════════════

/** The two transcriber backends (OD-24; D7): the oMLX server of this Mac, and whisper.cpp on the Core. */
export const SttBackend = { OMLX_SERVER: 'omlx-server', CPU_LOCAL: 'cpu-local' } as const;
export type SttBackend = (typeof SttBackend)[keyof typeof SttBackend];
export const STT_BACKENDS = Object.values(SttBackend) as readonly SttBackend[];

/** How a stored credential is held (`dbc-3 §B.13`): a pointer, or ciphertext in the Core credential store. */
export const SttCredentialKind = { REFERENCE: 'REFERENCE', ENCRYPTED: 'ENCRYPTED' } as const;
export type SttCredentialKind = (typeof SttCredentialKind)[keyof typeof SttCredentialKind];

/** The three forms of the write-only `credential` member of operation 91. */
export const SttCredentialWriteKind = { REFERENCE: 'REFERENCE', SECRET: 'SECRET', CLEAR: 'CLEAR' } as const;
export type SttCredentialWriteKind = (typeof SttCredentialWriteKind)[keyof typeof SttCredentialWriteKind];

/** When a stored change takes effect: at once (idle), or at the start of the next session. */
export const SttAppliesFrom = { NOW: 'NOW', NEXT_SESSION: 'NEXT_SESSION' } as const;
export type SttAppliesFrom = (typeof SttAppliesFrom)[keyof typeof SttAppliesFrom];

/** `details.reason` of the three named `422 INVALID_INPUT` refusals of operation 91 (C3 §2.5). */
export const SttConfigRefusalReason = {
  ENDPOINT_NOT_LOOPBACK: 'ENDPOINT_NOT_LOOPBACK',
  LANGUAGE_NOT_SUPPORTED: 'LANGUAGE_NOT_SUPPORTED',
  BACKEND_UNKNOWN: 'BACKEND_UNKNOWN',
} as const;
export type SttConfigRefusalReason = (typeof SttConfigRefusalReason)[keyof typeof SttConfigRefusalReason];

/**
 * The message of the STT_CONFIG_CHANGED row, whoever writes it: the Core server (operation 91) and
 * the in-app simulator (row 113 fix round 1, navigator finding N-10). Fixed: it names no field and no value.
 */
export const STT_CONFIG_CHANGED_MESSAGE = 'STT configuration changed';

/**
 * The fields a test of the connection tests. A change of one of them makes the outcome of the last
 * test (`lastTest`) the outcome of ANOTHER configuration, so it is forgotten (navigator finding N-5).
 */
export const STT_TESTED_FIELDS = ['backend', 'endpoint', 'model', 'credential'] as const satisfies readonly SttConfigField[];

/** True when a change with these fields leaves `lastTest` describing a configuration that was never tested. */
export function sttChangeInvalidatesLastTest(changedFields: readonly SttConfigField[]): boolean {
  return changedFields.some((field) => (STT_TESTED_FIELDS as readonly string[]).includes(field));
}

/** `details.reason` of the `409 INVALID_STATE` of a stale `revision` (the optimistic lock of op 91). */
export const STT_REVISION_CONFLICT_REASON = 'REVISION_CONFLICT';
/** `details.reason` of the `503 NOT_READY` of operation 92 when no transcriber probe can run (C3 §2.5). */
export const STT_TRANSCRIBER_NOT_READY_REASON = 'TRANSCRIBER_NOT_READY';
/** `details.reason` of the `503 NOT_READY` of a `SECRET` write while the Core credential store is not mounted. */
export const STT_CREDENTIAL_STORE_NOT_READY_REASON = 'CREDENTIAL_STORE_NOT_READY';

/** The only language the product transcribes (OD-20). */
export const STT_LANGUAGE = 'id';

/**
 * The loopback-only endpoint form (OD-13): the same text as the CHECK
 * `stt_config_endpoint_loopback_check` (`apps/core-server/src/db/schema/stt.ts`). No user part, no
 * other host, no TLS scheme: a host that merely starts with `localhost` does not match.
 */
export const STT_LOOPBACK_ENDPOINT_PATTERN = /^http:\/\/(127\.0\.0\.1|localhost)(:[0-9]{1,5})?(\/.*)?$/;
export const STT_ENDPOINT_MAX_LENGTH = 512;
export const STT_MODEL_MAX_LENGTH = 255;

/**
 * A model IDENTIFIER (row 113 fix round 1; controller ruling on the row-76 navigator's finding):
 * `stt_config.model` names a model, it is never a file name or a path. For `cpu-local` the
 * transcriber maps the id to `<modelDir>/<id>.bin`; for `omlx-server` the id is sent as it is.
 * The ids in use are all of this form: `ggml-large-v3-turbo` (the seeded default),
 * `whisper-large-v3-turbo`, `mlx-community--whisper-large-v3-turbo-asr-fp16`.
 *
 * 1 to 128 characters of `A-Z a-z 0-9 . _ -`, the first a letter or a digit. So: no path
 * separator of either kind, no leading `/` or `-`, no white space, no NUL or control character;
 * and by the three look-aheads no `..` anywhere, no trailing `.` (`model.` would name the file
 * `model..bin`; navigator re-check R-4) and no trailing `.bin` (the id is not the file).
 * The one pattern is what operation 91 validates with, what the OpenAPI document shows and what
 * the transcriber imports.
 */
export const STT_MODEL_ID_MAX_LENGTH = 128;
export const STT_MODEL_ID_PATTERN = /^(?!.*\.\.)(?!.*\.$)(?!.*\.[bB][iI][nN]$)[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/;

/** True for a model identifier of the contract. Never throws; anything that is no text is none. */
export function isSttModelId(model: unknown): model is string {
  return typeof model === 'string' && STT_MODEL_ID_PATTERN.test(model);
}
export const STT_CREDENTIAL_VALUE_MAX_LENGTH = 4096;

/**
 * A credential REFERENCE: `<store>:<pointer>`, for example `omlx-settings:auth.api_key` (the key
 * itself stays in `~/.omlx/settings.json`; SEC35-14). A pointer, never key material: the form
 * leaves no room for white space or for a value with `=`.
 */
export const STT_CREDENTIAL_REF_PATTERN = /^[a-z][a-z0-9-]{0,31}:[A-Za-z0-9_.~/-]{1,200}$/;

/**
 * What an endpoint may not hold although the loopback form allows it in its path (task 3 row 115;
 * D71; pair-76 N-9): `?` and `#` (the request path a client appends would become part of the
 * query or of the fragment), a backslash, white space and control characters. The transcriber
 * refuses the same set (`assertLoopbackEndpoint`); with this, operation 91 never stores an
 * endpoint the transcriber would refuse. The table CHECK keeps the wider loopback form.
 */
// eslint-disable-next-line no-control-regex -- control characters are exactly what is refused here
export const STT_ENDPOINT_FORBIDDEN_PATTERN = /[?#\\\s\u0000-\u001f\u007f-\u009f]/;

/** True for a loopback endpoint with a port inside 1 to 65535 (when one is given). */
export function isSttLoopbackEndpoint(endpoint: string): boolean {
  const match = STT_LOOPBACK_ENDPOINT_PATTERN.exec(endpoint);
  if (match === null || endpoint.length > STT_ENDPOINT_MAX_LENGTH) return false;
  const port = match[2];
  if (port === undefined) return true;
  const value = Number(port.slice(1));
  return value >= 1 && value <= 65_535;
}

/**
 * The endpoint rule of operation 91 and of the simulator (row 115): a loopback endpoint that holds
 * no character of `STT_ENDPOINT_FORBIDDEN_PATTERN`. `isSttLoopbackEndpoint` keeps its meaning (the
 * form of the table CHECK), so the transcriber still tells the two refusals apart by their reason.
 */
export function isSttConfigEndpoint(endpoint: string): boolean {
  return isSttLoopbackEndpoint(endpoint) && !STT_ENDPOINT_FORBIDDEN_PATTERN.test(endpoint);
}

/**
 * The fields an update can change, in the order `changedFields` of STT_CONFIG_CHANGED lists them.
 * `credential` stands for the write-only member: its NAME may be audited, its value never.
 */
export const STT_CONFIG_FIELDS = ['enabled', 'backend', 'endpoint', 'model', 'language', 'diarization', 'credential'] as const;
export type SttConfigField = (typeof STT_CONFIG_FIELDS)[number];

/** Result codes of operation 92 (`detailCode`). An open SCREAMING_SNAKE set: the runtime row may add. */
export const SttConnectionDetailCode = {
  OK: 'OK',
  MODEL_NOT_AVAILABLE: 'MODEL_NOT_AVAILABLE',
  UNREACHABLE: 'UNREACHABLE',
  TIMEOUT: 'TIMEOUT',
  CREDENTIAL_REJECTED: 'CREDENTIAL_REJECTED',
  DISABLED: 'DISABLED',
} as const;
export type SttConnectionDetailCode = (typeof SttConnectionDetailCode)[keyof typeof SttConnectionDetailCode];

// ═══════════════════════════════════════════════════════════════════════════════════════
// Schemas
// ═══════════════════════════════════════════════════════════════════════════════════════

export const SttLastTestSchema = z
  .strictObject({
    reachable: z.boolean().describe('The backend answered the last test.'),
    modelAvailable: z.boolean().describe('The configured model was available at the last test.'),
    testedAt: epochMs().describe('When the last test ran, epoch milliseconds on the Core clock.'),
  })
  .describe('The outcome of the last `testSttConnection` call. No speed figure is ever recorded (D230).');
export type SttLastTest = z.output<typeof SttLastTestSchema>;

export const SttConfigSchema = z
  .strictObject({
    enabled: z.boolean().describe('False: no transcriber work in the next session; the package records `transcript.state = DISABLED`.'),
    backend: z.enum(STT_BACKENDS).describe('`omlx-server` (development on this Mac) or `cpu-local` (whisper.cpp on the Core).'),
    endpoint: apiText()
      .regex(STT_LOOPBACK_ENDPOINT_PATTERN)
      .max(STT_ENDPOINT_MAX_LENGTH)
      .optional()
      .describe('The loopback endpoint of the server backend (OD-13). Absent when none is stored.'),
    model: apiText().min(1).max(STT_MODEL_MAX_LENGTH).describe('Model id (server backend) or model reference (`cpu-local`). Never a secret.'),
    language: z.literal(STT_LANGUAGE).describe('Indonesian only (OD-20).'),
    diarization: z.boolean().describe('Speaker labelling on or off (R-5).'),
    credentialSet: z.boolean().describe('True when a credential is configured. The credential itself is never returned.'),
    credentialKind: z
      .enum([SttCredentialKind.REFERENCE, SttCredentialKind.ENCRYPTED])
      .optional()
      .describe('How the credential is held; absent when none is set. A flag, never a value.'),
    revision: z.int().min(1).describe('Optimistic revision: send it back in `updateSttConfig`.'),
    updatedBy: operatorId().optional().describe('The operator of the last change; absent for the seeded configuration.'),
    updatedAt: epochMs().describe('When the configuration last changed, epoch milliseconds.'),
    pendingForNextSession: z
      .boolean()
      .describe('True while a session is open and the stored configuration was changed after it started: the change applies to the next session.'),
    lastTest: SttLastTestSchema.optional(),
  })
  .describe(
    'The STT configuration (C3 §2.5 op 90). It carries `credentialSet` and `credentialKind` only: no credential, reference target, ciphertext or nonce exists in this shape.',
  );
export type SttConfig = z.output<typeof SttConfigSchema>;

/** Message of the rule that ties `ref` and `value` to `kind`. It quotes no input. */
export const STT_CREDENTIAL_WRITE_RULE_MESSAGE = 'A REFERENCE carries `ref` only, a SECRET carries `value` only, and CLEAR carries neither.';

/**
 * The write-only credential member of operation 91: `{ kind: 'REFERENCE', ref }`,
 * `{ kind: 'SECRET', value }` or `{ kind: 'CLEAR' }` (C3 §2.5). It is ONE closed object with a rule
 * across its members rather than a union of three: a request schema of this contract holds no
 * union, so that every text member of every request is found mechanically and held to the text
 * rule (API-13; the Core server's contract walk). The rule accepts exactly the three forms.
 */
export const SttCredentialWriteSchema = z
  .strictObject({
    kind: z.enum([SttCredentialWriteKind.REFERENCE, SttCredentialWriteKind.SECRET, SttCredentialWriteKind.CLEAR]),
    ref: z
      .string()
      .regex(STT_CREDENTIAL_REF_PATTERN)
      .optional()
      .describe('REFERENCE only: a pointer `<store>:<pointer>`, e.g. `omlx-settings:auth.api_key`. Never key material. Write-only.'),
    value: apiText()
      .min(1)
      .max(STT_CREDENTIAL_VALUE_MAX_LENGTH)
      .optional()
      .describe('SECRET only: the secret. Write-only: stored encrypted, never returned, logged or audited, never pre-filled.'),
  })
  .refine(
    (credential) => {
      const hasRef = credential.ref !== undefined;
      const hasValue = credential.value !== undefined;
      if (credential.kind === SttCredentialWriteKind.REFERENCE) return hasRef && !hasValue;
      if (credential.kind === SttCredentialWriteKind.SECRET) return hasValue && !hasRef;
      return !hasRef && !hasValue;
    },
    { error: STT_CREDENTIAL_WRITE_RULE_MESSAGE },
  )
  .describe('Write-only credential of `updateSttConfig`: a reference (`ref`), a secret to store encrypted (`value`), or CLEAR. No answer echoes it.');
export type SttCredentialWrite = z.output<typeof SttCredentialWriteSchema>;

/**
 * Request body of operation 91. `backend`, `endpoint` and `language` are plain bounded texts here
 * on purpose: a value outside the contract is refused by the operation with its NAMED reason
 * (`BACKEND_UNKNOWN`, `ENDPOINT_NOT_LOOPBACK`, `LANGUAGE_NOT_SUPPORTED`), not by a nameless schema
 * refusal.
 */
export const SttConfigUpdateRequestSchema = z
  .strictObject({
    revision: z.int().min(1).describe('The `revision` of the configuration this update was made from (optimistic lock).'),
    enabled: z.boolean().optional(),
    backend: apiText().min(1).max(64).optional().describe(`One of ${STT_BACKENDS.join(', ')}; anything else: BACKEND_UNKNOWN.`),
    endpoint: apiText()
      .min(1)
      .max(2048)
      .optional()
      .describe('Loopback only: scheme `http`, host `127.0.0.1` or `localhost`, optional port and path, and no `?`, `#`, backslash, white space or control character; anything else: ENDPOINT_NOT_LOOPBACK.'),
    model: z
      .string()
      .regex(STT_MODEL_ID_PATTERN)
      .optional()
      .describe('A model IDENTIFIER, never a file name or a path: 1 to 128 of `A-Z a-z 0-9 . _ -`, starting with a letter or a digit, without `..` and without a trailing `.bin`. Anything else: 422 INVALID_INPUT.'),
    language: apiText().min(1).max(16).optional().describe(`Only \`${STT_LANGUAGE}\` (OD-20); anything else: LANGUAGE_NOT_SUPPORTED.`),
    diarization: z.boolean().optional(),
    credential: SttCredentialWriteSchema.optional(),
  })
  .describe('Request body of `POST /api/v1/transcription/config` (C3 §2.5 op 91): `revision` plus the members to change.');
export type SttConfigUpdateRequest = z.output<typeof SttConfigUpdateRequestSchema>;

export const SttConfigUpdateResultSchema = SttConfigSchema.extend({
  appliesFrom: z
    .enum([SttAppliesFrom.NOW, SttAppliesFrom.NEXT_SESSION])
    .describe('`NEXT_SESSION` while a session is open (it keeps the snapshot of its start); `NOW` when idle.'),
}).describe('The stored configuration after `updateSttConfig`, with when it takes effect. Never the credential.');
export type SttConfigUpdateResult = z.output<typeof SttConfigUpdateResultSchema>;

export const SttConnectionTestSchema = z
  .strictObject({
    reachable: z.boolean().describe('The backend answered. `false` is a 200 result, not an HTTP error.'),
    modelAvailable: z.boolean().describe('The configured model is available on the backend.'),
    backend: z.enum(STT_BACKENDS),
    detailCode: z.string().regex(API_ERROR_CODE_PATTERN).max(64).describe('A SCREAMING_SNAKE result code, e.g. OK, UNREACHABLE, MODEL_NOT_AVAILABLE.'),
  })
  .describe('The result of `testSttConnection` (C3 §2.5 op 92). No audio is sent and no speed figure is reported (D230).');
export type SttConnectionTest = z.output<typeof SttConnectionTestSchema>;

/** The schemas operations 90 to 92 add (merged into `CORE_API_SCHEMAS`). */
export const STT_CONFIG_SCHEMAS = {
  SttLastTest: SttLastTestSchema,
  SttConfig: SttConfigSchema,
  SttCredentialWrite: SttCredentialWriteSchema,
  SttConfigUpdateRequest: SttConfigUpdateRequestSchema,
  SttConfigUpdateResult: SttConfigUpdateResultSchema,
  SttConnectionTest: SttConnectionTestSchema,
} as const;

// ═══════════════════════════════════════════════════════════════════════════════════════
// The rule of an update (shared by the simulator and the Core server)
// ═══════════════════════════════════════════════════════════════════════════════════════

/** What an update is decided against: the stored, non-secret part of the configuration. */
export interface SttConfigStored {
  readonly enabled: boolean;
  readonly backend: SttBackend;
  readonly endpoint: string | null;
  readonly model: string;
  readonly language: string;
  readonly diarization: boolean;
  readonly credentialKind: SttCredentialKind | null;
  readonly revision: number;
}

/** The non-secret values after an accepted update. */
export type SttConfigValues = Pick<SttConfigStored, 'enabled' | 'backend' | 'endpoint' | 'model' | 'language' | 'diarization'>;

export type SttConfigPlan =
  /** A stale `revision`: 409, nothing stored. `currentRevision` is not a secret. */
  | { readonly ok: false; readonly status: 409; readonly reason: typeof STT_REVISION_CONFLICT_REASON; readonly currentRevision: number }
  /** A value the contract refuses: 422, with the named reason when C3 names one. */
  | { readonly ok: false; readonly status: 422; readonly reason: SttConfigRefusalReason | null }
  | {
      readonly ok: true;
      readonly values: SttConfigValues;
      /** Field NAMES, in the order of `STT_CONFIG_FIELDS`; empty when the update changes nothing. */
      readonly changedFields: readonly SttConfigField[];
      /** The credential write to apply, or null when the update leaves the credential alone. */
      readonly credential: SttCredentialWrite | null;
      readonly credentialChanged: boolean;
    };

/**
 * Decides an update against the stored configuration. Pure: no clock, no store, no secret kept.
 *
 * Order of the refusals: the stale revision first (409), then the named values (backend, language,
 * endpoint), then the cross-field rule of the table (`omlx-server` needs an endpoint). A member
 * that equals the stored value is not a change; a `credential` member of kind REFERENCE or SECRET
 * always is (the stored value cannot be compared — it is never read back), and CLEAR is one only
 * when a credential is set.
 */
export function planSttConfigUpdate(current: SttConfigStored, update: SttConfigUpdateRequest): SttConfigPlan {
  if (update.revision !== current.revision) {
    return { ok: false, status: 409, reason: STT_REVISION_CONFLICT_REASON, currentRevision: current.revision };
  }
  if (update.backend !== undefined && !(STT_BACKENDS as readonly string[]).includes(update.backend)) {
    return { ok: false, status: 422, reason: SttConfigRefusalReason.BACKEND_UNKNOWN };
  }
  if (update.language !== undefined && update.language !== STT_LANGUAGE) {
    return { ok: false, status: 422, reason: SttConfigRefusalReason.LANGUAGE_NOT_SUPPORTED };
  }
  // The schema of the body holds the same rule (stage 7); held here too, for a caller that built the update itself.
  if (update.model !== undefined && !isSttModelId(update.model)) return { ok: false, status: 422, reason: null };
  if (update.endpoint !== undefined && !isSttConfigEndpoint(update.endpoint)) {
    return { ok: false, status: 422, reason: SttConfigRefusalReason.ENDPOINT_NOT_LOOPBACK };
  }
  const values: SttConfigValues = {
    enabled: update.enabled ?? current.enabled,
    backend: (update.backend as SttBackend | undefined) ?? current.backend,
    endpoint: update.endpoint ?? current.endpoint,
    model: update.model ?? current.model,
    language: update.language ?? current.language,
    diarization: update.diarization ?? current.diarization,
  };
  // The table's own rule (`stt_config_endpoint_required_check`): refused here, before a statement.
  if (values.backend === SttBackend.OMLX_SERVER && values.endpoint === null) return { ok: false, status: 422, reason: null };

  const credential = update.credential ?? null;
  const credentialChanged = credential !== null && (credential.kind !== SttCredentialWriteKind.CLEAR || current.credentialKind !== null);
  const changed = new Set<SttConfigField>();
  for (const field of ['enabled', 'backend', 'endpoint', 'model', 'language', 'diarization'] as const) {
    if (values[field] !== current[field]) changed.add(field);
  }
  if (credentialChanged) changed.add('credential');
  return {
    ok: true,
    values,
    changedFields: STT_CONFIG_FIELDS.filter((field) => changed.has(field)),
    credential: credentialChanged ? credential : null,
    credentialChanged,
  };
}

/** How the credential is held after `write` is applied; null when none is set. */
export function sttCredentialKindAfter(current: SttCredentialKind | null, write: SttCredentialWrite | null): SttCredentialKind | null {
  if (write === null) return current;
  if (write.kind === SttCredentialWriteKind.CLEAR) return null;
  return write.kind === SttCredentialWriteKind.REFERENCE ? SttCredentialKind.REFERENCE : SttCredentialKind.ENCRYPTED;
}

/**
 * `details` of STT_CONFIG_CHANGED, exactly the five keys of C3 §2.5. `changedFields` is the field
 * NAMES joined with a comma: an audit detail is a flat map (no list value can be stored), and a
 * name of this closed set holds no comma. Never a value of the endpoint, the model or the credential.
 */
export function sttConfigChangedDetails(input: {
  readonly changedFields: readonly SttConfigField[];
  readonly enabled: boolean;
  readonly backend: SttBackend;
  readonly credentialChanged: boolean;
  readonly revision: number;
}): { changedFields: string; enabled: boolean; backend: SttBackend; credentialChanged: boolean; revision: number } {
  return {
    changedFields: input.changedFields.join(','),
    enabled: input.enabled,
    backend: input.backend,
    credentialChanged: input.credentialChanged,
    revision: input.revision,
  };
}

// ═══════════════════════════════════════════════════════════════════════════════════════
// Operations
// ═══════════════════════════════════════════════════════════════════════════════════════

export const STT_CONFIG_PATH = `${API_BASE_PATH}/transcription/config`;
export const STT_CONFIG_TEST_PATH = `${STT_CONFIG_PATH}/test`;
const CAPTURE_CONFIG = permissionAccess(Permission.CAPTURE_CONFIG);
const DENIED = { denial: AuditType.ACCESS_DENIED } as const;
const NEVER_RETURNED =
  '**The credential is write-only** (E-30/E-31; SEC35-14): no answer, slice, log line or audit row carries the credential, its reference target, a ciphertext or a nonce. An answer says only whether one is set (`credentialSet`) and how it is held (`credentialKind`).';
/**
 * Operation 91 with a credential in its body (security review S99-09; ruling D241): the rule of the
 * condition `WEB_CONSOLE_SESSION` (operations 89, 95, 96), applied by the handler because it depends
 * on the BODY, which the access rule never reads. The access member of the operation is unchanged.
 */
export const STT_CREDENTIAL_WEB_CONSOLE_ONLY =
  `**A body that carries \`credential\` is web console only** (S99-09; the rule of \`WEB_CONSOLE_SESSION\` on operations 89, 95 and 96): a session of a tablet or a phone that sends the member - \`SECRET\`, \`REFERENCE\` or \`CLEAR\` - is refused \`403 NOT_PERMITTED\` with \`details.reason: ${WEB_CONSOLE_ONLY_REASON}\` and one ACCESS_DENIED row, before the credential is read, sealed or stored. The same session may send every other member: a change without \`credential\` is not refused for the console.`;
/** The 403 part of that rule: an \`extra\` of \`notPermitted\`. */
export const STT_CREDENTIAL_WEB_CONSOLE_ONLY_REFUSED = `the body carries \`credential\` and the operator's session is bound to a paired tablet or phone (NOT_PERMITTED, \`details.reason: ${WEB_CONSOLE_ONLY_REASON}\`; one ACCESS_DENIED audit row; refused before the credential is used)`;

export const STT_CONFIG_OPERATIONS = [
  {
    operationId: 'getSttConfig',
    method: 'get',
    path: STT_CONFIG_PATH,
    tag: CoreApiTag.DEVICE,
    mode: CoreApiMode.SIMULATED,
    summary: 'STT configuration',
    description: [
      'The speech-to-text configuration of the Core (R-8): enabled or disabled, the backend, the loopback endpoint of the server backend, the model, the language (Indonesian only, OD-20) and speaker labelling.',
      NEVER_RETURNED,
      '`pendingForNextSession` is true while a session is open and the stored configuration was changed after that session started: the open session keeps the snapshot of its start. `lastTest` is the outcome of the last `testSttConnection` call since the server started.',
      'Needs a signed-in operator. Every role may read it: tablets and phones show it as a read-only status.',
      SIM_V2_NOTE,
    ].join('\n\n'),
    source: 'Task 3 M6, blueprint row 113; C3 §2.5 operation 90; R-8, D20/D24 (not in the design book)',
    responses: {
      200: { description: 'The STT configuration, without any credential.', schema: 'SttConfig' },
      401: NOT_SIGNED_IN,
      // Every role may read it, so no seeded role can be refused; the 403 is the Origin / revoked-device
      // guard only the Core server sends (01_specs §7.19) — the marking of the capture reads (RECON-A).
      403: { ...forbidden(), services: CORE_SERVER_ONLY },
    },
    access: AUTHENTICATED_ACCESS,
    audit: { success: CoreApiAuditNone.READ, ...DENIED },
    services: CORE_SERVER_ONLY,
  },
  {
    operationId: 'updateSttConfig',
    method: 'post',
    path: STT_CONFIG_PATH,
    tag: CoreApiTag.DEVICE,
    mode: CoreApiMode.SIMULATED,
    summary: 'Change the STT configuration',
    description: [
      'Stores a change of the STT configuration. Needs CAPTURE_CONFIG — SUPERVISOR and TECHNICIAN hold it (the permission of the device selector). The body names `revision` (the optimistic lock) and the members to change.',
      '**Accepted while a session is open, applied to the next one.** The open session keeps the snapshot taken at its start; the answer carries `appliesFrom: NEXT_SESSION` (and `pendingForNextSession: true`). When idle the answer carries `appliesFrom: NOW`.',
      NEVER_RETURNED,
      STT_CREDENTIAL_WEB_CONSOLE_ONLY,
      'On success writes one STT_CONFIG_CHANGED row whose details are exactly `changedFields` (the changed field NAMES, comma-joined; never a value), `enabled`, `backend`, `credentialChanged` and `revision`. An update that changes nothing writes no row and keeps the revision. No row on a refusal.',
      'Refusals: a stale `revision` answers `409 INVALID_STATE` with `details.reason: REVISION_CONFLICT`; a value outside the contract answers `422 INVALID_INPUT` with `details.reason` `ENDPOINT_NOT_LOOPBACK` (OD-13: loopback only), `LANGUAGE_NOT_SUPPORTED` or `BACKEND_UNKNOWN`. On the Core server a `SECRET` credential answers `503 NOT_READY` (`details.reason: CREDENTIAL_STORE_NOT_READY`) while the Core credential store is not mounted. The in-app simulator has no credential store to wait for: it accepts a `SECRET` opaquely, keeps nothing of it and answers `credentialKind: ENCRYPTED` (as it does for the camera credential of operation 89).',
      'A change of the backend, the endpoint, the model or the credential forgets `lastTest`: the last test tested another configuration.',
      SIM_V2_NOTE,
    ].join('\n\n'),
    source: 'Task 3 M6, blueprint row 113; C3 §2.5 operation 91; R-8, D20/D24; register E-30/E-31 (not in the design book)',
    requestBody: { schema: 'SttConfigUpdateRequest', required: true },
    responses: {
      200: { description: 'The stored configuration and when it applies. Never the credential.', schema: 'SttConfigUpdateResult' },
      400: INVALID_JSON,
      401: NOT_SIGNED_IN,
      403: notPermitted(Permission.CAPTURE_CONFIG, STT_CREDENTIAL_WEB_CONSOLE_ONLY_REFUSED),
      409: {
        description: 'The `revision` of the body is not the stored one: re-read operation 90 (INVALID_STATE, `details.reason: REVISION_CONFLICT`). Nothing is stored and no audit row is written.',
        schema: 'ApiError',
      },
      422: {
        description:
          'The body does not match its schema, or a value is outside the contract (INVALID_INPUT; `details.reason`: ENDPOINT_NOT_LOOPBACK, LANGUAGE_NOT_SUPPORTED or BACKEND_UNKNOWN). The refusal never quotes the input.',
        schema: 'ApiError',
      },
    },
    access: CAPTURE_CONFIG,
    audit: { success: AuditType.STT_CONFIG_CHANGED, ...DENIED },
    services: CORE_SERVER_ONLY,
  },
  {
    operationId: 'testSttConnection',
    method: 'post',
    path: STT_CONFIG_TEST_PATH,
    tag: CoreApiTag.DEVICE,
    mode: CoreApiMode.SIMULATED,
    summary: 'Test the STT connection',
    description: [
      'Tests the **stored** configuration: one loopback request to the configured backend (model list / health) with a short time limit. No body. Needs CAPTURE_CONFIG.',
      '`reachable: false` is a 200 result, not an HTTP error. The test never sends audio, never starts, stops or restarts the backend (D7(d)) and never reports a speed figure (D230). It changes no state and writes no audit row.',
      'On the Core server the answer is `503 NOT_READY` with `details.reason: TRANSCRIBER_NOT_READY` while no transcriber probe can run, or while too many tests are already waiting. The in-app simulator contacts nothing and always answers 200: an enabled configuration "answers", a disabled one does not.',
      NEVER_RETURNED,
      SIM_V2_NOTE,
    ].join('\n\n'),
    source: 'Task 3 M6, blueprint row 113; C3 §2.5 operation 92; R-8, D20/D24; D7(d), D230 (not in the design book)',
    responses: {
      200: { description: 'The result of the test.', schema: 'SttConnectionTest' },
      401: NOT_SIGNED_IN,
      403: notPermitted(Permission.CAPTURE_CONFIG),
    },
    access: CAPTURE_CONFIG,
    audit: { success: CoreApiAuditNone.PARITY, ...DENIED },
    services: CORE_SERVER_ONLY,
  },
] as const satisfies readonly CoreApiRegistryOperation[];

// ═══════════════════════════════════════════════════════════════════════════════════════
// Examples
// ═══════════════════════════════════════════════════════════════════════════════════════

/** The seeded configuration (Q-STT-CFG item 11, D24): enabled, `cpu-local`, no endpoint, no credential. */
export const STT_CONFIG_DEFAULT = {
  enabled: true,
  backend: SttBackend.CPU_LOCAL,
  endpoint: null,
  model: 'ggml-large-v3-turbo',
  language: STT_LANGUAGE,
  diarization: true,
} as const satisfies SttConfigValues;

const EXAMPLE_CONFIG = {
  enabled: STT_CONFIG_DEFAULT.enabled,
  backend: STT_CONFIG_DEFAULT.backend,
  model: STT_CONFIG_DEFAULT.model,
  language: STT_LANGUAGE,
  diarization: STT_CONFIG_DEFAULT.diarization,
  credentialSet: false,
  revision: 1,
  updatedAt: EXAMPLE_INSTANT_MS,
  pendingForNextSession: false,
} as const satisfies SttConfig;

/**
 * After an edit: labelling off, a credential held by reference. No example carries an `endpoint`:
 * the document names no host but its own servers (test/openapi.test.ts), and a loopback URL of a
 * third service is not one of them.
 */
const EXAMPLE_EDITED_CONFIG = {
  enabled: true,
  backend: SttBackend.CPU_LOCAL,
  model: STT_CONFIG_DEFAULT.model,
  language: STT_LANGUAGE,
  diarization: false,
  credentialSet: true,
  credentialKind: SttCredentialKind.REFERENCE,
  revision: 2,
  updatedBy: 'OPR-003',
  updatedAt: EXAMPLE_INSTANT_MS,
  pendingForNextSession: false,
} as const satisfies SttConfig;

const SIGNED_OUT = { notSignedIn: ERROR_EXAMPLES.notSignedIn } as const;
/** The 403 of operation 91 for a body with `credential` from a tablet or phone session (S99-09): the Core server's own text and details. */
export const STT_WEB_CONSOLE_ONLY_EXAMPLE = {
  summary: 'A tablet or phone session sends a credential',
  description: 'The caller holds CAPTURE_CONFIG, but the session is bound to a paired device and the body carries `credential`. One ACCESS_DENIED row is written; the credential is not used. The same body without `credential` is stored.',
  value: apiErrorExample('NOT_PERMITTED', 'This action is available on the web console only. The attempt was audited.', {
    operationId: 'updateSttConfig',
    permission: Permission.CAPTURE_CONFIG,
    role: 'TECHNICIAN',
    reason: WEB_CONSOLE_ONLY_REASON,
  }),
} as const;

export const STT_CONFIG_EXAMPLES: Readonly<Record<string, OperationExamples>> = {
  getSttConfig: {
    responses: {
      200: {
        seeded: { summary: 'The seeded configuration: enabled, cpu-local, no credential', value: EXAMPLE_CONFIG },
        edited: { summary: 'After an edit: a credential held by reference (never the value)', value: EXAMPLE_EDITED_CONFIG },
      },
      401: SIGNED_OUT,
      403: BASIC_403_EXAMPLES,
    },
  },
  updateSttConfig: {
    // Placeholders only: an example must never carry anything that reads like a real credential
    // (E-30; the API Reference offers no pre-filled credential for this operation).
    request: {
      disable: { summary: 'Switch transcription off', value: { revision: 1, enabled: false } satisfies SttConfigUpdateRequest },
      reference: {
        summary: 'Labelling off, and the credential by reference (a pointer, never the key)',
        value: {
          revision: 1,
          diarization: false,
          credential: { kind: SttCredentialWriteKind.REFERENCE, ref: 'omlx-settings:auth.api_key' },
        } satisfies SttConfigUpdateRequest,
      },
    },
    responses: {
      200: {
        idle: { summary: 'Stored while idle: applies now', value: { ...EXAMPLE_EDITED_CONFIG, appliesFrom: SttAppliesFrom.NOW } satisfies SttConfigUpdateResult },
        sessionOpen: {
          summary: 'Stored while a session is open: applies to the next session',
          value: { ...EXAMPLE_EDITED_CONFIG, pendingForNextSession: true, appliesFrom: SttAppliesFrom.NEXT_SESSION } satisfies SttConfigUpdateResult,
        },
      },
      400: { invalidJson: ERROR_EXAMPLES.invalidJson },
      401: SIGNED_OUT,
      403: { ...deniedExamples('updateSttConfig', 'CAPTURE_CONFIG', 'INVESTIGATOR'), webConsoleOnly: STT_WEB_CONSOLE_ONLY_EXAMPLE },
      409: {
        revisionConflict: {
          summary: 'The revision of the body is stale',
          value: apiErrorExample('INVALID_STATE', 'The STT configuration changed since it was read. Read it again.', {
            reason: STT_REVISION_CONFLICT_REASON,
            currentRevision: 2,
          }),
        },
      },
      422: {
        invalidInput: ERROR_EXAMPLES.invalidInput,
        endpointNotLoopback: {
          summary: 'An endpoint that is not on loopback',
          value: apiErrorExample('INVALID_INPUT', 'The STT endpoint must be a loopback address.', {
            in: 'body',
            reason: SttConfigRefusalReason.ENDPOINT_NOT_LOOPBACK,
          }),
        },
      },
    },
  },
  testSttConnection: {
    responses: {
      200: {
        reachable: {
          summary: 'The backend answered and has the model',
          value: { reachable: true, modelAvailable: true, backend: SttBackend.CPU_LOCAL, detailCode: SttConnectionDetailCode.OK } satisfies SttConnectionTest,
        },
        unreachable: {
          summary: 'The backend did not answer: a result, not an error',
          value: {
            reachable: false,
            modelAvailable: false,
            backend: SttBackend.OMLX_SERVER,
            detailCode: SttConnectionDetailCode.UNREACHABLE,
          } satisfies SttConnectionTest,
        },
      },
      401: SIGNED_OUT,
      403: deniedExamples('testSttConnection', 'CAPTURE_CONFIG', 'INVESTIGATOR'),
    },
  },
};
