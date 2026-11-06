/**
 * THE SEED-TIME GENERATOR OF THE v2 DEMO PACKAGES (blueprint row 82c; row 87's request; decisions
 * D121, D148, D153, D155; evidence package spec §B.12 rule 6, §F.2, §F.4).
 *
 * WHY IT IS HERE AND NOT A SCRIPT OF `packages/shared`. A v2 package is sealed under the session
 * key of ONE Core's credential store and signed with that Core's key: it cannot be a committed
 * asset (another Core could not open it, a key may not be committed, and media does not belong in
 * git). So the demo items of a v2 seed are SEALED WHERE THEY ARE SEEDED: by the Core, into its own
 * evidence store, with the product pipeline.
 *
 * WHAT ONE CALL DOES, per demo item:
 *
 *   1. RECORDS NOTHING LIVE. Two short camera files are SYNTHESISED straight into the session's
 *      folder by the private helper program (`source-arguments.ts`: the generated picture and the
 *      encoder of the development fake camera at a camera-realistic bitrate). No worker, no
 *      listener, no device.
 *   2. SEALS THEM WITH THE PRODUCT. `createSealingPipeline` - the same six steps, the same package
 *      writer, the same cipher (the session key `KID-<sessionId>` is made in the credential store
 *      of THIS Core by the sealer that is handed in), the same signer. The journal, the fragment
 *      rows and the engine of this one run are kept in memory: a demo item is no session of the
 *      Core, and the seed that calls this writes the item's row from the returned `seal`.
 *   3. SAYS WHAT IT IS. Every source is `FAKE`, so the manifest holds `developmentSources: true`;
 *      it says `integrity: 'DEMO_PACKAGE'` and `demo: true` (ev §B.12 rule 6); and the signing key
 *      must be the DEVELOPMENT key (`OU=DEVELOPMENT KEY - NOT FOR PRODUCTION`) - with any other key
 *      nothing is generated.
 *   4. THE TAMPER DEMO (ev §F.2). For the item of evidence sequence `DEMO_TAMPERED_EVIDENCE_SEQ`
 *      (EV 0005) exactly ONE byte of the STORED bytes of ONE fragment is altered AFTER the seal:
 *      `(DEMO_TAMPERED_FRAGMENT_TRACK, DEMO_TAMPERED_FRAGMENT_SEQ)` = (VIDEO-02, 3). Nothing else
 *      of the package is touched.
 *   5. CHECKS ITS OWN WORK with the verifier of operation 41 (`verifyPackageV2`, the Core's
 *      anchors): a clean item passes every check; the tampered item fails as TAMPERED and the ONE
 *      fragment that did not verify is the scripted one. A package that does not read as scripted
 *      is removed and the call fails - a demo that would mislead is never left in the store.
 *
 * WHERE IT WRITES. Only below `mediaStoreDir`, which must lie inside `dataDir` (the git-ignored
 * data directory): `SESSION-<sessionId>/` and the staging folder `.sealing/<sessionId>/`. A session
 * folder that exists is never written into (`PACKAGE_EXISTS`). Nothing is written to the
 * repository, and nothing here is a committed asset. What a failed call created, it removes.
 *
 * WHAT IT DOES NOT DO (closed areas; the exact request lines are in the row's note): it starts no
 * process itself (`synthesise` is the Core's helper door, handed in), writes no database row, and
 * does not admit the item to operation 41 (`findItem` of the composition admits REAL items only).
 */
import { mkdir, open, readFile, rm, stat } from 'node:fs/promises';
import { isAbsolute, join, relative, resolve } from 'node:path';
import { PackageFile, cameraFileName, cameraFilePath, parseManifestV2, type ManifestV2 } from '@dems/shared/evidence-package';
import { verifyPackageV2, type FragmentOpener, type PackageVerifyResult } from '@dems/shared/evidence-verify';
import { DEMO_TAMPERED_EVIDENCE_SEQ, DEMO_TAMPERED_FRAGMENT_SEQ, DEMO_TAMPERED_FRAGMENT_TRACK, type CompleteSealInput } from '@dems/shared/sim';
import { corePorts, sessionPackageDir } from '../../evidence-verify';
import { VIDEO_TRACK_IDS, type AnyRecordingFragment, type FragmentTrackId, type VideoTrackId } from '../../modules/recording-fragments';

