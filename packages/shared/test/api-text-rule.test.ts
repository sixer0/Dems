// Backend task 2026-10-04, plan row W19 (contract A): the text rule API-13 (SR-64; decisions D14
// SPEC-GAP-1 and D30 D-b; input to AC-B-93). Every string a client may send refuses U+0000 and an
// unpaired UTF-16 surrogate, the password included.
import { describe, expect, it } from 'vitest';
import type { z } from 'zod';
import {
  ADMINISTRATION_SCHEMAS,
  API_TEXT_RULE_MESSAGE,
  CORE_API_EXAMPLES,
  CORE_API_OPERATIONS,
  CORE_API_SCHEMAS,
  DEMO_SCHEMAS,
  DeviceRevokeRequestSchema,
  EvidenceExportRequestSchema,
  IDENTITY_SCHEMAS,
  PAIRING_SCHEMAS,
  PairingRedeemRequestSchema,
  SESSION_CREATE_MESSAGES,
  SIGN_IN_LIMITS,
  SessionStopRequestSchema,
  SignInRequestSchema,
  apiText,
  isWellFormedText,
  sessionCreateSchema,
  type CoreApiSchemaName,
} from '../src/api';

const NUL = '\u0000';
const HIGH = '\ud83d'; // a high surrogate with no low one
const LOW = '\ude00'; // a low surrogate with no high one
const PAIR = '😀'; // U+1F600, well formed

/** Texts the rule must refuse, whatever stands around them. */
const ILL_FORMED = [NUL, `a${NUL}b`, `${NUL}trailing`, HIGH, LOW, `ab${HIGH}`, `${LOW}ab`, `${HIGH}x${LOW}`, `${LOW}${HIGH}`];

interface Def {
  type: string;
  shape?: Record<string, z.ZodType>;
  innerType?: z.ZodType;
  element?: z.ZodType;
  options?: z.ZodType[];
  keyType?: z.ZodType;
  valueType?: z.ZodType;
  in?: z.ZodType;
  out?: z.ZodType;
}

/** Every string schema inside `schema`, with the path of members that leads to it. */
function stringLeaves(schema: z.ZodType, path = '(root)', out: [string, z.ZodType][] = []): [string, z.ZodType][] {
  const def = (schema as unknown as { _zod: { def: Def } })._zod.def;
  switch (def.type) {
    case 'string':
      out.push([path, schema]);
      break;
    case 'object':
      for (const [key, member] of Object.entries(def.shape ?? {})) stringLeaves(member, `${path}.${key}`, out);
      break;
    case 'optional':
    case 'nullable':
    case 'default':
    case 'readonly':
      if (def.innerType) stringLeaves(def.innerType, path, out);
      break;
    case 'array':
      if (def.element) stringLeaves(def.element, `${path}[]`, out);
      break;
    case 'union':
      for (const [index, option] of (def.options ?? []).entries()) stringLeaves(option, `${path}|${index}`, out);
      break;
    case 'record':
      if (def.keyType) stringLeaves(def.keyType, `${path}{key}`, out);
      if (def.valueType) stringLeaves(def.valueType, `${path}{value}`, out);
      break;
    case 'pipe':
      if (def.in) stringLeaves(def.in, path, out);
      if (def.out) stringLeaves(def.out, path, out);
      break;
    case 'enum':
    case 'literal':
    case 'boolean':
    case 'number':
    case 'int':
    case 'null':
      break;
    default:
      throw new Error(`stringLeaves: schema type "${def.type}" at ${path} is not handled; add it to the walker`);
  }
  return out;
}

function acceptsIllFormed(schema: z.ZodType): string[] {
  return ILL_FORMED.filter((text) => schema.safeParse(text).success).map((text) => JSON.stringify(text));
}

