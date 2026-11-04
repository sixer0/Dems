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
  /** The `export/` folder of the UNPACKED archive: where the embedded export manifest and signature lie. */
  readonly exportDir: string;
  readonly unpackedDir: string;
  /** The ONE file a receiver holds (wave H C1; ruling D200): the archive as downloaded. */
  readonly archive: string;
  /** The embedded export manifest and signature of the unpacked archive, under their per-export names. */
  readonly manifestFile: string;
  readonly signatureFile: string;
  /** The archive's hash as the Core states it OUTSIDE the archive (the job answer). */
  readonly archiveSha256: string;
}

/**
 * Hands ONE file to a destination folder - the archive, as a download does (gate finding G94-03) -
 * and unpacks it there with the system's `unzip`. Nothing else of the package folder is copied.
 */
export function deliver(built: BuiltPackage, outcome: ExportOutcome): Delivered {
  const destination = scratch('destination');
  const archive = join(destination, `${outcome.exportId}.zip`);
  copyFileSync(built.path(outcome.files.archive), archive);
  const unpackedDir = join(destination, 'unpacked');
  mkdirSync(unpackedDir);
  execFileSync(UNZIP, ['-q', archive, '-d', unpackedDir]);
  const exportDir = join(unpackedDir, 'export');
  return { exportDir, unpackedDir, archive, manifestFile: join(exportDir, `${outcome.exportId}.manifest.json`), signatureFile: join(exportDir, `${outcome.exportId}.manifest.sig`), archiveSha256: outcome.archive.sha256 };
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
  { slot: 'MIC-01', deviceId: 'MIC-07', adapterKind: 'USB_AUDIO' },
  { slot: 'MIC-02', deviceId: 'MIC-08', adapterKind: 'USB_AUDIO' },
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
      loose.audio.sourceIntervals.forEach((interval, index) => (interval.micDeviceId = id(index === 0 ? 'MIC-01' : 'MIC-02')));
    },
  });
}