/** D60 (2026-11-04): the camera files the demonstration corpus records - the pre-D60 built-in pair, the list THIS corpus names at its start (a manifest names its own list and stays valid). */
const DEMO_SEAL_TRACKS: readonly VideoTrackId[] = [VIDEO_TRACK_IDS[0]!, VIDEO_TRACK_IDS[1]!];
import { describeError, type ErrorLog } from '../../plugins/logger';
import {
  SEALING_QUARANTINE_DIR,
  createSealingPipeline,
  createTranscriptFileReader,
  finalizeTranscript,
  isDevelopmentSigningCertificate,
  listPackageFiles,
  systemStepTimer,
  type AssembledTranscriptSource,
  type SealSessionFacts,
  type SealingPorts,
  type SealingStepJournal,
  type SealingStepRecord,
  type SessionFragmentSealer,
} from '../../sealing';
import { DEMO_CAMERA_PROFILE, DEMO_CLIP_SECONDS, demoCameraFileArguments } from './source-arguments';

export * from './source-arguments';
// Integration pass E3: the seed hook over this generator (staged seal, then placement).
export * from './seed-hook';

const SOURCE = 'sealingHost.demoSeed';
const SESSION_ID = /^SES-[0-9]{8}-[0-9]{4}$/;
const EVIDENCE_ID = /^EV-[0-9]{8}-([0-9]{4})$/;
/** No demo package may be heavier than this (decision D155: "if one package is above 10 MB, stop"). */
export const DEMO_PACKAGE_MAX_BYTES = 10 * 1024 * 1024;
export const DEMO_PACKAGE_NOTICE = 'DEMO PACKAGE - generated development sources, sealed with the development signing key. Not evidence.';
/** The fragment the tamper demo alters (ev §F.2), from the shared constants and from nowhere else. */
export const DEMO_TAMPERED_FRAGMENT = Object.freeze({ trackId: DEMO_TAMPERED_FRAGMENT_TRACK, seq: DEMO_TAMPERED_FRAGMENT_SEQ });
/**
 * The four sources of a demo session, every one a generated (`FAKE`) one on the built-in device of
 * its slot. ONE list: the manifest of the package is built from it, and the seed writes the same
 * four `session_capture_sources` rows for the item's session (pass E3; the reset guard reads them).
 */
export const DEMO_SOURCE_ROWS = Object.freeze([
  Object.freeze({ slot: 'VIDEO-01', deviceId: 'CAM-01', adapterKind: 'FAKE' }),
  Object.freeze({ slot: 'VIDEO-02', deviceId: 'CAM-02', adapterKind: 'FAKE' }),
  // D61 (2026-11-04): the two mic roles became numbered channels (0040 renames `MIC-PRIMARY`/`MIC-STANDBY` to these names);
  // the demo corpus is history of the two-channel shape and seals its own list (prefix rule).
  Object.freeze({ slot: 'MIC-01', deviceId: 'MIC-01', adapterKind: 'FAKE' }),
  Object.freeze({ slot: 'MIC-02', deviceId: 'MIC-02', adapterKind: 'FAKE' }),
] as const);
/** The session's own STT snapshot of a demo item: transcription off, so the package seals with the declared state DISABLED. */
const DEMO_STT_SNAPSHOT = Object.freeze({ enabled: false, backend: 'cpu-local', model: 'none', diarization: false, revision: 1 }) satisfies SealSessionFacts['sttSnapshot'];

