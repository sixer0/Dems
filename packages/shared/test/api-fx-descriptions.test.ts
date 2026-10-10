// Closing pass F-X, item 1: what the contract text says after the fix wave. Written RED.
//   op 41   the notice description names BOTH notices of a v2 result and the nullable key mark
//   op 33   `202` with state FINALIZING when the operation re-queues a failed seal (decision D186 (4))
//   ops 84 / 85 / 86 / 42 / 87   the case scope of REAL evidence, as op 88 states it (R93-02)
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { findCoreApiOperation } from '../src/api';
import { VERIFY_NOTICE } from '../src/evidence-verify/types';

const openapi = readFileSync(join(__dirname, '..', 'openapi', 'openapi.json'), 'utf8');

describe('contract text of the closing pass', () => {
  it('operation 41: every notice code of the verifier is described, and `signature.developmentKey` is stated as nullable', () => {
    const schema = JSON.parse(openapi).components.schemas.EvidenceVerifyResult as { properties: { notices: { items: { properties: { code: { description: string } } } }; signature: { description: string } } };
    for (const code of Object.values(VERIFY_NOTICE)) expect(schema.properties.notices.items.properties.code.description, code).toContain(`\`${code}\``);
    expect(schema.properties.signature.description).toMatch(/`developmentKey` is nullable/);
  });

  it('operation 33: the description and the 202 name the FINALIZING answer of a re-queued seal', () => {
    const operation = findCoreApiOperation('recoverSession');
    expect(operation?.description).toContain('**FINALIZING**');
    expect(operation?.responses[202]?.description).toContain('FINALIZING');
  });

  it('the case scope of REAL evidence is stated on operations 84, 85, 86, 42 and 87 as on 88', () => {
    for (const id of ['getTranscript', 'createTranscriptRevision', 'listTranscriptRevisions', 'exportEvidence', 'getEvidenceExportJob', 'createEvidenceMediaSession']) {
      const operation = findCoreApiOperation(id);
      expect(`${operation?.description ?? ''}\n${operation?.coreServerDescription ?? ''}`, id).toContain('`details.reason: EVIDENCE_CASE_SCOPE`');
    }
  });
});
