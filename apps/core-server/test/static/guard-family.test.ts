// The guard family, counted (blueprint row 61 / M3-W5; checks M3-SR-1, M3-SR-2, M4-SR-1 "family
// count"; register CS-05). A static guard that is deleted, or a rule that is dropped from one, makes
// nothing fail by itself: this file pins WHICH guards exist and WHICH rules the capture guards hold.
//
//   1. the 21 guards of the source folders that existed before task 3 (register CS-05) are all
//      there, and the guards task 3 added are listed by name;
//   2. the capture guard holds G-R1, G-R2, G-R4, G-R5, G-R7, G-R8 (M3), G-R9 to G-R15 (M4) and
//      G-R16 (row 61), each as a block of its own, and each of them has a planted control;
//   3. the worker's guard (`apps/capture-worker/check.sh`, the C sources: G-R3 and G-R6 are its)
//      still holds every rule tag it had, row 58's exclusive-create pins (D58-1, D58-2) among
//      them, plus the pinned-call rules R-6 / F-10 and the version pin D85; its planted
//      violations are at least as many as when this row landed.
//
// A new guard or rule is added here by its own row, by delta.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { REPOSITORY, WORKSPACE, readTree } from './scan';

const tree = readTree(WORKSPACE);
const read = (path: string): string => readFileSync(resolve(REPOSITORY, path), 'utf8');

/** The static guards of the source folders as task 2 left them (register CS-05: "21 src guards"). */
const BASELINE = [
  'src/core', 'src/db/fixtures', 'src/db/mapping', 'src/db/reset', 'src/db/store', 'src/engine', 'src/modules/admin', 'src/modules/alerts', 'src/modules/demo',
  'src/modules/devices', 'src/modules/evidence', 'src/modules/identity', 'src/modules/identity/biometric', 'src/modules/network-time', 'src/modules/pairing',
  'src/modules/security-audit', 'src/modules/sessions', 'src/modules/storage', 'src/modules/system', 'src/plugins/permission-guard', 'src/realtime',
];
/** The guards task 3 added: the capture folder (row 57), its adapter layer (row 65), the credential store (row 84), the camera search (row 132), the STT configuration (row 113). */
const TASK_3 = ['src/capture', 'src/capture/adapters', 'src/credential-store', 'src/modules/capture-discovery', 'src/modules/stt-config'];