describe('isWellFormedText', () => {
  it('accepts ordinary text, the empty string, control characters other than U+0000, and surrogate pairs', () => {
    for (const text of ['', 'Interview completed', 'line one\nline two\ttab', '\u0001\u001f', 'Jl. Sudirman №5', PAIR, `a${PAIR}b${PAIR}`, '￿']) {
      expect(isWellFormedText(text), JSON.stringify(text)).toBe(true);
    }
  });

  it('refuses U+0000 and an unpaired surrogate at any position', () => {
    for (const text of ILL_FORMED) expect(isWellFormedText(text), JSON.stringify(text)).toBe(false);
    // A trailing high surrogate after a well-formed pair.
    expect(isWellFormedText(`${PAIR}${HIGH}`)).toBe(false);
  });

  it('agrees with the runtime where the runtime has String.prototype.isWellFormed', () => {
    const native = (String.prototype as { isWellFormed?: () => boolean }).isWellFormed;
    if (!native) return;
    for (const text of ['', 'abc', PAIR, HIGH, LOW, `${HIGH}${HIGH}${LOW}`, `x${LOW}${HIGH}y`, `${PAIR}${PAIR}`]) {
      expect(isWellFormedText(text), JSON.stringify(text)).toBe(native.call(text));
    }
  });

  it('why the rule exists: UTF-8 turns an unpaired surrogate into U+FFFD, so the stored text would differ from the hashed one', () => {
    // The hypothesis of 03_database_contract §13.1 (SPEC-GAP-1), confirmed on this runtime.
    expect(Buffer.from(HIGH, 'utf8').toString('hex')).toBe('efbfbd');
    expect(Buffer.from(`a${LOW}`, 'utf8').toString('utf8')).toBe('a�');
    expect(new TextEncoder().encode(HIGH)).toEqual(new Uint8Array([0xef, 0xbf, 0xbd]));
    // A well-formed pair survives the round trip.
    expect(Buffer.from(PAIR, 'utf8').toString('utf8')).toBe(PAIR);
  });
});

describe('apiText', () => {
  it('raises one issue with the rule\'s message, and the later checks do not run', () => {
    const schema = apiText()
      .overwrite((value) => value.trim())
      .min(5)
      .max(10);
    expect(schema.parse('  hello  ')).toBe('hello');
    const refused = schema.safeParse(NUL);
    expect(refused.success).toBe(false);
    expect(refused.error?.issues.map((issue) => issue.message)).toEqual([API_TEXT_RULE_MESSAGE]);
    // A text that is too short and well formed gets the length issue only.
    expect(schema.safeParse('hi').error?.issues.map((issue) => issue.code)).toEqual(['too_small']);
    expect(isWellFormedText(API_TEXT_RULE_MESSAGE)).toBe(true);
  });
});

