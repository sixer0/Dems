/**
 * The transcript summaries after a start of the Core (integration pass D11; pass D10's request;
 * C3 §2.3; fix pass F-M6, finding R80-01).
 *
 * WHY. The `transcript` summary of a replicated evidence item (state, failed chunks, the
 * unreachable backend, the revision head) is held by no row of the engine's state: THE SEAL puts
 * it on the item in the unit that commits it, and operation 85 moves its head through the engine's
 * fact door (`noteTranscriptRevision`). A state the engine READ BACK (a process start) therefore
 * carries no summary - and a client that finds none says "Transcript state not reported", never a
 * state it made up.
 *
 * WHAT. One boot step, registered after the engine's (this module registers after the engine): for
 * every item that HAS a sealed v2 package in this Core's store, the transcript block of the
 * manifest the item was sealed with is read from the package (its digest must be the item's
 * `manifestHash`) and its projection - the same function the seal uses - is handed to the door
 * with the newest revision number of the tables (0 when the item has no revision).
 *
 * NEVER A REFUSAL OF THE START. The summary is a label; operation 84 answers the document and the
 * head at every read, operation 41 the verdict. NOTHING IS GUESSED: no manifest, no summary.
 *
 * NOT COVERED: a state the engine rehydrates INSIDE the process (a resync after a failed write)
 * loses the summaries until the next start; the clients then read "not reported".
 *
 * WHAT IS NORMAL IS SILENT (integration pass E3 item 3). These states say nothing, at any level:
 *   - an item WITHOUT a sealed v2 package here by design: a demonstration item (`DEMO_PACKAGE` at
 *     version 1, `SIMULATED`) or a fixture's - its revisions are rows only (the bulk fixture holds
 *     30 of them on SIMULATED items; the simulator's own revisions). `hasSealedPackageHere` of the
 *     verify unit decides, from the item's own facts and never from "the folder is missing";
 *   - a revision of an item the state does not hold;
 *   - an item whose summary and head are on it already.
 * A FAILURE is an item that HAS a package here by its own facts (a REAL seal, a seed-sealed demo
 * item) and whose manifest cannot be read from it or is not the one it was sealed with, a row that
 * is no row, or a door that refused. All failures of one start are ONE line in the log and ONE
 * entry in the persistent error log (`TRANSCRIPT_HEAD_NOT_PUBLISHED_AT_BOOT`): their count and at
 * most `HEADS_NAMED_IN_A_FAILURE` evidence IDs. The other items are still done.
 *
 * BEFORE THE HEADS, THE LIST FILES (closing pass F-X, finding R80-08: THE TABLE IS THE JOURNAL).
 * `reconcileRevisionLists` holds the two list files of every sealed package that has a machine
 * transcript against the stored revisions of its item (`settleRevisionFiles` of the package unit):
 *   - a STAGED list that is the stored chain is renamed over the list (a crash between a commit
 *     and its rename): one `warn` entry;
 *   - any other staged list is removed (an append that never committed: `warn`; not a list of the
 *     item: `error`);
 *   - records the table never recorded are REMOVED from the list: one `error` entry per item;
 *   - a package that is consistent is not written: byte-identical, and silent;
 *   - a stored revision whose record is in NEITHER file cannot be healed (no column stores a
 *     revision's body, and none is made up): ONE `error` entry for all such items of a start
 *     (`TRANSCRIPT_REVISION_RECORD_MISSING`); operation 86 keeps answering 503 for them.
 * Never a refusal of the start, and nothing here reads or writes the sealed transcript itself.
 */
import type { FastifyInstance } from 'fastify';
import { factDoorsOf } from '../../engine';
import { hasSealedPackageHere, sessionPackageDir } from '../../evidence-verify';
import { describeError } from '../../plugins/logger';
import { evidenceTranscriptSummary } from '../../sealing';
import { readSealedManifestTranscript, settleRevisionFiles, type StoredRevisionFacts } from '../../transcript-package';
import { RevisionFilesCode, settlementLines } from './routes';
import { READ_REVISION_CHAINS, READ_REVISION_HEADS } from './statements';

/** The ID of the boot step. */
export const TRANSCRIPT_HEADS_BOOT_STEP = 'transcripts.heads';
/** `source` of this file in a log line and in the persistent error log. */
const SOURCE = 'modules.transcripts.heads';
/** The code of a head that was not published at a start. */
export const TRANSCRIPT_HEAD_NOT_PUBLISHED = 'TRANSCRIPT_HEAD_NOT_PUBLISHED_AT_BOOT';
/** The code of a start whose heads could not be read at all. */
export const TRANSCRIPT_HEADS_NOT_READ = 'TRANSCRIPT_HEADS_NOT_READ_AT_BOOT';

/** How many evidence IDs the one failure line of a start names; the count beside them is always the true one. */
export const HEADS_NAMED_IN_A_FAILURE = 10;

