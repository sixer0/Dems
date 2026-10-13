// The verify-v2 report members of operation 41 (blueprint row 141; requests of rows 85 and 119;
// C3 §3.1 erratum PE-128-32; evidence package spec §D, §D.1) and M7-SEC-SRC-2 at the contract:
// no operation ACCEPTS a source class.
import { describe, expect, it } from 'vitest';
import {
  CORE_API_OPERATIONS,
  CORE_API_SCHEMAS,
  EvidenceVerifyResultSchema,
  CORE_API_EXAMPLES,
  VERIFY_REPORT_CHECK_STATUSES,
  VERIFY_REPORT_FAILURE_CLASSES,
  VERIFY_REPORT_OVERALL,
  VERIFY_REPORT_SKIP_REASONS,
  VERIFY_REPORT_SOURCES_STATES,
  VERIFY_REPORT_SOURCE_CLASSES,
  VERIFY_REPORT_TRANSCRIPT_STATES,
} from '../src/api';
import { MANIFEST_SOURCE_CLASSES } from '../src/evidence-package';
import {
  SOURCES_STATE_REPORT,
  TRANSCRIPT_STATE_REPORT,
  VERIFY_FAILURES,
  VERIFY_V2_CHECKS,
  VerifiedSourcesState,
  VerifiedTranscriptState,
  VerifyCheckStatus,
  VerifyFailureClass,
  VerifySkipReason,
} from '../src/evidence-verify';
import openapi from '../openapi/openapi.json' with { type: 'json' };

const sorted = (values: readonly string[]): string[] => [...values].sort();
const V1 = { evidenceId: 'EV-20260930-0004', ok: true, at: 5, tracks: [], manifestOk: true, signatureOk: true };

describe('the value sets of the answer are the verifier\'s', () => {
  it('failure classes, statuses, skip reasons, transcript states, sources states and source classes', () => {
    expect(sorted(VERIFY_REPORT_FAILURE_CLASSES)).toEqual(sorted(Object.values(VerifyFailureClass)));
    expect(sorted(VERIFY_REPORT_OVERALL)).toEqual(sorted(['PASS', ...Object.values(VerifyFailureClass)]));
    expect(sorted(VERIFY_REPORT_CHECK_STATUSES)).toEqual(sorted(Object.values(VerifyCheckStatus)));
    expect(sorted(VERIFY_REPORT_SKIP_REASONS)).toEqual(sorted(Object.values(VerifySkipReason)));
    expect(sorted(VERIFY_REPORT_TRANSCRIPT_STATES)).toEqual(sorted(Object.values(VerifiedTranscriptState)));
    expect(sorted(VERIFY_REPORT_SOURCES_STATES)).toEqual(sorted(Object.values(VerifiedSourcesState)));
    expect(sorted(VERIFY_REPORT_SOURCE_CLASSES)).toEqual(sorted(MANIFEST_SOURCE_CLASSES));
  });

  it('every check ID, check name, failure code and report line of the verifier fits the schema', () => {
    const check = EvidenceVerifyResultSchema.shape.checks.unwrap().element;
    for (const { id, name } of VERIFY_V2_CHECKS) {
      for (const [code, rule] of Object.entries(VERIFY_FAILURES)) {
        if (rule.check !== id) continue;
        const one = { id, name, status: 'FAIL', failureClass: rule.failureClass, skipped: null, findings: [{ code, failureClass: rule.failureClass, member: 'tracks.0.sourceClass' }] };
        expect(check.safeParse(one).success, code).toBe(true);
      }
    }
    const state = EvidenceVerifyResultSchema.shape.transcriptState.unwrap().shape.report;
    for (const line of Object.values(TRANSCRIPT_STATE_REPORT)) expect(state.safeParse(line).success, line).toBe(true);
    const sources = EvidenceVerifyResultSchema.shape.sources.unwrap().shape.report;
    for (const line of Object.values(SOURCES_STATE_REPORT)) expect(sources.safeParse(line).success, line).toBe(true);
  });
});