describe('API-13 over the whole registry', () => {
  it('no string of any request body or query schema accepts U+0000 or an unpaired surrogate', () => {
    const checked: string[] = [];
    for (const operation of CORE_API_OPERATIONS) {
      const names = [operation.requestBody?.schema, operation.query?.schema].filter((name): name is CoreApiSchemaName => name !== undefined);
      for (const name of names) {
        for (const [path, leaf] of stringLeaves(CORE_API_SCHEMAS[name])) {
          expect(acceptsIllFormed(leaf), `${operation.operationId}: ${name}${path.replace('(root)', '')}`).toEqual([]);
          checked.push(`${name}${path}`);
        }
      }
    }
    // Changed by design (W27): 13 operations of contract A, 4 of the existing ten and 8 of contract C
    // take a body; 4 of contract C take a query.
    expect(CORE_API_OPERATIONS.filter((operation) => operation.requestBody).map((operation) => operation.operationId)).toHaveLength(25);
    expect(CORE_API_OPERATIONS.filter((operation) => operation.query).map((operation) => operation.operationId)).toHaveLength(4);
    expect(new Set(checked).size).toBeGreaterThanOrEqual(30);
    expect(checked).toContain('SignInRequest(root).password');
    expect(checked).toContain('DeviceRevokeRequest(root).reason');
    expect(checked).toContain('SessionCreateRequest(root).subjectName');
    expect(checked).toContain('EvidenceExportRequest(root).destination');
    // Contract C: the texts an operator types, and every string of a query.
    for (const leaf of [
      'SessionNoteRequest(root).text',
      'SessionMarkerRequest(root).label',
      'AuditExportRequest(root).reason',
      'AuditExportRequest(root).destination',
      'EvidenceListQuery(root).q',
      'EvidenceListQuery(root).cursor',
      'AuditListQuery(root).actorId',
      'AuditListQuery(root).sessionId',
      'AuditListQuery(root).evidenceId',
      'AuditListQuery(root).cursor',
      'EventListQuery(root).cursor',
      'PageQuery(root).cursor',
    ]) {
      expect(checked, leaf).toContain(leaf);
    }
  });

  it('a query yields only strings, numbers and booleans, has no required member and no default (decision D51)', () => {
    for (const operation of CORE_API_OPERATIONS) {
      if (!operation.query) continue;
      const schema = CORE_API_SCHEMAS[operation.query.schema];
      // No member is required and none has a default: a client that gives no query sends none.
      expect(schema.parse({}), operation.operationId).toEqual({});
      const shape = (schema as unknown as { _zod: { def: { shape: Record<string, z.ZodType> } } })._zod.def.shape;
      for (const [name, member] of Object.entries(shape)) {
        const def = (member as unknown as { _zod: { def: Def } })._zod.def;
        expect(def.type, `${operation.query.schema}.${name}`).toBe('optional');
        const inner = (def.innerType as unknown as { _zod: { def: Def } })._zod.def.type;
        expect(['string', 'enum', 'number'], `${operation.query.schema}.${name}: ${inner}`).toContain(inner);
      }
      // Unknown members are dropped, as in a body (API-4).
      expect(schema.parse({ stray: 'x' }), operation.operationId).toEqual({});
    }
  });

  it('no string of any schema of the backend task accepts them either, requests and answers alike', () => {
    let leaves = 0;
    for (const [name, schema] of Object.entries({ ...IDENTITY_SCHEMAS, ...ADMINISTRATION_SCHEMAS, ...PAIRING_SCHEMAS, ...DEMO_SCHEMAS })) {
      for (const [path, leaf] of stringLeaves(schema)) {
        expect(acceptsIllFormed(leaf), `${name}${path.replace('(root)', '')}`).toEqual([]);
        leaves += 1;
      }
    }
    expect(leaves).toBeGreaterThan(40);
  });

  it('API-13 holds for every string of the registry that the backend task added: the state, the socket and areas 4 to 11', () => {
    // W27: the rule is on for slice text since the engine cuts on a character boundary, so the
    // statement of API-13 ("every string schema of the registry") holds for all 112 schemas of the
    // backend task. The 18 schemas of the ten existing operations are the exception, by AC-B-13:
    // their answers describe what the simulator answers, and their request texts carry the rule.
    const names = Object.keys(CORE_API_SCHEMAS) as CoreApiSchemaName[];
    const added = names.slice(18);
    expect(added).toHaveLength(112);
    let leaves = 0;
    const open: string[] = [];
    for (const name of added) {
      for (const [path, leaf] of stringLeaves(CORE_API_SCHEMAS[name])) {
        if (acceptsIllFormed(leaf).length > 0) open.push(`${name}${path.replace('(root)', '')}`);
        leaves += 1;
      }
    }
    expect(open).toEqual([]);
    expect(leaves).toBeGreaterThan(900);
    // The slices of the state and the answers that are built from them are among them.
    for (const name of ['AuditRow', 'SessionSlice', 'EvidenceItem', 'DeviceInventory', 'AuditPage', 'EvidenceVerifyResult', 'AuditChainStatus', 'RealtimeSnapshot']) {
      expect(added, name).toContain(name);
    }
  });

  it('positive control: the walker finds a string that has no rule', () => {
    // The response schemas of the ten existing operations are untouched (AC-B-13): they describe
    // what the simulator answers, and a client never sends them.
    const leaves = stringLeaves(CORE_API_SCHEMAS.SessionResource);
    const open = leaves.filter(([, leaf]) => acceptsIllFormed(leaf).length > 0).map(([path]) => path);
    expect(open).toContain('(root).subjectName');
  });

  it('a request example with one string made ill-formed is refused, member by member', () => {
    let mutated = 0;
    const mutate = (value: unknown, visit: (replaced: unknown) => void, rebuild: (inner: unknown) => unknown = (inner) => inner): void => {
      if (typeof value === 'string') {
        for (const bad of [`${value}${NUL}`, `${value}${HIGH}`]) visit(rebuild(bad));
      } else if (Array.isArray(value)) {
        value.forEach((item, index) => mutate(item, visit, (inner) => rebuild(value.map((other, at) => (at === index ? inner : other)))));
      } else if (value && typeof value === 'object') {
        for (const [key, member] of Object.entries(value)) mutate(member, visit, (inner) => rebuild({ ...value, [key]: inner }));
      }
    };
    for (const operation of CORE_API_OPERATIONS) {
      if (!operation.requestBody) continue;
      const schema = CORE_API_SCHEMAS[operation.requestBody.schema];
      for (const example of Object.values(CORE_API_EXAMPLES[operation.operationId]?.request ?? {})) {
        expect(schema.safeParse(example.value).success, operation.operationId).toBe(true);
        mutate(example.value, (body) => {
          expect(schema.safeParse(body).success, `${operation.operationId}: ${JSON.stringify(body)}`).toBe(false);
          mutated += 1;
        });
      }
    }
    expect(mutated).toBeGreaterThan(40);
  });
});