export const DemoSealFailure = {
  /** The call is malformed: an ID, an instant or the clip length. */
  INPUT_INVALID: 'INPUT_INVALID',
  /** `mediaStoreDir` does not lie inside `dataDir`: nothing is written outside the data directory. */
  STORE_OUTSIDE_DATA_DIR: 'STORE_OUTSIDE_DATA_DIR',
  /** The signing key is not the development key: a demo package is never signed with another. */
  NOT_A_DEVELOPMENT_KEY: 'NOT_A_DEVELOPMENT_KEY',
  /** The session's folder exists already: it is never written into. */
  PACKAGE_EXISTS: 'PACKAGE_EXISTS',
  /** The helper did not write a camera file. */
  SOURCE_NOT_SYNTHESISED: 'SOURCE_NOT_SYNTHESISED',
  /** The product pipeline did not seal (its step and code are in the detail). */
  SEAL_FAILED: 'SEAL_FAILED',
  /** A sealed package is heavier than `DEMO_PACKAGE_MAX_BYTES`. */
  PACKAGE_TOO_LARGE: 'PACKAGE_TOO_LARGE',
  /** The fragment of the tamper demo is not in the sealed file (the clip is too short). */
  TAMPER_FRAGMENT_ABSENT: 'TAMPER_FRAGMENT_ABSENT',
  /** The package does not verify as scripted: a clean one does not pass, or the tampered one does not name the one fragment. */
  NOT_AS_SCRIPTED: 'NOT_AS_SCRIPTED',
} as const;
export type DemoSealFailure = (typeof DemoSealFailure)[keyof typeof DemoSealFailure];

/** Fixed text; `detail` holds identifiers, counts and codes - never a path, a hash or a key. */
export class DemoSealError extends Error {
  readonly code: DemoSealFailure;
  readonly detail: Readonly<Record<string, string | number | boolean | null>>;
  constructor(code: DemoSealFailure, message: string, detail: Readonly<Record<string, string | number | boolean | null>> = {}, cause?: unknown) {
    super(message, cause === undefined ? undefined : { cause });
    this.name = 'DemoSealError';
    this.code = code;
    this.detail = detail;
  }
}

/** One demo item as the seed defines it. Nothing of it is read from a device or a session of the Core. */
export interface DemoSealItem {
  /** `EV-<date>-<sequence>`; sequence `DEMO_TAMPERED_EVIDENCE_SEQ` is the item of the tamper demo. */
  readonly evidenceId: string;
  readonly sessionId: string;
  readonly caseNumber: string;
  /** Epoch milliseconds. The recording "ends" `seconds` after `startedAt`. */
  readonly createdAt: number;
  readonly startedAt: number;
  readonly device: SealSessionFacts['device'];
  readonly operator: SealSessionFacts['operator'];
  readonly subject: SealSessionFacts['subject'];
}

export interface DemoSealOptions {
  /** The Core's git-ignored data directory (`app.config.dataDir`). */
  readonly dataDir: string;
  /** The Core's evidence store (`app.config.mediaStoreDir`): must lie inside `dataDir`. */
  readonly mediaStoreDir: string;
  /**
   * Writes ONE generated camera file: runs the private helper program with exactly `args` (the
   * last one is `outPath`) and resolves when it has ended with the file written. The seed hook
   * hands in the Core's one helper door; this unit starts no process.
   */
  readonly synthesise: (request: { readonly trackId: VideoTrackId; readonly args: readonly string[]; readonly outPath: string }) => Promise<void>;
  /** The seal-time cipher over the credential store of THIS Core (`coreFragmentSealer(app)`): the session key is made there. */
  readonly sealer: SessionFragmentSealer;
  /** The one fragment opener of this Core (`coreFragmentOpener(app)`). */
  readonly opener: FragmentOpener;
  /** The signer of `<dataDir>/signer`. Refused unless its certificate is the development one. */
  readonly signing: SealingPorts['signing'];
  readonly log: ErrorLog;
  /** Epoch milliseconds: the Core clock. */
  readonly now: () => number;
  /** Seconds of media per camera file. Default `DEMO_CLIP_SECONDS`. */
  readonly seconds?: number;
  /** A LOWER size bound, for a test. Never above `DEMO_PACKAGE_MAX_BYTES`. */
  readonly maxPackageBytes?: number;
}

