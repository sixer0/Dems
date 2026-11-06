// Hash baseline of row SIM-GAP-1 (implementation/22b_sim_text_cut_fix.md). Read-only: it drives the
// shared simulator in memory with texts made ONLY of characters of the Basic Multilingual Plane,
// each longer than its limit, and prints the audit row hashes and a digest of the affected state
// slices. Run once before the fix and once after it; the two outputs must be identical.
//   node --import tsx <this file>
import { createHash } from 'node:crypto';
import { createManualClock, createSim } from '/Users/gsp-budi/Documents/DEMS/packages/shared/src/sim/index';

const digest = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex');

const clock = createManualClock(1_790_823_600_000);
const sim = createSim({ clock, storage: null, authStorage: null, scenario: 'recording' });
const state = () => sim.store.getState();
const lastRow = () => state().audit.rows.at(-1);
const show = (name: string) => {
  const row = lastRow();
  console.log(`${name}: ${row?.type} seq ${row?.seq} hash ${row?.hash}`);
};

// ASCII and other BMP texts, each longer than its limit (80, 140, 120 code units).
const ASCII_LABEL = `  ${'Marker label '.repeat(9)}  `; // 117 code units after trim
const BMP_LABEL = 'Keterangan saksi — café, naïve, 日本語、한국어 · '.repeat(4); // BMP only, no surrogate
const ASCII_NOTE = 'The witness confirms the statement given earlier. '.repeat(5); // 250 code units
const BMP_NOTE = 'Saksi menyatakan “benar” — façade, 東京都、서울 · '.repeat(6);
const ASCII_DESTINATION = `  ${'/mnt/usb/CASE-FILES/export-'.repeat(6)}  `; // 162 code units after trim
const BMP_DESTINATION = 'Jaksa Penuntut Umum — Kejaksaan Negeri · 東京 · '.repeat(4);

sim.actions.signInWithBiometric('OPR-001');
sim.actions.addMarker(ASCII_LABEL);
show('marker (ASCII)');
console.log('  label:', JSON.stringify(lastRow()?.details.label));
sim.actions.addMarker(BMP_LABEL);
show('marker (BMP)');
console.log('  label:', JSON.stringify(lastRow()?.details.label));
sim.actions.addNote(ASCII_NOTE);
show('note (ASCII)');
console.log('  timeline detail:', JSON.stringify(state().session?.timeline.at(-1)?.detail));
sim.actions.addNote(BMP_NOTE);
show('note (BMP)');
console.log('  timeline detail:', JSON.stringify(state().session?.timeline.at(-1)?.detail));

sim.actions.signOut();
sim.actions.signInWithSecurityKey();
console.log('exportEvidence:', JSON.stringify(sim.actions.exportEvidence('EV-20260930-0004', { reason: 'Case file transfer', destination: ASCII_DESTINATION })));
show('evidence export (ASCII)');
console.log('  destination:', JSON.stringify(lastRow()?.details.destination));
console.log('exportEvidence:', JSON.stringify(sim.actions.exportEvidence('EV-20260930-0004', { reason: 'Case file transfer', destination: BMP_DESTINATION })));
show('evidence export (BMP)');
console.log('  destination:', JSON.stringify(lastRow()?.details.destination));
console.log('exportAudit:', JSON.stringify(sim.actions.exportAudit({ reason: 'Quarterly audit review', destination: ASCII_DESTINATION })));
show('audit export (ASCII)');
console.log('exportAudit:', JSON.stringify(sim.actions.exportAudit({ reason: 'Quarterly audit review', destination: BMP_DESTINATION })));
show('audit export (BMP)');
console.log('exportLogs:', JSON.stringify(sim.actions.exportLogs({ reason: 'Support bundle for review', destination: ASCII_DESTINATION })));
show('log export (ASCII)');

const after = state();
console.log('audit head:', after.audit.head, '| rows', after.audit.rows.length, '| total', after.audit.total);
console.log('digest audit   :', digest(after.audit));
console.log('digest events  :', digest(after.events));
console.log('digest session :', digest(after.session));
console.log('digest evidence:', digest(after.evidence));