describe('the fields the criteria name', () => {
  it('SignInRequest: the password is 1 to 128 code units, taken as sent, and carries the rule (D30 D-a, D-b)', () => {
    const ok = (password: string) => SignInRequestSchema.safeParse({ username: 'andi.pratama', password }).success;
    expect(ok('x')).toBe(true);
    expect(ok('p'.repeat(SIGN_IN_LIMITS.passwordMax))).toBe(true);
    expect(ok('p'.repeat(SIGN_IN_LIMITS.passwordMax + 1))).toBe(false);
    expect(ok('')).toBe(false);
    // Counted in UTF-16 code units: 64 pairs are 128 units, 65 pairs are 130.
    expect(ok(PAIR.repeat(64))).toBe(true);
    expect(ok(PAIR.repeat(65))).toBe(false);
    for (const bad of [`pass${NUL}word`, `pass${HIGH}`, LOW]) expect(ok(bad), JSON.stringify(bad)).toBe(false);
    // Not trimmed and not normalised: what was typed is what is verified.
    expect(SignInRequestSchema.parse({ username: ' Andi.Pratama ', password: '  spaced  ' })).toEqual({
      username: ' Andi.Pratama ',
      password: '  spaced  ',
    });
    expect(SignInRequestSchema.safeParse({ username: `andi${NUL}`, password: 'x' }).success).toBe(false);
    expect(SignInRequestSchema.safeParse({ username: 'u'.repeat(65), password: 'x' }).success).toBe(false);
  });

  it('AC-B-93 inputs: the revoke reason and the device name of a redeem', () => {
    expect(DeviceRevokeRequestSchema.safeParse({ reason: `Lost${NUL} tablet` }).success).toBe(false);
    expect(DeviceRevokeRequestSchema.safeParse({ reason: `Lost tablet ${HIGH}` }).success).toBe(false);
    expect(DeviceRevokeRequestSchema.parse({ reason: '  Lost tablet  ' })).toEqual({ reason: 'Lost tablet' });
    const redeem = { code: '000000', deviceName: 'Interview tablet 01', platform: 'android', appVersion: '0.2.0' };
    expect(PairingRedeemRequestSchema.safeParse(redeem).success).toBe(true);
    expect(PairingRedeemRequestSchema.safeParse({ ...redeem, deviceName: `Tablet${NUL}` }).success).toBe(false);
    expect(PairingRedeemRequestSchema.safeParse({ ...redeem, platform: LOW }).success).toBe(false);
    expect(PairingRedeemRequestSchema.safeParse({ ...redeem, appVersion: `0.2.0${HIGH}` }).success).toBe(false);
  });

  it('the ten existing operations: the session-create fields, the stop reason, the export reason and destination', () => {
    const create = {
      caseNumber: 'LP/2026/1001-0007',
      subjectType: 'TERSANGKA',
      subjectName: 'Ahmad Fauzi',
      investigatorId: 'OPR-001',
      room: 'Interview Room 1',
      profileId: 'STANDARD_1080P25',
    };
    expect(sessionCreateSchema.safeParse(create).success).toBe(true);
    for (const field of ['subjectName', 'room', 'notes', 'caseNumber', 'investigatorId'] as const) {
      for (const bad of [`Ahmad${NUL}Fauzi`, `Ahmad ${HIGH}`]) {
        const result = sessionCreateSchema.safeParse({ ...create, [field]: bad });
        expect(result.success, `${field} ${JSON.stringify(bad)}`).toBe(false);
        // One issue, on that field, with the contract's sentence. It is not one of the page's i18n keys:
        // the web test of the session page requires a resource for every key of SESSION_CREATE_MESSAGES.
        expect(result.error?.issues.map((issue) => [issue.path.join('.'), issue.message])).toEqual([[field, API_TEXT_RULE_MESSAGE]]);
        expect(Object.values(SESSION_CREATE_MESSAGES) as string[]).not.toContain(API_TEXT_RULE_MESSAGE);
      }
    }
    expect(SessionStopRequestSchema.safeParse({ reason: `Interview${NUL} completed` }).success).toBe(false);
    expect(SessionStopRequestSchema.parse({ reason: ' Interview completed ' })).toEqual({ reason: 'Interview completed' });
    expect(EvidenceExportRequestSchema.safeParse({ reason: `Prosecutor review ${LOW}` }).success).toBe(false);
    expect(EvidenceExportRequestSchema.safeParse({ reason: 'Prosecutor review', destination: `USB${NUL}` }).success).toBe(false);
    expect(EvidenceExportRequestSchema.safeParse({ reason: 'Prosecutor review', destination: `USB ${PAIR}` }).success).toBe(true);
  });
});