/** One row of `READ_REVISION_HEADS`, read strictly; null for a row that is not one. */
function headOf(row: Record<string, unknown>): { evidenceId: string; revision: number } | null {
  const { evidence_id: evidenceId, revision } = row;
  const number = Number(revision);
  if (typeof evidenceId !== 'string' || !Number.isSafeInteger(number) || number < 1) return null;
  return { evidenceId, revision: number };
}

/**
 * Publishes, on the items of the engine's state, the transcript SUMMARY of every item that has a
 * sealed package here - the projection of the transcript block of its signed manifest (state,
 * failed chunks, the unreachable backend) with the stored revision head. Resolves with the number
 * of items it moved; never rejects.
 */
export async function publishRevisionHeads(app: FastifyInstance): Promise<number> {
  const failed = (code: string, message: string, err: unknown, context: Record<string, string | number | null>): void => {
    app.log.error({ err, code, ...context }, message);
    app.errorLog.append({ level: 'error', source: SOURCE, message, ...(err === null || err === undefined ? {} : describeError(err)), code, context: { step: TRANSCRIPT_HEADS_BOOT_STEP, ...context } });
  };
  const notPublished: { evidenceId: string | null; err: unknown }[] = [];
  /** The newest revision number per item. An item without a row has head 0. */
  const heads = new Map<string, number>();
  let headsRead = true;
  try {
    // `app.db.read` logs and persists a failed read by its own code; the entry below names this step.
    const { rows } = await app.db.read(SOURCE, (pool) => pool.query<Record<string, unknown>>(READ_REVISION_HEADS));
    for (const row of rows) {
      const head = headOf(row);
      if (head === null) notPublished.push({ evidenceId: typeof row['evidence_id'] === 'string' ? row['evidence_id'] : null, err: new Error('a row of the revision heads is not one') });
      else heads.set(head.evidenceId, head.revision);
    }
  } catch (err) {
    headsRead = false;
    failed(TRANSCRIPT_HEADS_NOT_READ, 'the revision heads of the sealed transcripts could not be read at the start: an item names its revision after the next one', err, {});
  }
  let moved = 0;
  for (const item of app.engine.slice('evidence')) {
    // NORMAL, AND SILENT: an item that has no sealed v2 package in this Core's store by design (a
    // demonstration or fixture item). Nothing is published and nothing is read for it.
    if (!hasSealedPackageHere(item as Parameters<typeof hasSealedPackageHere>[0])) continue;
    const head = heads.get(item.id) ?? 0;
    const held = item.transcript ?? null;
    // The item says its summary and that head already (a state this process sealed or already told).
    if (held !== null && held.revision >= head) continue;
    // The heads could not be read: a summary that names head 0 for a revised transcript is not published.
    if (!headsRead && held === null) continue;
    try {
      const block = await readSealedManifestTranscript(sessionPackageDir(app.config.mediaStoreDir, item.sessionId), item.manifestHash);
      if (block === null) throw new Error('the manifest of the item is not in its package, or is not the one the item was sealed with');
      const summary = evidenceTranscriptSummary(block, head);
      if (summary.state !== 'READY' && summary.state !== 'PARTIAL' && summary.state !== 'DISABLED') throw new Error('the sealed manifest states no transcript state of a seal');
      const outcome = await factDoorsOf(app.engine).noteTranscriptRevision({
        evidenceId: item.id,
        revision: head,
        state: summary.state,
        machineTranscriptHash: summary.machineTranscriptHash,
        labelsStatus: summary.labelsStatus,
        ...(summary.failedChunks === undefined ? {} : { failedChunks: summary.failedChunks }),
        ...(summary.backendUnreachable === undefined ? {} : { backendUnreachable: summary.backendUnreachable }),
      });
      if (outcome.value) moved += 1;
    } catch (err) {
      notPublished.push({ evidenceId: item.id, err });
    }
  }
  // ONE line for every real failure of this start (pass E3 item 3): never a line per item.
  if (notPublished.length > 0) {
    const evidenceIds = notPublished.slice(0, HEADS_NAMED_IN_A_FAILURE).map((entry) => entry.evidenceId ?? 'unknown');
    const message = 'the transcript summary of one or more sealed items was not published at the start: their transcript state reads as not reported; operation 84 answers the head from the table';
    app.log.error({ err: notPublished[0]?.err, code: TRANSCRIPT_HEAD_NOT_PUBLISHED, items: notPublished.length, evidenceIds }, message);
    app.errorLog.append({
      level: 'error',
      source: SOURCE,
      message,
      ...describeError(notPublished[0]?.err),
      code: TRANSCRIPT_HEAD_NOT_PUBLISHED,
      context: { step: TRANSCRIPT_HEADS_BOOT_STEP, items: notPublished.length, evidenceIds: evidenceIds.join(',') },
    });
  }
  if (moved > 0) app.log.info({ step: TRANSCRIPT_HEADS_BOOT_STEP, items: moved }, 'the transcript summaries of the sealed items were published on them');
  return moved;
}

