// W57 device check: reads a `uiautomator dump` of the Pair screen and prints, for the screen's test
// IDs (React Native puts a testID into `resource-id`), the bounds, the text, and whether the node
// lies inside the display. Read-only; the dumps are taken with the code slots EMPTY or on the
// paired view, so no dump holds a pairing code.
//
//   node bounds.mjs report <dump.xml>          the table
//   node bounds.mjs center <dump.xml> <id>     "X Y", the centre of that node (for `input tap`)
import { readFileSync } from 'node:fs';

const [mode, file, wanted] = process.argv.slice(2);
const xml = readFileSync(file, 'utf8');
const nodes = [...xml.matchAll(/<node\b[^>]*>/g)].map((match) => match[0]);
const attr = (node, name) => new RegExp(` ${name}="([^"]*)"`).exec(node)?.[1] ?? '';
const box = (node) => {
  const found = /\[(-?\d+),(-?\d+)\]\[(-?\d+),(-?\d+)\]/.exec(attr(node, 'bounds'));
  return found ? { l: Number(found[1]), t: Number(found[2]), r: Number(found[3]), b: Number(found[4]) } : null;
};
const idOf = (node) => attr(node, 'resource-id').replace(/^.*:id\//, '');
const byId = (id) => nodes.find((node) => idOf(node) === id);
const display = box(nodes[0]) ?? { l: 0, t: 0, r: 0, b: 0 };

if (mode === 'center') {
  const node = byId(wanted);
  const at = node ? box(node) : null;
  if (!at) process.exit(1);
  console.log(`${Math.round((at.l + at.r) / 2)} ${Math.round((at.t + at.b) / 2)}`);
  process.exit(0);
}

const IDS = [
  'screen-pair',
  'pairing-header',
  'pairing-back',
  'pane-connection',
  'pane-code',
  'pairing-connection',
  'pairing-state-chip',
  'pairing-status-line',
  'pairing-stepper',
  'pairing-identity-server',
  'pairing-identity-link',
  'pairing-identity-device',
  'pairing-identity-room',
  'pairing-identity-tablet',
  'pairing-identity-paired-at',
  'pairing-fingerprint',
  'pairing-simulated-chip',
  'pairing-code-card',
  'pairing-code-input',
  'pairing-pair',
  'pairing-use-simulated',
  'pairing-cancel',
  'pairing-paired-card',
  'pairing-continue',
  'pairing-unpair',
];
console.log(`   display ${display.r - display.l}x${display.b - display.t}; ${nodes.length} nodes in the dump`);
const seen = {};
for (const id of IDS) {
  const node = byId(id);
  if (!node) continue;
  const at = box(node);
  seen[id] = at;
  const inside = at && at.l >= display.l && at.r <= display.r && at.t >= display.t && at.b <= display.b && at.r > at.l && at.b > at.t;
  const text = [attr(node, 'text'), attr(node, 'content-desc')].filter(Boolean).join(' | ').replace(/&#10;/g, ' ').slice(0, 110);
  console.log(`   ${id.padEnd(27)} [${at.l},${at.t}][${at.r},${at.b}] ${String(at.r - at.l).padStart(4)}x${String(at.b - at.t).padEnd(4)} inside the display: ${inside ? 'yes' : 'NO'}${text ? `  "${text}"` : ''}`);
}
const a = seen['pane-connection'];
const b = seen['pane-code'];
if (a && b) {
  const sideBySide = a.r <= b.l || b.r <= a.l;
  const stacked = a.b <= b.t || b.b <= a.t;
  console.log(`   the two panes: ${sideBySide ? 'side by side' : stacked ? 'stacked' : 'OVERLAPPING'}; connection ${a.r - a.l} px wide, code ${b.r - b.l} px wide; gap ${sideBySide ? Math.max(b.l - a.r, a.l - b.r) : Math.max(b.t - a.b, a.t - b.b)} px`);
} else {
  console.log(`   panes found in the dump: connection ${a ? 'yes' : 'no'}, code ${b ? 'yes' : 'no'}`);
}
// Every text the screen draws, to show what it says (the slots are empty in these dumps).
const texts = nodes.map((node) => attr(node, 'text')).filter(Boolean);
console.log(`   says "simulat…" anywhere but on the mode switch: ${texts.filter((text) => /simulat/i.test(text) && text !== 'Use Simulated mode').length} texts`);
