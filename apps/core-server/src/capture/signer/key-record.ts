/**
 * CS-13: the REAL signing-key record for the Security & Audit view (register CS-13; OD-04).
 *
 * The simulator shows two demo records there (`DEVICE_CERT`, `EVIDENCE_SIGNING_KEY`, both
 * `simulated: true, demo: true`). These are the same two records for the Core's real key:
 * identifiers and fingerprints of PUBLIC data, never key material. `simulated` is false and there
 * is no `demo` member.
 *
 * Fingerprint rules are the simulator's, so the two kinds of record read alike: the key record
 * shows SHA-256 of the raw 32-byte public key, the certificate record shows SHA-256 of the
 * certificate's DER bytes; both colon-grouped uppercase hex.
 */
import type { SecuritySliceBody } from '@dems/shared/api';
import { sha256Hex } from '@dems/shared/evidence-package';
import type { SigningCertificate } from './types';

export type SecurityKeyRecord = SecuritySliceBody['keys'][number];

const colonHex = (hex: string): string => (hex.toUpperCase().match(/.{2}/g) ?? []).join(':');

/** The two records of a loaded signing certificate, in the order the view lists them. */
export function signingKeyRecords(certificate: SigningCertificate): readonly [SecurityKeyRecord, SecurityKeyRecord] {
  return [
    {
      id: 'DEVICE_CERT',
      label: 'Device certificate',
      algorithm: 'Ed25519',
      fingerprint: colonHex(certificate.sha256),
      expiresAt: certificate.notAfter,
      simulated: false,
    },
    {
      id: 'EVIDENCE_SIGNING_KEY',
      label: `Evidence signing key (${certificate.keyId})`,
      algorithm: 'Ed25519',
      fingerprint: colonHex(sha256Hex(certificate.publicKey)),
      expiresAt: certificate.notAfter,
      simulated: false,
      keyId: certificate.keyId,
    },
  ];
}