/** One row of `READ_REVISION_CHAINS`, read strictly; null for a row that is not one. */
function chainRowOf(row: Record<string, unknown>): ({ evidenceId: string } & StoredRevisionFacts) | null {
  const { evidence_id: evidenceId, revision_no: revisionNo, sha256, signature_value: signatureValue } = row;
  const number = Number(revisionNo);
  if (typeof evidenceId !== 'string' || !Number.isSafeInteger(number) || number < 1 || typeof sha256 !== 'string' || typeof signatureValue !== 'string') return null;
  return { evidenceId, revisionNo: number, sha256, signatureValue };
}

/**
 * Holds the revision list files of every sealed package against the stored revisions (R80-08; the
 * header says the rules). Resolves with the number of packages it changed; never rejects.
 */
export async function reconcileRevisionLists(app: FastifyInstance): Promise<number> {
  const persist = (level: 'error' | 'warn', code: string, message: string, err: unknown, context: Record<string, string | number>): void => {
    app.log[level]({ ...(err === null || err === undefined ? {} : { err }), code, ...context }, message);
    app.errorLog.append({ level, source: SOURCE, message, ...(err === null || err === undefined ? {} : describeError(err)), code, context: { step: TRANSCRIPT_HEADS_BOOT_STEP, ...context } });
  };
  const chains = new Map<string, StoredRevisionFacts[]>();
  /** Items one of whose rows could not be read as a row: their files are judged by nothing, and left alone. */
  const unjudged = new Set<string>();
  try {
    const { rows } = await app.db.read(SOURCE, (pool) => pool.query<Record<string, unknown>>(READ_REVISION_CHAINS));
    for (const row of rows) {
      const read = chainRowOf(row);
      if (read === null) {
        if (typeof row['evidence_id'] === 'string') unjudged.add(row['evidence_id']);
        continue;
      }
      const chain = chains.get(read.evidenceId) ?? [];
      chain.push({ revisionNo: read.revisionNo, sha256: read.sha256, signatureValue: read.signatureValue });
      chains.set(read.evidenceId, chain);
    }
  } catch (err) {
    // Without the table there is no judge: no file is touched.
    persist('error', RevisionFilesCode.NOT_SETTLED, 'the stored transcript revisions could not be read at the start: the revision list files of the sealed packages were not reconciled', err, {});
    return 0;
  }
  let changed = 0;
  const missing: string[] = [];
  const failed: { evidenceId: string; err: unknown }[] = [...unjudged].map((evidenceId) => ({ evidenceId, err: new Error('a row of the stored revisions is not one') }));
  for (const item of app.engine.slice('evidence')) {
    // Only an item that has a sealed v2 package here AND a sealed machine transcript has list files to judge.
    if (!hasSealedPackageHere(item as Parameters<typeof hasSealedPackageHere>[0]) || typeof item.transcriptSha256 !== 'string' || unjudged.has(item.id)) continue;
    const rows = chains.get(item.id) ?? [];
    try {
      const settlement = await settleRevisionFiles(sessionPackageDir(app.config.mediaStoreDir, item.sessionId), { evidenceId: item.id, machineTranscriptSha256: item.transcriptSha256 }, rows);
      const lines = settlementLines(settlement);
      for (const line of lines) persist(line.level, line.code, line.message, null, { evidenceId: item.id, ...line.context });
      if (lines.length > 0) changed += 1;
      // A list that lacks a STORED row. An item without a revision has nothing the table could miss.
      if (settlement.records === null && rows.length > 0) missing.push(item.id);
    } catch (err) {
      failed.push({ evidenceId: item.id, err });
    }
  }
  if (missing.length > 0) {
    persist('error', RevisionFilesCode.RECORD_MISSING, 'a stored transcript revision has no record in its package and no staged list holds it: it cannot be restored (no body is stored, none is made up); operation 86 answers 503 for the item', null, {
      items: missing.length,
      evidenceIds: missing.slice(0, HEADS_NAMED_IN_A_FAILURE).join(','),
    });
  }
  if (failed.length > 0) {
    persist('error', RevisionFilesCode.NOT_SETTLED, 'the revision list files of one or more sealed packages could not be reconciled with the stored revisions at the start', failed[0]?.err, {
      items: failed.length,
      evidenceIds: failed.slice(0, HEADS_NAMED_IN_A_FAILURE).map((entry) => entry.evidenceId).join(','),
    });
  }
  return changed;
}

/** Registers the boot step. Called once, by the module. */
export function registerRevisionHeadsBootStep(app: FastifyInstance): void {
  app.readiness.addBootStep({
    id: TRANSCRIPT_HEADS_BOOT_STEP,
    async run() {
      // The files first (R80-08): the heads below are the table's, and the list of a package is then the table's too.
      await reconcileRevisionLists(app);
      await publishRevisionHeads(app);
    },
  });
}
