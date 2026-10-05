// Host-authentication check HA-1 to HA-3 on pg_hba.conf (database contract 7.6; SR-02; SD-15).
// The file is read as a file: it belongs to the user's uid, and the SQL view of it is for
// superusers. Run by pg:init (trial step T3-a), by pg:status, and directly:
//   node scripts/pg/check-hba.mjs            exit 0 = pass, 1 = fail
//
// HA-1  the method of every line is scram-sha-256 (no trust, peer, ident, password, md5)
// HA-2  the address of every host line is 127.0.0.1/32 or ::1/128
// HA-3  the line types are local and host only (no hostssl..., no include directive)

import fs from 'node:fs';
import path from 'node:path';

import { PgScriptError, hasCluster, main, rel, say } from './lib.mjs';

export const HBA_METHOD = 'scram-sha-256';
export const HBA_ADDRESSES = Object.freeze(['127.0.0.1/32', '::1/128']);

/** Returns { ok, lines, failures }. A failure names the rule, the line number and the reason. */
export function checkHbaText(text) {
  const lines = [];
  const failures = [];
  text.split('\n').forEach((raw, index) => {
    const line = raw.trim();
    if (line === '' || line.startsWith('#')) return;
    const number = index + 1;
    lines.push({ number, text: line });
    const field = line.split(/\s+/);
    const fail = (rule, reason) => failures.push({ rule, line: number, reason, text: line });

    const type = field[0];
    if (type !== 'local' && type !== 'host') {
      fail('HA-3', `line type "${type}" is not local or host`);
      return;
    }
    // local: type database user method [options]; host: type database user address method [options]
    const methodIndex = type === 'local' ? 3 : 4;
    if (type === 'host' && !HBA_ADDRESSES.includes(field[3])) {
      fail('HA-2', `address "${field[3] ?? ''}" is not ${HBA_ADDRESSES.join(' or ')}`);
    }
    const method = field[methodIndex];
    if (method !== HBA_METHOD) {
      fail('HA-1', `method "${method ?? ''}" is not ${HBA_METHOD}`);
    }
    for (const option of field.slice(methodIndex + 1)) {
      if (option.startsWith('#')) break;
      if (!/^[a-z_]+=/.test(option)) fail('HA-1', `unexpected field "${option}" after the method`);
    }
  });
  if (lines.length === 0) failures.push({ rule: 'HA-3', line: 0, reason: 'the file has no rule at all', text: '' });
  return { ok: failures.length === 0, lines, failures };
}

export function checkHbaFile(file) {
  return checkHbaText(fs.readFileSync(file, 'utf8'));
}

/** Prints the result; returns true on pass. */
export function reportHba(result, label) {
  for (const rule of ['HA-1', 'HA-2', 'HA-3']) {
    const bad = result.failures.filter((f) => f.rule === rule);
    say(`  ${rule} ${bad.length === 0 ? 'PASS' : 'FAIL'}${bad.map((f) => ` | line ${f.line}: ${f.reason}`).join('')}`);
  }
  say(`  effective lines of ${label} (${result.lines.length}):`);
  for (const line of result.lines) say(`    ${line.text}`);
  return result.ok;
}

await main(import.meta.url, 'pg:check-hba', async (_args, paths) => {
  if (!hasCluster(paths)) throw new PgScriptError(`no cluster at ${rel(paths.pgdata, paths.root)}`, 4);
  const file = path.join(paths.pgdata, 'pg_hba.conf');
  say(`host-authentication check on ${rel(file, paths.root)}`);
  return reportHba(checkHbaFile(file), rel(file, paths.root)) ? 0 : 1;
});
