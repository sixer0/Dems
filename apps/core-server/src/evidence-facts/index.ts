/**
 * WHAT THE CORE SAYS OF AN EVIDENCE ITEM BEYOND ITS STORED ROWS (task 3 wave H, driver C1; gate
 * findings G94-01, G94-04, G94-05, G94-06 / G81-07, G89-03, G89-04, G89-09; decision D200).
 *
 * Operation 40 answered the stored rows and a media reference that could only say "bundled demo
 * package" or "none"; every other fact a client showed, it guessed. This unit states them:
 *
 *   THE MEDIA STATE of every kind of item (`media`):
 *     LIVE_STREAM   an item whose sealed v2 package lies in this Core's store - a product seal
 *                   (`integritySource: REAL`) or, since decision D205, a demonstration item the
 *                   seed sealed here - and plays NOW by the same plan operation 88 makes, with the
 *                   camera files it really holds (`fileIds`: one or two IDs);
 *     DEMO_PACKAGE  a v1 demonstration item the bundled package belongs to (the shared join, done
 *                   by the caller). Never an item with a sealed package here;
 *     NONE          with `reason`: the package of a REAL item cannot be played (`PACKAGE_MISSING`
 *                   when the folder is gone or quarantined, a manifest that is not the sealed one,
 *                   a missing file, a lost session key), an item that was never sealed
 *                   (`NOT_SEALED`), or an item with neither a package here nor a bundled one
 *                   (`NOT_A_SEALED_PACKAGE`).
 *   THE SEALED FACTS of an item whose package lies in this Core's store (`sealed-facts.ts`): the
 *     audio-source intervals, `interrupted` and its cause, the camera files with their sealed
 *     hashes, `signature.developmentKey`, and `sealedPackage` (PRESENT / NOT_READABLE). They are
 *     carried by THE REPLICATED ITEM (the engine's sealed-facts door): put there after a start
 *     (boot step `evidence.sealedFacts` - a state the engine read back holds none, no column does)
 *     and after every seal that commits (`EVIDENCE_SEALED` in a committed unit).
 *   THE TRANSCRIPT SUMMARY on the BODY of operation 40: the one the replicated item carries.
 *   WHAT THIS CALLER MAY DO (`access`): play, read the transcript, export - by the ONE case-scope
 *     predicate of the media unit - so that a page VIEW asks for nothing it would be refused (each
 *     refusal is an audited `ACCESS_DENIED` row; the row belongs to an operator who really asked).
 *   THE FINISHED EXPORTS of the item (`exports`), for a caller who may export.
 *
 * ONE SOURCE FOR BOTH ANSWERS. Operations 39 and 40 lay the members of the replicated item over
 * the item they read from the rows (`overlay`); operation 40 reads the package itself when the
 * replicated item carries no sealed facts yet (an item the engine does not hold, a state that was
 * rehydrated inside the process) and then puts them on the replicated item too.
 *
 * NEVER A REFUSAL, NEVER A GUESS. A package that cannot be read is said to be `NOT_READABLE`; the
 * facts of another manifest are never restated. A failure of the publication is one line in the
 * log and one entry in the persistent error log; operation 40 still answers.
 *
 * CLOSED: imported through this index only. It registers no route; `modules/evidence` hands it
 * the request and the item.
 */
import { EvidenceMediaSource, type EvidenceDetail, type EvidenceMediaRef } from '@dems/shared/api';
import { AuditType, Permission, type EvidenceItem } from '@dems/shared/sim';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import { itemWithSealedFacts, sealedFactsDoorsOf, type ItemWithSealedFacts, type SealedItemFacts } from '../engine';
import { createExportService } from '../evidence-export';
import { hasSealedPackageHere, sessionPackageDir } from '../evidence-verify';
import { holdsCase, mediaStream } from '../media-stream';
import { describeError } from '../plugins/logger';
import { readSealedItemFacts } from './sealed-facts';

export { readSealedItemFacts, type SealedFactsAnchors } from './sealed-facts';

