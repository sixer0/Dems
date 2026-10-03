/**
 * `@dems/shared/demo-data`: the DEMO evidence packages (blueprint step 93; D50, D51, D61; P13).
 *
 * - `DEMO_EVIDENCE_INDEX`: one entry per evidence item (EV 0001–0013 from the simulator dataset,
 *   plus the recording scenario's item that seals into the next evidence number), with paths,
 *   hashes, flags and the generator's precomputed verification.
 * - `DEMO_EVIDENCE_DOCUMENTS`: the text of each package's manifest, metadata and signature, for
 *   viewers that cannot load files (mobile).
 * - The pure verify helpers (`verifyDemoPackage` and the single checks) for a real re-verification.
 *
 * Join rule: simulator objects join to packages by the numeric suffix of their IDs. Evidence
 * suffixes and session suffixes are separate namespaces (session 0014 is evidence 0004; evidence
 * 0014 is the recording scenario's item), so use the matching lookup. Never hard-code hashes.
 * Paths are relative to packages/shared/assets/ (package export `@dems/shared/assets/*`).
 */
import { DEMO_DEVICE_CERTIFICATE_PEM, DEMO_EVIDENCE_DOCUMENTS } from './documents.generated';
import { demoIdSuffix } from './lookup';
import { DEMO_EVIDENCE_INDEX } from './packages.generated';
import type { DemoEvidenceDocuments } from './types';

export * from './types';
export * from './verify';
export * from './lookup';
export * from './join';
export { DEMO_DEVICE_CERTIFICATE_PEM, DEMO_EVIDENCE_DOCUMENTS, DEMO_EVIDENCE_INDEX };

/** Manifest, metadata and signature text of a package (by evidence ID or suffix). */
export function getDemoEvidenceDocuments(evidenceIdOrSuffix: string | number): DemoEvidenceDocuments | null {
  const suffix = demoIdSuffix(evidenceIdOrSuffix, 'EV');
  return suffix === null ? null : (DEMO_EVIDENCE_DOCUMENTS[suffix] ?? null);
}

/** The trust anchors `verifyDemoPackage` needs: the DEMO certificate fingerprint and public key. */
export function demoVerificationTrust(): { certificateSha256: string; publicKeyHex: string } {
  return {
    certificateSha256: DEMO_EVIDENCE_INDEX.certificate.sha256,
    publicKeyHex: DEMO_EVIDENCE_INDEX.key.publicKeyHex,
  };
}

/** Joins an asset path (relative to packages/shared/assets/) to a base URL or folder. */
export function demoAssetUrl(assetPath: string, base: string): string {
  return `${base.replace(/\/+$/, '')}/${assetPath.replace(/^\/+/, '')}`;
}
