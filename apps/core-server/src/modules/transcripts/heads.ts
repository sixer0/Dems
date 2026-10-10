/**
 * The revision heads after a start of the Core (integration pass D11; pass D10's request; C3 §2.3).
 *
 * WHY. `transcript.revision` of a replicated evidence item is a summary no row of the engine's
 * state holds: operation 85 puts it on the item through the engine's fact door
 * (`noteTranscriptRevision`) after its unit committed. A state the engine READ BACK (a process
 * start) therefore carries no revision number until the next revision is made - a client that
 * watches the slice could not tell a revised transcript from an unrevised one.
 *
 * WHAT. One boot step, registered after the engine's (this module registers after the engine):
 * the newest revision number of every item that HAS a revision is read from the tables and handed
 * to the same door, with the state of the sealed document of the item's package. An item without
 * a revision is not touched: its summary is what the state says (this step adds no revision 0).
 *
 * NEVER A REFUSAL OF THE START. The numbers are a summary; operation 84 answers the head from the
 * table at every read. NOTHING IS GUESSED: no document, no state, no call.
 *
 * WHAT IS NORMAL IS SILENT (integration pass E3 item 3). A revision row does not imply a package in
 * this Core's store. These states say nothing, at any level:
 *   - an item WITHOUT a sealed v2 package here by design: a demonstration item (`DEMO_PACKAGE` at
 *     version 1, `SIMULATED`) or a fixture's - its revisions are rows only (the bulk fixture holds
 *     30 of them on SIMULATED items; the simulator's own revisions). `hasSealedPackageHere` of the
 *     verify unit decides, from the item's own facts and never from "the folder is missing";
 *   - a revision of an item the state does not hold;
 *   - an item whose head is on it already.
 * A FAILURE is an item that HAS a package here by its own facts (a REAL seal, a seed-sealed demo
 * item) and whose sealed document cannot be read from it, a row that is no row, or a door that
 * refused. All failures of one start are ONE line in the log and ONE entry in the persistent error
 * log (`TRANSCRIPT_HEAD_NOT_PUBLISHED_AT_BOOT`): their count and at most
 * `HEADS_NAMED_IN_A_FAILURE` evidence IDs. The other items are still done.
 */
import type { FastifyInstance } from 'fastify';
import { factDoorsOf } from '../../engine';
import { hasSealedPackageHere, sessionPackageDir } from '../../evidence-verify';
import { describeError } from '../../plugins/logger';
import { readSealedTranscriptDocument } from '../../sealing';
import { readSealedTranscriptBytes } from '../../transcript-package';
import { READ_REVISION_HEADS, TRANSCRIPT_LABELS_STATES, type TranscriptLabelsStatusValue } from './statements';

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
function headOf(row: Record<string, unknown>): { evidenceId: string; revision: number; jsonSha256: string; labelsStatus: TranscriptLabelsStatusValue | null } | null {
  const { evidence_id: evidenceId, revision, json_sha256: jsonSha256, labels_status: labels } = row;
  const number = Number(revision);
  if (typeof evidenceId !== 'string' || typeof jsonSha256 !== 'string' || !Number.isSafeInteger(number) || number < 1) return null;
  const labelsStatus = TRANSCRIPT_LABELS_STATES.find((state) => state === labels) ?? null;
  if (labels !== null && labelsStatus === null) return null;
  return { evidenceId, revision: number, jsonSha256, labelsStatus };
}

/** Publishes the stored revision heads on the items of the engine's state. Resolves with the number of items it moved; never rejects. */
export async function publishRevisionHeads(app: FastifyInstance): Promise<number> {
  const failed = (code: string, message: string, err: unknown, context: Record<string, string | number | null>): void => {
    app.log.error({ err, code, ...context }, message);
    app.errorLog.append({ level: 'error', source: SOURCE, message, ...(err === null || err === undefined ? {} : describeError(err)), code, context: { step: TRANSCRIPT_HEADS_BOOT_STEP, ...context } });
  };
  let rows: Record<string, unknown>[];
  try {
    // `app.db.read` logs and persists a failed read by its own code; the entry below names this step.
    rows = (await app.db.read(SOURCE, (pool) => pool.query<Record<string, unknown>>(READ_REVISION_HEADS))).rows;
  } catch (err) {
    failed(TRANSCRIPT_HEADS_NOT_READ, 'the revision heads of the sealed transcripts could not be read at the start: an item names its revision after the next one', err, {});
    return 0;
  }
  let moved = 0;
  const notPublished: { evidenceId: string | null; err: unknown }[] = [];
  for (const row of rows) {
    const head = headOf(row);
    const evidenceId = typeof row['evidence_id'] === 'string' ? row['evidence_id'] : null;
    try {
      if (head === null) throw new Error('a row of the revision heads is not one');
      const item = app.engine.slice('evidence').find((candidate) => candidate.id === head.evidenceId);
      // A revision of an item the state does not hold: nothing to put it on (the tables are the truth of operation 84).
      if (item === undefined) continue;
      // NORMAL, AND SILENT: an item that has no sealed v2 package in this Core's store by design (a
      // demonstration or fixture item). Its head is not published and nothing is read for it.
      if (!hasSealedPackageHere(item as Parameters<typeof hasSealedPackageHere>[0])) continue;
      const bytes = await readSealedTranscriptBytes(sessionPackageDir(app.config.mediaStoreDir, item.sessionId), head.jsonSha256);
      const document = bytes === null ? null : readSealedTranscriptDocument(bytes);
      if (document === null) throw new Error('the sealed transcript document of the item is not in its package, or is not the sealed one');
      const outcome = await factDoorsOf(app.engine).noteTranscriptRevision({
        evidenceId: head.evidenceId,
        revision: head.revision,
        state: document.header.state === 'ASSEMBLED' ? 'READY' : 'PARTIAL',
        machineTranscriptHash: head.jsonSha256,
        labelsStatus: head.labelsStatus,
      });
      if (outcome.value) moved += 1;
    } catch (err) {
      notPublished.push({ evidenceId, err });
    }
  }
  // ONE line for every real failure of this start (pass E3 item 3): never a line per item.
  if (notPublished.length > 0) {
    const evidenceIds = notPublished.slice(0, HEADS_NAMED_IN_A_FAILURE).map((entry) => entry.evidenceId ?? 'unknown');
    const message = 'the revision head of one or more items was not published at the start; operation 84 answers the head from the table';
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
  if (moved > 0) app.log.info({ step: TRANSCRIPT_HEADS_BOOT_STEP, items: moved }, 'the stored revision heads were published on their items');
  return moved;
}

/** Registers the boot step. Called once, by the module. */
export function registerRevisionHeadsBootStep(app: FastifyInstance): void {
  app.readiness.addBootStep({
    id: TRANSCRIPT_HEADS_BOOT_STEP,
    async run() {
      await publishRevisionHeads(app);
    },
  });
}