/** The ID of the boot step. */
export const SEALED_FACTS_BOOT_STEP = 'evidence.sealedFacts';
const SOURCE = 'evidenceFacts';
/** The code of sealed facts that were not published. */
export const SEALED_FACTS_NOT_PUBLISHED = 'SEALED_ITEM_FACTS_NOT_PUBLISHED';
/** The code of a package that is here by the item's facts and could not be read as the sealed one. */
export const SEALED_PACKAGE_NOT_READABLE = 'SEALED_PACKAGE_NOT_READABLE';
/** How many evidence IDs one line names; the count beside them is always the true one. */
export const FACTS_NAMED_IN_A_LINE = 10;
/** How many readings are kept (a reading is the facts of one manifest: no media, no key). */
export const SEALED_FACTS_CACHE_ENTRIES = 512;

/** `media.reason` of an item that was never sealed, and of one with no package here and no bundled one. */
export const MEDIA_NOT_SEALED_REASON = 'NOT_SEALED';
export const MEDIA_NO_PACKAGE_REASON = 'NOT_A_SEALED_PACKAGE';

/** What a test replaces. */
export interface EvidenceFactsParts {
  /** The folder of a session's sealed package. */
  packageDirOf(sessionId: string): string;
}

export interface EvidenceFactsControl {
  /**
   * Operation 40: the item read from the rows with everything the Core says beside them. `bundled`
   * is the shared join of the bundled demo packages for this item (the caller's: `DEMO_PACKAGE`
   * with its suffix, or `NONE`).
   */
  detail(request: FastifyRequest, item: EvidenceItem, bundled: EvidenceMediaRef): Promise<EvidenceDetail>;
  /** Operation 39: the items with the members their replicated items carry. Reads no package. */
  overlay(items: readonly EvidenceItem[]): EvidenceItem[];
  /**
   * Puts the sealed facts on the replicated items that have a package here and carry none (all of
   * them, or the one named). Resolves with the number of items read; never rejects.
   */
  publish(only?: { readonly evidenceId: string }): Promise<number>;
  /** Registers the boot step and, from the first start on, the watch for committed seals. Once, by the evidence module. */
  register(): void;
  /** A TEST puts its own parts in the place of the app's. No production file calls it. */
  replaceForTest(parts: Partial<EvidenceFactsParts>): void;
}

const controls = new WeakMap<object, EvidenceFactsControl>();

/** The members of a replicated item that no row holds and that the answers of operations 39 / 40 take from it. */
function replicatedMembers(row: EvidenceItem, replicated: EvidenceItem | undefined): EvidenceItem {
  // Held to the manifest digest: a replicated item of another manifest says nothing about these rows.
  if (replicated === undefined || replicated.manifestHash !== row.manifestHash) return row;
  const held = replicated as ItemWithSealedFacts;
  const next = { ...row } as ItemWithSealedFacts;
  if (held.transcript !== undefined) next.transcript = held.transcript;
  if (held.sealedPackage === undefined) return next as EvidenceItem;
  next.sealedPackage = held.sealedPackage;
  if (held.sealedPackage !== 'PRESENT') return next as EvidenceItem;
  if (held.interrupted !== undefined) next.interrupted = held.interrupted;
  if (held.interruptedCause !== undefined) next.interruptedCause = held.interruptedCause;
  if (held.audioSourceIntervals !== undefined) next.audioSourceIntervals = held.audioSourceIntervals;
  if (held.files !== undefined) next.files = held.files;
  if (held.signature.developmentKey !== undefined) next.signature = { ...next.signature, developmentKey: held.signature.developmentKey };
  return next as EvidenceItem;
}