export interface DemoSealedPackage {
  readonly evidenceId: string;
  readonly sessionId: string;
  /** What the engine's `completeSeal` was given: the columns of the item's row (digest, signature, tracks, development sources). */
  readonly seal: CompleteSealInput;
  readonly manifestSha256: string;
  /** Bytes of every file of the sealed package together. */
  readonly bytes: number;
  readonly files: readonly string[];
  readonly fragmentsPerFile: readonly number[];
  /** Manifest facts a reader of the package sees: fields 6, 7 and 126. */
  readonly manifest: { readonly integrity: string; readonly demo: boolean; readonly developmentSources: boolean };
  /** The fragment whose stored bytes were altered after the seal, or null. */
  readonly tampered: { readonly trackId: VideoTrackId; readonly seq: number } | null;
  /** What the verifier of operation 41 says of the package as it was LEFT in the store. */
  readonly verify: {
    readonly ok: boolean;
    readonly overall: PackageVerifyResult['overall'];
    readonly failedChecks: readonly string[];
    /** Every fragment that did not verify. */
    readonly fragments: readonly { readonly trackId: string; readonly seq: number }[];
    readonly chainBrokenFromSeq: number | null;
    /** `sources.development` of the verify report: recomputed by the verifier from the classes. */
    readonly developmentSources: boolean;
    /** `signature.developmentKey` of the verify report. */
    readonly developmentKey: boolean | null;
  };
}

/** The item of the tamper demo: evidence sequence `DEMO_TAMPERED_EVIDENCE_SEQ`, whatever the demo day. */
export function isDemoTamperItem(evidenceId: string): boolean {
  const sequence = EVIDENCE_ID.exec(evidenceId)?.[1];
  return sequence !== undefined && Number(sequence) === DEMO_TAMPERED_EVIDENCE_SEQ;
}

function memoryJournal(): SealingStepJournal {
  const rows = new Map<string, SealingStepRecord>();
  return {
    async read(sessionId, step) {
      const row = rows.get(`${sessionId}#${step}`);
      return row === undefined ? null : structuredClone(row);
    },
    async write(write) {
      const { at, ...record } = structuredClone(write);
      const key = `${write.sessionId}#${write.step}`;
      rows.set(key, { ...record, startedAt: rows.get(key)?.startedAt ?? at, updatedAt: at });
    },
  };
}

/** A demo item has no transcript: the transcriber is asked nothing. */
const NEVER_ASKED: AssembledTranscriptSource = {
  assemble: async () => {
    throw new Error('a demo package asks the transcriber nothing');
  },
  locate: () => {
    throw new Error('a demo package has no transcript files');
  },
  closeOut: async () => {
    throw new Error('a demo package closes no transcript out');
  },
};

function factsOf(item: DemoSealItem, seconds: number): SealSessionFacts {
  const track = (trackId: VideoTrackId, index: number): SealSessionFacts['tracks'][number] => ({
    trackId,
    deviceId: `CAM-0${index + 1}`,
    profile: DEMO_CAMERA_PROFILE,
    name: `Generated camera ${index + 1}`,
    model: 'generated source',
    firmware: 'generated source',
    clockOffsetMs: 0,
    // Field 43 is the codec ENUMERATION the seal writes (`VideoCodec`: H264 | HEVC; ev §B.4 erratum PE-D9-03), never the v1 text
    // 'H.264 + AAC-LC' (fix pass F-M7; review row 69, question 11). The generated source is H.264 (`DEMO_CAMERA_PROFILE`).
    codec: 'H264',
    avOffsetMs: null,
    firstVideoSamplePts: null,
    firstVideoSampleTimescale: null,
  });
  return {
    sessionId: item.sessionId,
    evidenceId: item.evidenceId,
    caseNumber: item.caseNumber,
    notice: DEMO_PACKAGE_NOTICE,
    timezone: '+07:00',
    createdAt: item.createdAt,
    startedAt: item.startedAt,
    stoppedAt: item.startedAt + seconds * 1000,
    timeSource: { source: 'RTC', state: 'UNLOCKED', fallbackOrder: ['GNSS', 'NTP', 'RTC'] },
    device: item.device,
    operator: item.operator,
    subject: item.subject,
    tracks: [track('VIDEO-01', 0), track('VIDEO-02', 1)],
    audioCodec: 'AAC-LC',
    audioIntervals: [{ seq: 1, micDeviceId: 'MIC-01', role: 'PRIMARY', fromMs: 0, toMs: null, reason: 'START', switchedBy: null }],
    // Every source of a demo package is a generated one: the manifest's classes are all FAKE and field 126 is true.
    sourceRows: DEMO_SOURCE_ROWS.map((row) => ({ ...row })),
    sttSnapshot: DEMO_STT_SNAPSHOT,
    // No audit row belongs to a generated item: the extract is empty, never invented.
    auditExtract: new Uint8Array(0),
    demoPackage: true,
  };
}