describe('the members are optional and strict', () => {
  const responses = (CORE_API_EXAMPLES.verifyEvidence?.responses ?? {}) as Record<number, Record<string, { value: unknown }>>;
  const example = responses[200]?.passedDevelopmentSources?.value as Record<string, unknown>;

  it('a v1 answer stays valid without any of them; the v2 example carries all of them', () => {
    expect(EvidenceVerifyResultSchema.safeParse(V1).success).toBe(true);
    const parsed = EvidenceVerifyResultSchema.parse(example);
    for (const member of ['overall', 'interrupted', 'checks', 'fragments', 'failedFragmentCount', 'transcriptState', 'sources', 'files', 'transcriptOk'] as const) {
      expect(parsed[member], member).toBeDefined();
      expect(EvidenceVerifyResultSchema.shape[member].safeParse(undefined).success, member).toBe(true);
    }
    expect(parsed.checks?.map((check) => `${check.id} ${check.name}`)).toEqual(VERIFY_V2_CHECKS.map((check) => `${check.id} ${check.name}`));
    // A development package: the verdict is a pass and the mark is reported beside it.
    expect(parsed).toMatchObject({ ok: true, overall: 'PASS', sources: { ok: true, code: 'DEVELOPMENT', development: true, report: SOURCES_STATE_REPORT.DEVELOPMENT } });
    expect(parsed.transcriptState?.report).toBe(TRANSCRIPT_STATE_REPORT.READY);
  });

  it('NEGATIVE CONTROLS: a class outside the three values, a fourth source state, an unknown member and an over-long list are refused', () => {
    const sources = example.sources as Record<string, unknown>;
    const withSources = (change: Record<string, unknown>): unknown => ({ ...example, sources: { ...sources, ...change } });
    expect(EvidenceVerifyResultSchema.safeParse(withSources({})).success).toBe(true);
    expect(EvidenceVerifyResultSchema.safeParse(withSources({ tracks: [{ trackId: 'VIDEO-01', deviceId: 'CAM-01', sourceClass: 'DEVELOPMENT' }] })).success).toBe(false);
    expect(EvidenceVerifyResultSchema.safeParse(withSources({ code: 'PRODUCTION' })).success).toBe(false);
    expect(EvidenceVerifyResultSchema.safeParse(withSources({ lines: [] })).success).toBe(false);
    // `development` may be null (nothing stated) and never absent.
    expect(EvidenceVerifyResultSchema.safeParse(withSources({ development: null })).success).toBe(true);
    expect(EvidenceVerifyResultSchema.safeParse(withSources({ development: undefined })).success).toBe(false);
    const finding = { code: 'FRAGMENT_TAMPERED', failureClass: 'TAMPERED', trackId: 'VIDEO-02', seq: 3 };
    const check = (count: number, extra: Record<string, unknown> = {}): unknown => ({
      ...example,
      checks: [{ id: 'V-08', name: 'One-fragment tamper expectation', status: 'FAIL', failureClass: 'TAMPERED', skipped: null, findings: Array.from({ length: count }, () => finding), ...extra }],
    });
    expect(EvidenceVerifyResultSchema.safeParse(check(64, { findingCount: 900 })).success).toBe(true);
    expect(EvidenceVerifyResultSchema.safeParse(check(65)).success).toBe(false);
    expect(EvidenceVerifyResultSchema.safeParse(check(1, { value: 'x' })).success).toBe(false);
    expect(EvidenceVerifyResultSchema.safeParse({ ...example, checks: [{ ...(check(1) as { checks: object[] }).checks[0], id: 'V-1' }] }).success).toBe(false);
  });
});

// ── M7-SEC-SRC-2 at the contract ──────────────────────────────────────────────────────────────────

type Json = null | boolean | number | string | Json[] | { [key: string]: Json };
const document = openapi as unknown as { paths: Record<string, Record<string, Json>>; components: { schemas: Record<string, Json> } };

