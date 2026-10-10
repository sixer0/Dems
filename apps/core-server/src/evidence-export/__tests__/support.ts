// Test support of the export unit (blueprint row 91). The packages come from the builder of verify
// v2 (`evidence-verify/__tests__/support.ts`, decision D133: the product seal of row 82 does not
// exist yet): real bytes, real SHA-256, real AES-256-GCM per fragment, a real Ed25519 signature of
// a throw-away key. The media is random bytes, not video. Nothing here is evidence.
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { copyFileSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { ManifestV2Input, SessionCaptureSourceRow } from '@dems/shared/evidence-package';
import { NOW, buildPackage, scratch, type BuiltPackage } from '../../evidence-verify/__tests__/support';
import type { CompositeEncoder } from '../composite';
import { EXPORT_MANIFEST_FILE, EXPORT_SIGNATURE_FILE } from '../export-manifest';
import type { ExportOutcome, ExportPorts, ExportRequestFacts } from '../package-export';

export const UNZIP = '/usr/bin/unzip';
export const EXPORTED_AT = NOW + 60_000;

export function requestFacts(overrides: Partial<ExportRequestFacts> = {}): ExportRequestFacts {
  return { exportId: 'EXP-000032', kind: 'PACKAGE', exportedAt: EXPORTED_AT, exportedBy: 'OPR-002', authorizationRef: 'AUD-000101', destination: 'Case file transfer', purpose: 'Prosecutor request', ...overrides };
}

export function portsOf(built: BuiltPackage, overrides: Partial<ExportPorts> = {}): ExportPorts {
  return { opener: built.opener, signer: built.signer, trustedCertificateSha256: [built.signer.certificate.sha256], composite: null, chunkBytes: 512, ...overrides };
}

/** Every file below a folder with its SHA-256, sorted: what "untouched" is compared on. */
export function treeHashes(dir: string, skip: (relative: string) => boolean = () => false): Record<string, string> {
  const found: Record<string, string> = {};
  const walk = (relative: string): void => {
    for (const name of readdirSync(relative === '' ? dir : join(dir, relative)).sort()) {
      const path = relative === '' ? name : `${relative}/${name}`;
      if (skip(path)) continue;
      if (statSync(join(dir, path)).isDirectory()) walk(path);
      else found[path] = createHash('sha256').update(readFileSync(join(dir, path))).digest('hex');
    }
  };
  walk('');
  return found;
}

export interface Delivered {
  /** The folder with the three files. */
  readonly exportDir: string;
  readonly unpackedDir: string;
  readonly archive: string;
}

/** Copies the three files of an export to a destination folder and unpacks the archive there with the system's `unzip`. */
export function deliver(built: BuiltPackage, outcome: ExportOutcome): Delivered {
  const exportDir = scratch('destination');
  const archive = join(exportDir, `${outcome.exportId}.zip`);
  copyFileSync(built.path(outcome.files.archive), archive);
  copyFileSync(built.path(outcome.files.manifest), join(exportDir, EXPORT_MANIFEST_FILE));
  copyFileSync(built.path(outcome.files.signature), join(exportDir, EXPORT_SIGNATURE_FILE));
  const unpackedDir = join(exportDir, 'unpacked');
  mkdirSync(unpackedDir);
  execFileSync(UNZIP, ['-q', archive, '-d', unpackedDir]);
  return { exportDir, unpackedDir, archive };
}

/** A STAND-IN for a video encoder: it reads both decrypted streams to their end and writes a digest of them. No video. */
export function standInEncoder(name = 'stand-in-encoder'): CompositeEncoder & { readonly read: Record<string, number> } {
  const read: Record<string, number> = {};
  return {
    name,
    read,
    async encode(sources, outputFile) {
      const hash = createHash('sha256');
      for (const source of sources) {
        read[source.trackId] = 0;
        for await (const piece of source.read()) {
          hash.update(piece);
          read[source.trackId] = (read[source.trackId] ?? 0) + piece.byteLength;
        }
      }
      writeFileSync(outputFile, `STAND-IN COMPOSITE ${hash.digest('hex')}\n`);
    },
  };
}

/** Rows of production sources, written by hand (no builder of this phase makes them, D86 C-5): for the unmarked control only. */
const PRODUCTION_ROWS: readonly SessionCaptureSourceRow[] = [
  { slot: 'VIDEO-01', deviceId: 'CAM-07', adapterKind: 'ONVIF_RTSP' },
  { slot: 'VIDEO-02', deviceId: 'CAM-08', adapterKind: 'ONVIF_RTSP' },
  { slot: 'MIC-PRIMARY', deviceId: 'MIC-07', adapterKind: 'USB_AUDIO' },
  { slot: 'MIC-STANDBY', deviceId: 'MIC-08', adapterKind: 'USB_AUDIO' },
];

type Loose = { tracks: { deviceId: string }[]; audio: { sourceIntervals: { micDeviceId: string }[] } };

/** A package whose signed manifest names production sources only. */
export function productionPackage(): Promise<BuiltPackage> {
  const id = (name: string): string => PRODUCTION_ROWS.find((row) => row.slot === name)?.deviceId ?? '';
  return buildPackage({
    sourceRows: PRODUCTION_ROWS,
    beforeSeal: (input: ManifestV2Input) => {
      const loose = input as unknown as Loose;
      loose.tracks.forEach((track, index) => (track.deviceId = id(index === 0 ? 'VIDEO-01' : 'VIDEO-02')));
      loose.audio.sourceIntervals.forEach((interval, index) => (interval.micDeviceId = id(index === 0 ? 'MIC-PRIMARY' : 'MIC-STANDBY')));
    },
  });
}