describe('the guard family', () => {
  it('the 21 baseline guards are all there, and every guard of the source folders is a listed one', () => {
    expect(BASELINE).toHaveLength(21);
    const guards = tree.filter((file) => /^src\/.*\/__tests__\/static\.test\.ts$/.test(file.path)).map((file) => file.path.replace(/\/__tests__\/static\.test\.ts$/, ''));
    expect(BASELINE.filter((folder) => !guards.includes(folder))).toEqual([]);
    expect(TASK_3.filter((folder) => !guards.includes(folder))).toEqual([]);
    // A guard nobody listed is not refused (a new unit brings its own, e.g. rows 90 and 91): it is asked to be listed, by its row.
    expect(guards.length).toBeGreaterThanOrEqual(BASELINE.length + TASK_3.length);
  });

  it('the capture guard holds G-R1, 2, 4, 5, 7, 8, G-R9 to G-R15 and G-R16, each with a planted control', () => {
    const guard = read('apps/core-server/src/capture/__tests__/static.test.ts');
    const blocks = [...guard.matchAll(/^describe\('([^']*)'/gm)].map((match) => match[1] ?? '');
    const rules = [...new Set(blocks.flatMap((title) => [...title.matchAll(/G-R(\d+)/g)].map((match) => Number(match[1]))))].sort((a, b) => a - b);
    expect(rules).toEqual([1, 2, 4, 5, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16]);
    // The frozen-file pins (P25) and the registry-insert rule are blocks of the same file.
    expect(blocks.filter((title) => /^(?:P25|SEC35-41 \(c\))/.test(title))).toHaveLength(2);
    // Every rule can fail: the first block plants the texts of G-R1 to G-R8, and each later rule plants its own.
    expect(guard).toContain("it('finds each forbidden text when it is present (positive control)'");
    for (const rule of ['G-R9', 'G-R13', 'G-R10 / G-R11', 'G-R12', 'G-R14', 'G-R15', 'G-R16']) {
      const start = guard.indexOf(`describe('${rule}:`);
      expect(start, rule).toBeGreaterThan(0);
      const next = guard.indexOf('\ndescribe(', start + 1);
      expect(guard.slice(start, next === -1 ? undefined : next), rule).toMatch(/\(control\)'/);
    }
    // Control of this count itself: a guard without one block would be seen.
    const without = guard.replace(/^describe\('G-R5:/m, "describe('removed:");
    expect([...new Set([...without.matchAll(/^describe\('([^']*)'/gm)].flatMap((match) => [...(match[1] ?? '').matchAll(/G-R(\d+)/g)].map((found) => Number(found[1]))))]).not.toContain(5);
  });

  it('the worker\'s guard keeps every rule tag, row 58\'s exclusive-create pins among them, and its planted violations', () => {
    const check = read('apps/capture-worker/check.sh');
    const tags = [...new Set([...check.matchAll(/\bsay "([^:"]+):/g)].map((match) => match[1] ?? ''))].sort();
    expect(tags).toEqual(['AU2-07', 'B.2', 'C.2 (W-2)', 'C.4', 'D58-1', 'D58-2', 'D59-2', 'D59-3', 'D59-4', 'F-2', 'H-4', 'N-10', 'R-6', 'SEC35-23', 'SEC35-23 (fixtures)', 'SR-3', 'W-1', 'W-4', 'W1-C1'].sort());
    // Row 58's pin (decision D72(a), pair-58 A-9): no O_TRUNC, every create exclusive. Still two rules of the file.
    expect(check).toContain(`[ "$(count 'O_TRUN[C]')" = "0" ] || say "D58-1: O_TRUNC in the worker"`);
    expect(check).toContain(`[ "$(count 'O_CREA[T]')" = "$(count 'O_CREAT | O_EXC[L]')" ] || say "D58-1: a create without O_EXCL"`);
    // Row 61: the pinned-call rule is called inside the rules of a source directory, and the two rules of the build run after them.
    expect(check).toContain('pinned=$(python3 test/static/pinned_calls.py "$dir" test/static/pinned-calls.tsv 2>&1)');
    expect(check).toMatch(/\nproof_rule Makefile "\$1" \|\| exit 1\nversion_rule test\/static\/libavformat\.pin /);
    // The planted violations: 23 of rows 58 and 59, 25 of row 61 (the 11 + 4 evasions of D84 R-6 / D85 R-8, the two of F-10, and their kin).
    const planted = read('apps/capture-worker/test/static/planted.tsv').split('\n').filter((line) => line !== '' && !line.startsWith('#')).map((line) => line.split('\t')[0] ?? '');
    expect(planted.length).toBeGreaterThanOrEqual(48);
    expect(planted.filter((tag) => tag === 'R-6').length).toBeGreaterThanOrEqual(18);
    expect(planted.filter((tag) => tag === 'F-10').length).toBeGreaterThanOrEqual(7);
    expect(check).toContain('[ "$n" -ge 48 ]');
    // The version the worker was verified against (decision D85): one line, FFmpeg 9.0.2.
    const pin = read('apps/capture-worker/test/static/libavformat.pin').split('\n').filter((line) => line !== '' && !line.startsWith('#'));
    expect(pin).toEqual(['libavformat\t63.1.102\t9.0.2']);
  });

  it('every pinned call of the worker that makes a file is exclusive, and the table lists no banned function', () => {
    const rows = read('apps/capture-worker/test/static/pinned-calls.tsv').split('\n').filter((line) => line !== '' && !line.startsWith('#')).map((line) => line.split('\t'));
    const calls = rows.filter((row) => row[2] === 'call');
    expect(calls.length).toBeGreaterThanOrEqual(20);
    const opens = calls.filter((row) => row[1] === 'open').map((row) => row[3] ?? '');
    expect(opens.filter((text) => text.includes('O_TRUNC'))).toEqual([]);
    expect(opens.filter((text) => text.includes('O_CREAT') && !text.includes('O_EXCL'))).toEqual([]);
    expect(opens.filter((text) => text.includes('O_CREAT'))).toHaveLength(2);
    // ONE link (the final name of a camera file), ONE rename (the log rotation), ONE truncation (back to the last good length).
    for (const [fn, file] of [['link', 'sink.c'], ['rename', 'ipc.c'], ['ftruncate', 'sink.c']] as const) expect(calls.filter((row) => row[1] === fn).map((row) => row[0]), fn).toEqual([file]);
    expect(calls.filter((row) => /^(?:creat|openat|freopen|truncate|linkat|renameat|symlink|remove|avio_open2?|syscall|system|popen|fork)$/.test(row[1] ?? ''))).toEqual([]);
    // The muxer options are the decided six, and the one parse call is the proof-build seam.
    expect(calls.filter((row) => (row[1] ?? '').startsWith('av_dict_set')).map((row) => (row[3] ?? '').split('"')[1]).sort()).toEqual(['flush_packets', 'listen_timeout', 'min_frag_duration', 'movflags', 'protocol_whitelist', 'rtsp_flags']);
    expect(calls.filter((row) => row[1] === 'av_dict_parse_string').map((row) => row[3])).toEqual(['&o, g_mux_extra, "=", ":", 0']);
  });
});