/** Every property name below a JSON-schema node, `$ref`s followed. */
function propertyNames(node: Json, seen = new Set<string>(), out = new Set<string>()): Set<string> {
  if (Array.isArray(node)) for (const item of node) propertyNames(item, seen, out);
  else if (typeof node === 'object' && node !== null) {
    const ref = node.$ref;
    if (typeof ref === 'string') {
      const name = ref.replace('#/components/schemas/', '');
      if (!seen.has(name)) {
        seen.add(name);
        propertyNames(document.components.schemas[name] ?? null, seen, out);
      }
    }
    const properties = node.properties;
    if (typeof properties === 'object' && properties !== null && !Array.isArray(properties)) for (const name of Object.keys(properties)) out.add(name);
    for (const value of Object.values(node)) propertyNames(value, seen, out);
  }
  return out;
}

const SOURCE_MEMBER = /^(sourceClass|sourceClasses|developmentSources|sources|adapterKind)$/i;

describe('M7-SEC-SRC-2: no operation accepts a source class - the Core writes it from the adapter kind', () => {
  const operations = Object.entries(document.paths).flatMap(([path, methods]) => Object.entries(methods).map(([method, operation]) => ({ id: `${method.toUpperCase()} ${path}`, operation: operation as { [key: string]: Json } })));

  it('no request body and no parameter of the 110 operations has a member that names a source class or the development flag', () => {
    expect(operations).toHaveLength(CORE_API_OPERATIONS.length);
    const accepting: string[] = [];
    let bodies = 0;
    for (const { id, operation } of operations) {
      const taken = new Set<string>();
      if (operation.requestBody !== undefined) {
        bodies += 1;
        propertyNames(operation.requestBody, new Set(), taken);
      }
      for (const parameter of (operation.parameters as Json[] | undefined) ?? []) {
        if (typeof parameter === 'object' && parameter !== null && !Array.isArray(parameter) && typeof parameter.name === 'string') taken.add(parameter.name);
        propertyNames(parameter, new Set(), taken);
      }
      for (const name of taken) if (SOURCE_MEMBER.test(name)) accepting.push(`${id}: ${name}`);
    }
    expect(accepting).toEqual([]);
    // The walk read real request bodies (the registry's count of operations with one).
    expect(bodies).toBe(CORE_API_OPERATIONS.filter((operation) => operation.requestBody).length);
    expect(bodies).toBeGreaterThan(30);
  });

  it('POSITIVE CONTROL: the same walk finds the members where they exist - in the ANSWER of operation 41', () => {
    const verify = operations.find(({ id }) => id === 'POST /api/v1/evidence/{id}/verify');
    if (verify === undefined) throw new Error('operation 41 is not in the document');
    expect(verify.operation.requestBody).toBeUndefined();
    const answered = propertyNames(verify.operation.responses ?? null);
    expect([...answered].filter((name) => SOURCE_MEMBER.test(name)).sort()).toEqual(['sourceClass', 'sources']);
    // And a planted request member is caught.
    const planted = propertyNames({ content: { 'application/json': { schema: { type: 'object', properties: { tracks: { type: 'array', items: { type: 'object', properties: { sourceClass: { type: 'string' } } } } } } } } });
    expect([...planted].some((name) => SOURCE_MEMBER.test(name))).toBe(true);
  });

  it('the answer schema is the one in the registry and in the document', () => {
    expect(CORE_API_SCHEMAS.EvidenceVerifyResult).toBe(EvidenceVerifyResultSchema);
    const inDocument = propertyNames(document.components.schemas.EvidenceVerifyResult ?? null);
    for (const member of ['overall', 'interrupted', 'checks', 'fragments', 'failedFragmentCount', 'transcriptState', 'sources', 'audioIntervals', 'findingCount']) expect(inDocument.has(member), member).toBe(true);
  });
});