/** The control of an app. It exists from the first call. */
export function evidenceFacts(app: FastifyInstance): EvidenceFactsControl {
  const known = controls.get(app.stages);
  if (known !== undefined) return known;

  const own: EvidenceFactsParts = { packageDirOf: (sessionId) => sessionPackageDir(app.config.mediaStoreDir, sessionId) };
  let replaced: Partial<EvidenceFactsParts> = {};
  const parts = (): EvidenceFactsParts => ({ ...own, ...replaced });
  const exports = createExportService(app);
  let registered = false;
  let stopWatching: (() => void) | null = null;

  /** Readings by manifest digest and folder: a sealed manifest does not change under its digest. Only PRESENT readings are kept. */
  const readings = new Map<string, SealedItemFacts>();
  async function factsOf(item: EvidenceItem): Promise<SealedItemFacts> {
    const dir = parts().packageDirOf(item.sessionId);
    const key = `${item.id}|${item.manifestHash}|${dir}`;
    const held = readings.get(key);
    if (held !== undefined) return held;
    const read = await readSealedItemFacts(dir, item);
    if (read.sealedPackage === 'PRESENT') {
      if (readings.size >= SEALED_FACTS_CACHE_ENTRIES) {
        const oldest = readings.keys().next().value;
        if (oldest !== undefined) readings.delete(oldest);
      }
      readings.set(key, read);
    }
    return read;
  }

  /** The replicated items, or none when the engine is not there to be read (a start that has not happened, a test's stub). */
  function replicatedItems(): readonly EvidenceItem[] {
    try {
      return app.engine.slice('evidence');
    } catch {
      return [];
    }
  }
  const replicatedOf = (evidenceId: string): EvidenceItem | undefined => replicatedItems().find((candidate) => candidate.id === evidenceId);

  function failed(code: string, message: string, err: unknown, context: Record<string, string | number>): void {
    app.log.error({ ...(err === null || err === undefined ? {} : { err }), code, source: SOURCE, ...context }, message);
    app.errorLog.append({ level: 'error', source: SOURCE, message, ...(err === null || err === undefined ? {} : describeError(err)), code, context: { step: SEALED_FACTS_BOOT_STEP, ...context } });
  }

  /** Hands a list of readings to the engine's door. Never rejects. */
  async function apply(facts: readonly SealedItemFacts[]): Promise<void> {
    if (facts.length === 0) return;
    try {
      await sealedFactsDoorsOf(app.engine).applySealedItemFacts(facts);
    } catch (err) {
      failed(SEALED_FACTS_NOT_PUBLISHED, 'the sealed facts of one or more evidence items were not put on the replicated items: operation 40 still answers them from the package', err, {
        items: facts.length,
        evidenceIds: facts.slice(0, FACTS_NAMED_IN_A_LINE).map((fact) => fact.evidenceId).join(','),
      });
    }
  }

  const control: EvidenceFactsControl = {
    async detail(request, item, bundled) {
      const replicated = replicatedOf(item.id);
      let evidence = replicatedMembers(item, replicated);
      const sealedHere = hasSealedPackageHere(item as Parameters<typeof hasSealedPackageHere>[0]);
      if (sealedHere && (evidence as ItemWithSealedFacts).sealedPackage !== 'PRESENT') {
        // Not on the replicated item (yet, or any more): read the package now, and put it there for the next reader.
        const facts = await factsOf(item);
        evidence = itemWithSealedFacts(evidence, facts);
        if (replicated !== undefined && replicated.manifestHash === item.manifestHash && (replicated as ItemWithSealedFacts).sealedPackage !== facts.sealedPackage) void apply([facts]);
      }

      const real = item.integritySource === 'REAL';
      let media: EvidenceMediaRef;
      // Decision D205: a demonstration item the seed SEALED here has a real sealed package too - it is answered
      // like any sealed package (streamable with its own camera files, or NONE with the reason), never as a bundled one.
      if (sealedHere && item.manifestVersion === 2) {
        // The plan of operation 88 itself: what is said to play here is what a media session will open.
        const playability = await mediaStream(app).playability({ evidenceId: item.id, sessionId: item.sessionId, manifestSha256: item.manifestHash });
        media = playability.playable
          ? { source: EvidenceMediaSource.LIVE_STREAM, packageSuffix: null, fileIds: [...playability.files] }
          : { source: EvidenceMediaSource.NONE, packageSuffix: null, reason: playability.reason };
      } else if (bundled.source === EvidenceMediaSource.DEMO_PACKAGE) {
        media = bundled;
      } else {
        media = { source: EvidenceMediaSource.NONE, packageSuffix: null, reason: item.sealedAt === null ? MEDIA_NOT_SEALED_REASON : MEDIA_NO_PACKAGE_REASON };
      }

      const principal = request.principal;
      if (principal.kind !== 'OPERATOR') return { evidence, media };
      // SEC35-16: REAL evidence is for the operator who holds the case, and for a SUPERVISOR - the ONE predicate of the media unit.
      const inScope = !real || holdsCase(principal, { investigatorId: item.investigatorId });
      const access = { play: inScope, readTranscript: inScope, export: inScope && principal.permissions.includes(Permission.EVIDENCE_EXPORT) };
      if (!access.export || !sealedHere) return { evidence, media, access };
      return { evidence, media, access, exports: await exports.finished({ evidenceId: item.id, sessionId: item.sessionId }) };
    },

    overlay(items) {
      const replicated = new Map(replicatedItems().map((item) => [item.id, item] as const));
      return items.map((item) => replicatedMembers(item, replicated.get(item.id)));
    },

    async publish(only) {
      const facts: SealedItemFacts[] = [];
      try {
        for (const item of replicatedItems()) {
          if (only !== undefined && item.id !== only.evidenceId) continue;
          // NORMAL, AND SILENT: an item with no sealed package here by design (a v1 demo item, a simulated one).
          if (!hasSealedPackageHere(item as Parameters<typeof hasSealedPackageHere>[0])) continue;
          if ((item as ItemWithSealedFacts).sealedPackage === 'PRESENT') continue;
          facts.push(await factsOf(item));
        }
        await apply(facts);
        const unreadable = facts.filter((fact) => fact.sealedPackage !== 'PRESENT');
        // ONE line for every package that is here by its item's facts and could not be read: never a line per item.
        if (unreadable.length > 0) {
          failed(SEALED_PACKAGE_NOT_READABLE, 'the sealed package of one or more evidence items is not in the store, or its manifest is not the one the item was sealed with: the items say so (sealedPackage NOT_READABLE) and state no sealed fact', null, {
            items: unreadable.length,
            evidenceIds: unreadable.slice(0, FACTS_NAMED_IN_A_LINE).map((fact) => fact.evidenceId).join(','),
          });
        }
      } catch (err) {
        failed(SEALED_FACTS_NOT_PUBLISHED, 'the sealed facts of the evidence items could not be read at all', err, { items: facts.length });
      }
      return facts.length;
    },

    register() {
      if (registered) throw new Error('the sealed facts of evidence items were registered twice');
      registered = true;
      app.readiness.addBootStep({
        id: SEALED_FACTS_BOOT_STEP,
        async run() {
          // From the first start on: a seal that commits gets its facts as soon as its unit has ended.
          stopWatching ??= app.pipeline.onCommit((unit) => {
            for (const row of unit.auditRows) {
              if (row.type !== AuditType.EVIDENCE_SEALED || typeof row.evidenceId !== 'string') continue;
              const evidenceId = row.evidenceId;
              // Off the commit: the door is a unit of its own. `publish` never rejects.
              setImmediate(() => void control.publish({ evidenceId }));
            }
          });
          const published = await control.publish();
          if (published > 0) app.log.info({ step: SEALED_FACTS_BOOT_STEP, items: published }, 'the sealed facts of the evidence items were read from their packages');
        },
      });
      app.addHook('onClose', async () => {
        stopWatching?.();
        stopWatching = null;
      });
    },

    replaceForTest(next) {
      replaced = { ...replaced, ...next };
    },
  };
  controls.set(app.stages, control);
  return control;
}
