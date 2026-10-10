// Fix wave K Z1 (gate finding G94b-01, ruling D224 (1); `contract_wave_k.md` "Z1"): operation 88
// states the INDEXED VIEW of a sealed camera file additively - ONE optional member name, `seekIndex`,
// on the request body and on the answer - and the contract totals do not move.
import { describe, expect, it } from 'vitest';
import {
  CORE_API_EXAMPLES,
  CORE_API_OPERATIONS,
  EVIDENCE_MEDIA_SESSION_INDEXED_EXAMPLE,
  EVIDENCE_MEDIA_SESSION_INDEXED_REQUEST_EXAMPLE,
  EvidenceMediaSessionRequestSchema,
  EvidenceMediaSessionSchema,
  validateCoreApiResponse,
} from '../src/api';
import { AuditType } from '../src/sim';

const MEMBER = 'seekIndex';

describe('operation 88: the indexed view is an additive optional member', () => {
  it('the exported example states it by name, and it is a valid answer of the operation', () => {
    expect(EVIDENCE_MEDIA_SESSION_INDEXED_EXAMPLE[MEMBER]).toBe(true);
    expect(EvidenceMediaSessionSchema.safeParse(EVIDENCE_MEDIA_SESSION_INDEXED_EXAMPLE).success).toBe(true);
    expect(validateCoreApiResponse('createEvidenceMediaSession', 201, EVIDENCE_MEDIA_SESSION_INDEXED_EXAMPLE).ok).toBe(true);
  });

  it('OPTIONAL on the answer: without it the answer is the one of before; `false` and other values are no value of it', () => {
    const { [MEMBER]: _stated, ...plain } = EVIDENCE_MEDIA_SESSION_INDEXED_EXAMPLE;
    expect(EvidenceMediaSessionSchema.safeParse(plain).success).toBe(true);
    for (const value of [false, 'true', 1, null]) expect(EvidenceMediaSessionSchema.safeParse({ ...plain, [MEMBER]: value }).success).toBe(false);
  });

  it('OPTIONAL on the request: `{}`, `{ fileId }`, `{ seekIndex: true }` and both are bodies; `seekIndex: false` and an unknown member are not', () => {
    for (const body of [{}, { fileId: 'VIDEO-02' }, { [MEMBER]: true }, EVIDENCE_MEDIA_SESSION_INDEXED_REQUEST_EXAMPLE]) expect(EvidenceMediaSessionRequestSchema.safeParse(body).success).toBe(true);
    for (const body of [{ [MEMBER]: false }, { fileId: 'VIDEO-01', [MEMBER]: 'yes' }, { fileId: 'VIDEO-01', view: 'INDEXED' }]) expect(EvidenceMediaSessionRequestSchema.safeParse(body).success).toBe(false);
  });

  it('the operation shows both in its examples (request and 201)', () => {
    const examples = CORE_API_EXAMPLES.createEvidenceMediaSession;
    expect(examples?.request?.['indexedView']?.value).toEqual(EVIDENCE_MEDIA_SESSION_INDEXED_REQUEST_EXAMPLE);
    const answers = (examples?.responses[201] ?? {}) as Record<string, { value: unknown } | undefined>;
    const valueOf = (name: string): Record<string, unknown> => (answers[name]?.value ?? {}) as Record<string, unknown>;
    expect(valueOf('indexedView')[MEMBER]).toBe(true);
    // The first example is the stream of before: no member.
    expect([Object.keys(valueOf('video01')).length > 0, MEMBER in valueOf('video01')]).toEqual([true, false]);
  });

  it('the totals do not move: 97 operations (36 GET / 61 POST), 67 audit types', () => {
    const methods = CORE_API_OPERATIONS.map((operation) => String(operation.method).toUpperCase());
    expect([methods.length, methods.filter((method) => method === 'GET').length, methods.filter((method) => method === 'POST').length]).toEqual([97, 36, 61]);
    expect(Object.keys(AuditType)).toHaveLength(67);
  });
});
