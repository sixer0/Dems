/**
 * A minimal DER writer for the self-signed certificate of the evidence signing key (the same
 * construction as the v1 demo generator, `packages/shared/scripts/gen-demo-evidence.ts`). Pure:
 * no cryptography and no clock here; the caller hands in the function that signs.
 */

function length(size: number): Buffer {
  if (size < 0x80) return Buffer.from([size]);
  const bytes: number[] = [];
  for (let value = size; value > 0; value = Math.floor(value / 256)) bytes.unshift(value & 0xff);
  return Buffer.from([0x80 | bytes.length, ...bytes]);
}
function tlv(tag: number, ...content: Uint8Array[]): Buffer {
  const body = Buffer.concat(content);
  return Buffer.concat([Buffer.from([tag]), length(body.length), body]);
}
const sequence = (...content: Uint8Array[]): Buffer => tlv(0x30, ...content);
const set = (...content: Uint8Array[]): Buffer => tlv(0x31, ...content);
function oid(dotted: string): Buffer {
  const parts = dotted.split('.').map(Number);
  const out: number[] = [40 * (parts[0] ?? 0) + (parts[1] ?? 0)];
  for (const part of parts.slice(2)) {
    const chunk: number[] = [part & 0x7f];
    for (let value = Math.floor(part / 128); value > 0; value = Math.floor(value / 128)) chunk.unshift(0x80 | (value & 0x7f));
    out.push(...chunk);
  }
  return tlv(0x06, Buffer.from(out));
}
const utf8 = (text: string): Buffer => tlv(0x0c, Buffer.from(text, 'utf8'));

/** Calendar fields of an epoch-millisecond instant in UTC, by arithmetic (no system clock involved). */
export function utcFields(epochMs: number): { year: number; month: number; day: number; hour: number; minute: number; second: number } {
  const seconds = Math.floor(epochMs / 1000);
  const days = Math.floor(seconds / 86_400);
  const rest = seconds - days * 86_400;
  // Civil date from a day count (proleptic Gregorian).
  const z = days + 719_468;
  const era = Math.floor(z / 146_097);
  const dayOfEra = z - era * 146_097;
  const yearOfEra = Math.floor((dayOfEra - Math.floor(dayOfEra / 1_460) + Math.floor(dayOfEra / 36_524) - Math.floor(dayOfEra / 146_096)) / 365);
  const dayOfYear = dayOfEra - (365 * yearOfEra + Math.floor(yearOfEra / 4) - Math.floor(yearOfEra / 100));
  const monthIndex = Math.floor((5 * dayOfYear + 2) / 153);
  const day = dayOfYear - Math.floor((153 * monthIndex + 2) / 5) + 1;
  const month = monthIndex < 10 ? monthIndex + 3 : monthIndex - 9;
  const year = yearOfEra + era * 400 + (month <= 2 ? 1 : 0);
  return { year, month, day, hour: Math.floor(rest / 3_600), minute: Math.floor((rest % 3_600) / 60), second: rest % 60 };
}

/** UTCTime through 2049, GeneralizedTime from 2050 (RFC 5280 §4.1.2.5). */
function time(epochMs: number): Buffer {
  const { year, month, day, hour, minute, second } = utcFields(epochMs);
  const two = (value: number): string => String(value).padStart(2, '0');
  const tail = `${two(month)}${two(day)}${two(hour)}${two(minute)}${two(second)}Z`;
  return year < 2050 ? tlv(0x17, Buffer.from(`${two(year % 100)}${tail}`, 'ascii')) : tlv(0x18, Buffer.from(`${String(year).padStart(4, '0')}${tail}`, 'ascii'));
}

const ED25519 = sequence(oid('1.3.101.112'));

export interface CertificateSubject {
  readonly organization: string;
  readonly organizationalUnit: string;
  readonly commonName: string;
}

export function subjectText(subject: CertificateSubject): string {
  return `CN=${subject.commonName},OU=${subject.organizationalUnit},O=${subject.organization}`;
}

export interface CertificateRequest {
  readonly subject: CertificateSubject;
  /** 16 bytes; made positive here. */
  readonly serial: Uint8Array;
  readonly notBefore: number;
  readonly notAfter: number;
  /** The raw 32-byte Ed25519 public key. */
  readonly publicKey: Uint8Array;
  /** The first 20 bytes of SHA-256 of the public key (subjectKeyIdentifier). */
  readonly keyIdentifier: Uint8Array;
}

/** The self-signed X.509 v3 certificate as DER. `sign` signs the to-be-signed part with the key itself. */
export function buildSelfSignedCertificate(request: CertificateRequest, sign: (tbs: Uint8Array) => Uint8Array): Buffer {
  const name = sequence(
    set(sequence(oid('2.5.4.10'), utf8(request.subject.organization))),
    set(sequence(oid('2.5.4.11'), utf8(request.subject.organizationalUnit))),
    set(sequence(oid('2.5.4.3'), utf8(request.subject.commonName))),
  );
  const serial = Buffer.from(request.serial);
  serial[0] = ((serial[0] ?? 0) & 0x7f) | 0x40;
  const extension = (id: string, critical: boolean, value: Uint8Array): Buffer =>
    sequence(oid(id), ...(critical ? [tlv(0x01, Buffer.from([0xff]))] : []), tlv(0x04, value));
  const extensions = tlv(
    0xa3,
    sequence(
      extension('2.5.29.19', true, sequence()), // basicConstraints: not a CA
      extension('2.5.29.15', true, tlv(0x03, Buffer.from([0x07, 0x80]))), // keyUsage: digitalSignature
      extension('2.5.29.14', false, tlv(0x04, request.keyIdentifier)), // subjectKeyIdentifier
    ),
  );
  const tbs = sequence(
    tlv(0xa0, tlv(0x02, Buffer.from([0x02]))),
    tlv(0x02, serial),
    ED25519,
    name,
    sequence(time(request.notBefore), time(request.notAfter)),
    name,
    sequence(ED25519, tlv(0x03, Buffer.from([0]), request.publicKey)),
    extensions,
  );
  return sequence(tbs, ED25519, tlv(0x03, Buffer.from([0]), sign(tbs)));
}

/** PEM armour of a DER certificate. */
export function certificatePem(der: Uint8Array): string {
  const base64 = Buffer.from(der).toString('base64').match(/.{1,64}/g)?.join('\n') ?? '';
  return `-----BEGIN CERTIFICATE-----\n${base64}\n-----END CERTIFICATE-----\n`;
}

/** The DER bytes of a PEM certificate, or null when the text is not one certificate. */
export function certificateDer(pem: string): Buffer | null {
  const match = /^-----BEGIN CERTIFICATE-----\n([A-Za-z0-9+/=\n]+)-----END CERTIFICATE-----\n?$/.exec(pem);
  const body = match?.[1];
  return body === undefined ? null : Buffer.from(body.replace(/\n/g, ''), 'base64');
}
