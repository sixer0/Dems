#!/usr/bin/env node
/**
 * Asset of plan row W58 (gateway_check/06_backend_gate.md) — item G, the hygiene scan.
 *
 * Scans server logs for anything that must never appear: the seeded demo password, an issued
 * session token / device credential / biometric token, a pairing code, the markers this row put
 * into a request on purpose, a query string on a request line, and a request header that carries
 * a credential. It prints a table of counts only: never a matched line, never a value (P19).
 *
 * The values it searches for come from the shared constants and from the credential files, read
 * here and never echoed. Usage: node 06_log_scan.mjs <file> [file …]
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const ROOT = '/Users/gsp-budi/Documents/DEMS';
const files = process.argv.slice(2);

/** The seeded values, read from the source constants (a regex-safe copy is built per pattern). */
const dataset = readFileSync(resolve(ROOT, 'packages/shared/src/sim/dataset.ts'), 'utf8');
const seeded = [];
for (const name of ['DEMO_OPERATOR_PASSWORD', 'DEMO_PAIRING_CODE']) {
  const match = dataset.match(new RegExp(`${name} = '([^']+)'`));
  if (match) seeded.push({ name, value: match[1] });
}

const patterns = [
  ...seeded.map((item) => ({ label: `seeded ${item.name}`, re: new RegExp(escapeRegExp(item.value), 'g') })),
  { label: 'session token (ses_…)', re: /\bses_[A-Za-z0-9_-]{20,}/g },
  { label: 'device credential (dvc_…)', re: /\bdvc_[A-Za-z0-9_-]{20,}/g },
  { label: 'biometric token (bio_…)', re: /\bbio_[A-Za-z0-9_-]{20,}/g },
  { label: 'this row\'s log marker', re: /w58-log-probe-marker-4c17/g },
  { label: 'query string on a url', re: /(url|path|rawUrl|query)?"?\s?:\s*"[^"]*\?[^"]*"/g },
  { label: 'a "?" token parameter', re: /\?token=/g },
  { label: 'authorization header value', re: /"(authorization|x-dems-credential)"\s*:\s*"[^"]+"/gi },
  { label: 'cookie header value', re: /"cookie"\s*:\s*"[^"]+"/gi },
  { label: 'set-cookie header value', re: /"set-cookie"\s*:\s*"[^"]+"/gi },
  { label: 'password key with a value', re: /"(password|passwd)"\s*:\s*"[^"]+"/gi },
];

function escapeRegExp(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

let total = 0;
for (const file of files) {
  let text;
  try {
    text = readFileSync(file, 'utf8');
  } catch (error) {
    console.log(`${file}: NOT READABLE (${error.code})`);
    continue;
  }
  const lines = text.split('\n').length;
  const hits = patterns
    .map((pattern) => ({ label: pattern.label, count: (text.match(pattern.re) ?? []).length }))
    .filter((hit) => hit.count > 0);
  const sum = hits.reduce((all, hit) => all + hit.count, 0);
  total += sum;
  console.log(
    `${file}: lines=${lines} bytes=${text.length} findings=${sum}` +
      (hits.length > 0 ? ` [${hits.map((h) => `${h.label}=${h.count}`).join('; ')}]` : ' (clean)'),
  );
}
console.log(`TOTAL findings over ${files.length} file(s): ${total}`);
process.exit(total === 0 ? 0 : 1);
