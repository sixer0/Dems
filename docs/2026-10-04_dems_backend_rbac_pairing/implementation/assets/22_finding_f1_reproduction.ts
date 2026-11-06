// Reproduction of finding F-1 of implementation/22_contract_b.md (plan row W22). Read-only: it
// drives the shared simulator in memory and prints what it finds. Run from the repository root:
//   node --import tsx <this file>
import { createManualClock, createSim } from '/Users/gsp-budi/Documents/DEMS/packages/shared/src/sim/index';
import { CORE_API_SCHEMAS, REPLICATED_SLICE_SCHEMAS, isWellFormedText } from '/Users/gsp-budi/Documents/DEMS/packages/shared/src/api/index';

const illFormed = (value: unknown, path: string, out: string[] = []): string[] => {
  if (typeof value === 'string') {
    if (!isWellFormedText(value)) out.push(path);
  } else if (Array.isArray(value)) value.forEach((item, index) => illFormed(item, `${path}[${index}]`, out));
  else if (value && typeof value === 'object') for (const [key, child] of Object.entries(value)) illFormed(child, `${path}.${key}`, out);
  return out;
};

const clock = createManualClock(1_790_823_600_000);
const sim = createSim({ clock, storage: null, authStorage: null, scenario: 'recording' });
console.log('ill-formed strings in the recording scenario before any input:', illFormed(sim.store.getState(), 'state'));

// 1. A note of 168 UTF-16 code units whose code units 139 and 140 are one surrogate pair.
sim.actions.signInWithBiometric('OPR-001');
const note = `${'a'.repeat(138)}\u{1F600} and the rest of a long note`;
console.log(`\nnote: ${note.length} code units, well-formed: ${isWellFormedText(note)}`);
sim.actions.addNote(note);
console.log('ill-formed strings after addNote:', illFormed(sim.store.getState(), 'state'));
const detail = sim.store.getState().session?.timeline.at(-1)?.detail ?? '';
console.log('the timeline entry ends with (JSON):', JSON.stringify(detail).slice(-18));

// 2. An export destination of 131 code units whose code units 120 and 121 are one surrogate pair.
sim.actions.signOut();
sim.actions.signInWithSecurityKey();
const destination = `${'d'.repeat(119)}\u{1F600} and more`;
const request = { reason: 'Case file transfer', destination };
console.log(`\ndestination: ${destination.length} code units, well-formed: ${isWellFormedText(destination)}`);
console.log('EvidenceExportRequest accepts it (API-13 holds for the input):', CORE_API_SCHEMAS.EvidenceExportRequest.safeParse(request).success);
console.log('exportEvidence:', JSON.stringify(sim.actions.exportEvidence('EV-20260930-0004', request)));
const after = sim.store.getState();
console.log('ill-formed strings after exportEvidence:', illFormed(after, 'state').filter((path) => !path.includes('timeline')));
const row = after.audit.rows.at(-1);
console.log('the audit row:', row?.type, 'seq', row?.seq, '| details.destination ends with (JSON):', JSON.stringify(row?.details.destination).slice(-10));
console.log('UTF-8 of an unpaired high surrogate:', Buffer.from('\ud83d', 'utf8').toString('hex'), '(U+FFFD: the stored text would differ from the hashed text)');

console.log('\nthe slice schemas of contract B accept this state:');
for (const name of ['session', 'audit', 'events', 'evidence'] as const) {
  console.log(`  ${name}:`, REPLICATED_SLICE_SCHEMAS[name].safeParse(JSON.parse(JSON.stringify(after[name]))).success);
}