async function exists(path: string): Promise<boolean> {
  try {
    await stat(path);
    return true;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return false;
    throw error;
  }
}

/** Alters ONE byte of the stored bytes of one fragment, in place: the byte in the middle of its range. */
async function alterOneFragment(packageDir: string, manifest: ManifestV2, target: { readonly trackId: VideoTrackId; readonly seq: number }): Promise<void> {
  const fragment = manifest.files.find((file) => file.trackId === target.trackId)?.fragments.find((entry) => entry.seq === target.seq);
  if (fragment === undefined) throw new DemoSealError(DemoSealFailure.TAMPER_FRAGMENT_ABSENT, 'the fragment of the tamper demo is not in the sealed camera file', { trackId: target.trackId, seq: target.seq });
  const at = fragment.byteOffset + Math.floor(fragment.byteLength / 2);
  const handle = await open(join(packageDir, ...cameraFilePath(target.trackId).split('/')), 'r+');
  try {
    const one = Buffer.alloc(1);
    const { bytesRead } = await handle.read(one, 0, 1, at);
    if (bytesRead !== 1) throw new DemoSealError(DemoSealFailure.TAMPER_FRAGMENT_ABSENT, 'the fragment of the tamper demo is not in the sealed camera file', { trackId: target.trackId, seq: target.seq });
    one[0] = (one[0] as number) ^ 0xff;
    await handle.write(one, 0, 1, at);
    await handle.sync();
  } finally {
    await handle.close();
  }
}

/**
 * Seals the given demo items into the Core's evidence store, one after the other. Resolves with
 * one entry per item, in order; rejects with `DemoSealError` at the first item that could not be
 * left as scripted (what that item created is removed; items sealed before it stay).
 */
