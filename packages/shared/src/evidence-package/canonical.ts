/**
 * Canonical JSON of the evidence package (spec §B "JSON, UTF-8, sorted keys for canonical
 * hashing"; §B.10).
 *
 * One value has exactly one byte string:
 *   - object members sorted by key (UTF-16 code units, the order of RFC 8785), at every depth;
 *   - no white space;
 *   - strings and numbers as ECMAScript `JSON.stringify` writes them (the shortest round-trip
 *     form of a number; `-0` is written `0`);
 *   - arrays keep their order (it is data);
 *   - UTF-8.
 *
 * What has no canonical form is REFUSED, never dropped: `undefined`, a function, a symbol, a
 * bigint, a non-finite number, a sparse array, an object that is not a plain record, and a string
 * with a lone surrogate. A manifest that cannot be serialised is not signed (spec §E.1
 * `BUILD_MANIFEST` failure path).
 */
import { utf8ToBytes } from '@noble/hashes/utils.js';
import { EvidencePackageError, EvidencePackageRefusal } from './errors';

export type CanonicalValue = null | boolean | number | string | readonly CanonicalValue[] | { readonly [key: string]: CanonicalValue };

function isPlainRecord(value: object): value is Record<string, unknown> {
  const prototype: unknown = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function hasLoneSurrogate(text: string): boolean {
  for (let index = 0; index < text.length; index += 1) {
    const unit = text.charCodeAt(index);
    if (unit >= 0xd800 && unit <= 0xdbff) {
      const next = text.charCodeAt(index + 1);
      if (!(next >= 0xdc00 && next <= 0xdfff)) return true;
      index += 1;
    } else if (unit >= 0xdc00 && unit <= 0xdfff) {
      return true;
    }
  }
  return false;
}

function write(value: unknown, path: string, out: string[]): void {
  if (value === null) {
    out.push('null');
    return;
  }
  switch (typeof value) {
    case 'boolean':
      out.push(value ? 'true' : 'false');
      return;
    case 'number':
      if (!Number.isFinite(value)) throw new EvidencePackageError(EvidencePackageRefusal.NOT_CANONICAL, [path]);
      out.push(JSON.stringify(value));
      return;
    case 'string':
      if (hasLoneSurrogate(value)) throw new EvidencePackageError(EvidencePackageRefusal.NOT_CANONICAL, [path]);
      out.push(JSON.stringify(value));
      return;
    case 'object':
      break;
    default:
      throw new EvidencePackageError(EvidencePackageRefusal.NOT_CANONICAL, [path]);
  }
  if (Array.isArray(value)) {
    out.push('[');
    for (let index = 0; index < value.length; index += 1) {
      if (!(index in value)) throw new EvidencePackageError(EvidencePackageRefusal.NOT_CANONICAL, [`${path}[${index}]`]);
      if (index > 0) out.push(',');
      write(value[index], `${path}[${index}]`, out);
    }
    out.push(']');
    return;
  }
  if (!isPlainRecord(value)) throw new EvidencePackageError(EvidencePackageRefusal.NOT_CANONICAL, [path]);
  if (Object.getOwnPropertySymbols(value).length > 0) throw new EvidencePackageError(EvidencePackageRefusal.NOT_CANONICAL, [path]);
  const keys = Object.keys(value).sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
  out.push('{');
  keys.forEach((key, index) => {
    if (hasLoneSurrogate(key)) throw new EvidencePackageError(EvidencePackageRefusal.NOT_CANONICAL, [path]);
    if (index > 0) out.push(',');
    out.push(JSON.stringify(key), ':');
    write(value[key], path === '' ? key : `${path}.${key}`, out);
  });
  out.push('}');
}

/** The canonical text of a JSON value. Throws `NOT_CANONICAL` (with the member path) otherwise. */
export function canonicalJson(value: unknown): string {
  const out: string[] = [];
  write(value, '', out);
  return out.join('');
}

/** The canonical UTF-8 bytes of a JSON value. */
export function canonicalJsonBytes(value: unknown): Uint8Array {
  return utf8ToBytes(canonicalJson(value));
}
