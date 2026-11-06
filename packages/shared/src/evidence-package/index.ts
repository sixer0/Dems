/**
 * Evidence package v2 (blueprint row 83 / M7-W2; register NM-08; evidence package spec §A, §B,
 * §C.1): the layout, the strict 128-field manifest, canonicalisation, `manifestSha256`,
 * `fragments.json` and `signature.sig`.
 *
 * Pure and platform neutral (zod and `@noble/hashes` only): the Core server builds and signs with
 * it, the clients display and verify with it. It makes no signature and reads no file; the
 * `Signer` lives in the Core (`apps/core-server/src/capture/signer/`).
 *
 * The v1 packages (`dems.evidence-manifest/1`, `../demo-data/`) are a different format with their
 * own verifier and are not touched by anything here.
 */
export * from './build';
export * from './canonical';
export * from './errors';
export * from './fragments';
export * from './hash';
export * from './layout';
export * from './manifest';
export * from './media-time';
export * from './signature-file';
export * from './source-class';
export * from './example';