export async function sealDemoPackages(options: DemoSealOptions, items: readonly DemoSealItem[]): Promise<DemoSealedPackage[]> {
  const seconds = options.seconds ?? DEMO_CLIP_SECONDS;
  const maxBytes = Math.min(options.maxPackageBytes ?? DEMO_PACKAGE_MAX_BYTES, DEMO_PACKAGE_MAX_BYTES);
  const store = resolve(options.mediaStoreDir);
  const inside = relative(resolve(options.dataDir), store);
  if (!isAbsolute(options.dataDir) || !isAbsolute(options.mediaStoreDir) || inside === '' || inside.startsWith('..') || isAbsolute(inside)) {
    throw new DemoSealError(DemoSealFailure.STORE_OUTSIDE_DATA_DIR, 'the evidence store of a demo package must lie inside the data directory');
  }
  if (!isDevelopmentSigningCertificate(options.signing.certificate)) {
    throw new DemoSealError(DemoSealFailure.NOT_A_DEVELOPMENT_KEY, 'a demo package is sealed with the development signing key only');
  }
  const seen = new Set<string>();
  for (const item of items) {
    const valid = SESSION_ID.test(item.sessionId) && EVIDENCE_ID.test(item.evidenceId) && Number.isSafeInteger(item.createdAt) && Number.isSafeInteger(item.startedAt) && item.startedAt >= item.createdAt;
    if (!valid || seen.has(item.sessionId) || seen.has(item.evidenceId)) throw new DemoSealError(DemoSealFailure.INPUT_INVALID, 'a demo item is not of its shape, or is named twice', { evidenceId: String(item.evidenceId).slice(0, 32) });
    seen.add(item.sessionId).add(item.evidenceId);
  }

  const sealed: DemoSealedPackage[] = [];
  for (const item of items) sealed.push(await sealOne(item));
  return sealed;

  async function sealOne(item: DemoSealItem): Promise<DemoSealedPackage> {
    const { sessionId, evidenceId } = item;
    const packageDir = sessionPackageDir(store, sessionId);
    const stagingDir = join(store, '.sealing', sessionId);
    // A folder that is there is another seal's, or a session's: never written into, never removed.
    if (await exists(packageDir)) throw new DemoSealError(DemoSealFailure.PACKAGE_EXISTS, 'the folder of that session exists already', { sessionId });
    try {
      return await generate();
    } catch (error) {
      // What THIS call created goes: the folder did not exist before it.
      await rm(packageDir, { recursive: true, force: true });
      await rm(stagingDir, { recursive: true, force: true });
      const failure = error instanceof DemoSealError ? error : new DemoSealError(DemoSealFailure.SEAL_FAILED, 'a demo package could not be sealed', {}, error);
      options.log.append({ level: 'error', source: SOURCE, message: 'a demo package could not be generated: what the call created was removed', ...describeError(failure.cause ?? failure), code: failure.code, context: { sessionId, evidenceId, ...failure.detail } });
      throw failure;
    }

    async function generate(): Promise<DemoSealedPackage> {
      // 1. The two generated camera files, where a worker would have left its recordings.
      // D60 (2026-11-04): the demonstration corpus is the pre-D60 two-file recording (the seed's own check in
      // `db/seed/demo-packages.ts`): the synthesis walks the session's OWN track list, not the widened value set -
      // a third and fourth clip would sit undeclared in the package folder (verify V-14).
      await mkdir(packageDir, { recursive: true, mode: 0o700 });
      for (const trackId of DEMO_SEAL_TRACKS) {
        const outPath = join(packageDir, cameraFileName(trackId));
        try {
          await options.synthesise({ trackId, args: demoCameraFileArguments({ seconds, outPath }), outPath });
        } catch (error) {
          throw new DemoSealError(DemoSealFailure.SOURCE_NOT_SYNTHESISED, 'the helper did not write a generated camera file', { trackId }, error);
        }
        if (!(await exists(outPath))) throw new DemoSealError(DemoSealFailure.SOURCE_NOT_SYNTHESISED, 'the helper did not write a generated camera file', { trackId });
      }

      // 2. The product pipeline, with the journal, the rows and the engine of this one run in memory.
      // Row 153 (D118 H-2): the fake of the pipeline's port is keyed by the eight tracks of 0044; the demo seals only its two cameras.
      const rows = new Map<FragmentTrackId, AnyRecordingFragment[]>(DEMO_SEAL_TRACKS.map((trackId) => [trackId, []])); // D60 (2026-11-04): the session's own two tracks
      const commits: CompleteSealInput[] = [];
      const journal = memoryJournal();
      const facts = factsOf(item, seconds);
      const ports: SealingPorts = {
        journal,
        fragments: {
          read: async (_session, trackId) => (rows.get(trackId) ?? []).map((row) => ({ ...row })),
          // Nothing was recorded live, so no recorder wrote a row: CLOSE_TRACKS rebuilds every row from the validated bytes of the file.
          async insertMissing(missing) {
            let inserted = 0;
            for (const row of missing) {
              const stored = rows.get(row.trackId) ?? [];
              if (stored.some((existing) => existing.seq === row.seq)) continue;
              stored.push({ ...row });
              rows.set(row.trackId, stored);
              inserted += 1;
            }
            return { inserted, alreadyStored: missing.length - inserted };
          },
        },
        sealer: options.sealer,
        opener: options.opener,
        session: { read: async (asked) => (asked === sessionId ? facts : null) },
        transcript: { finalize: (input) => finalizeTranscript(input, { transcript: NEVER_ASKED, chunkRows: { read: async () => [] }, files: createTranscriptFileReader(), journal, log: options.log, now: options.now, timer: systemStepTimer }) },
        signing: options.signing,
        engine: {
          applySealingProgress: async () => {},
          async completeSeal(input) {
            if (commits.some((entry) => entry.manifestSha256 === input.manifestSha256)) return 'ALREADY_SEALED';
            commits.push(structuredClone(input) as CompleteSealInput);
            return 'SEALED';
          },
          isSealed: (_session, manifestSha256) => commits.some((entry) => entry.manifestSha256 === manifestSha256),
        },
        packageDir: () => packageDir,
        stagingDir: () => stagingDir,
        quarantineDir: () => join(store, SEALING_QUARANTINE_DIR, sessionId),
        log: options.log,
        now: options.now,
        timer: systemStepTimer,
      };
      const outcome = await createSealingPipeline(ports).run({ sessionId, cause: 'STOPPED' });
      const seal = commits[0];
      if (outcome.status !== 'SEALED' || seal === undefined || outcome.interrupted) {
        throw new DemoSealError(DemoSealFailure.SEAL_FAILED, 'the pipeline did not seal the demo package', outcome.status === 'FAILED' ? { step: outcome.step, failure: outcome.code } : { status: outcome.status });
      }
      await rm(stagingDir, { recursive: true, force: true });

      // 3. What was sealed, read back from the store.
      const files = await listPackageFiles(packageDir);
      let bytes = 0;
      for (const name of files) bytes += (await stat(join(packageDir, ...name.split('/')))).size;
      if (bytes > maxBytes) throw new DemoSealError(DemoSealFailure.PACKAGE_TOO_LARGE, 'a demo package is heavier than its bound', { bytes, limitBytes: maxBytes });
      const manifest = parseManifestV2(JSON.parse(await readFile(join(packageDir, PackageFile.MANIFEST), 'utf8')));
      if (manifest.integrity !== 'DEMO_PACKAGE' || !manifest.demo || !manifest.developmentSources) {
        throw new DemoSealError(DemoSealFailure.NOT_AS_SCRIPTED, 'the sealed manifest does not say that it is a demo package of development sources');
      }
      const check = (): Promise<PackageVerifyResult> =>
        verifyPackageV2(corePorts(packageDir, options.opener), {
          plaintext: 'REQUIRED',
          expected: { evidenceId, sessionId, manifestSha256: seal.manifestSha256, transcriptSha256: seal.transcriptSha256, revisionCount: 0, trustedCertificateSha256: [options.signing.certificate.sha256] },
        });

      // 4. Every package is sealed CLEAN and must pass before anything is altered.
      const clean = await check();
      if (!clean.ok) throw new DemoSealError(DemoSealFailure.NOT_AS_SCRIPTED, 'a freshly sealed demo package does not verify', { overall: clean.overall, failed: clean.checks.filter((entry) => entry.status === 'FAIL').map((entry) => entry.id).join(',') });

      // 5. The tamper demo: ONE fragment's stored bytes, after the seal; then the verifier must name exactly that fragment.
      const tampered = isDemoTamperItem(evidenceId) ? { ...DEMO_TAMPERED_FRAGMENT } : null;
      let left = clean;
      if (tampered !== null) {
        await alterOneFragment(packageDir, manifest, tampered);
        left = await check();
        const named = left.fragments.map((fragment) => `${fragment.trackId}#${fragment.seq}`);
        const file = left.files.find((entry) => entry.trackId === tampered.trackId);
        if (left.ok || left.overall !== 'TAMPERED' || named.length !== 1 || named[0] !== `${tampered.trackId}#${tampered.seq}` || file?.chainBrokenFromSeq !== tampered.seq || !left.signature.ok) {
          throw new DemoSealError(DemoSealFailure.NOT_AS_SCRIPTED, 'the tampered demo package does not name the one altered fragment', { overall: left.overall, fragments: named.length });
        }
      }
      return {
        evidenceId,
        sessionId,
        seal,
        manifestSha256: seal.manifestSha256,
        bytes,
        files,
        fragmentsPerFile: manifest.files.map((file) => file.fragments.length),
        manifest: { integrity: manifest.integrity, demo: manifest.demo, developmentSources: manifest.developmentSources },
        tampered,
        verify: {
          ok: left.ok,
          overall: left.overall,
          failedChecks: left.checks.filter((entry) => entry.status === 'FAIL').map((entry) => entry.id),
          fragments: left.fragments.map((fragment) => ({ trackId: fragment.trackId, seq: fragment.seq })),
          chainBrokenFromSeq: tampered === null ? null : (left.files.find((entry) => entry.trackId === tampered.trackId)?.chainBrokenFromSeq ?? null),
          developmentSources: left.sources.development === true,
          developmentKey: left.signature.developmentKey,
        },
      };
    }
  }
}
