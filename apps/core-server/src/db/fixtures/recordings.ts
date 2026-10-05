/**
 * The recording part of the bulk fixture (plan row W25; database contract §4.15 to §4.20, §11):
 * finished sessions, their evidence items with tracks and custody, what was done with the
 * evidence afterwards (review, export, verification, archive), and the variant with one session
 * still recording.
 *
 * ONE MAPPING (MR-1). Every entity is built in the SHARED shape with the shared builders
 * (`sessionIdFor`, `evidenceIdFor`, `caseNumberFor`, `recordingBytes`, `createEvidenceItem`,
 * `tamperEvidenceItem`, `verifyEvidenceItem`) and becomes a row through the row builders of the
 * mapping module. Nothing here names a column twice.
 *
 * WHEN. One Core, one room: recordings never overlap. They fill office hours of the 60 WIB days
 * before the seeded dataset's own three, eight or nine a day. A recording lasts 3 to 15 minutes,
 * so that the whole fixture stays below the evidence volume's used space; one long recording of
 * 55 minutes carries the integrity stream that gives one session more than 200 audit rows.
 *
 * No fixture item joins a frozen demo evidence package (the join needs the package's subject
 * name), so every item has synthetic hashes: `integrity_source` is `SIMULATED`, an untouched item
 * verifies and a tampered one fails on exactly its altered track.
 *
 * THE DETAILS OF AN AUDIT ROW are the shared simulator's for that type (decisions D91, D93):
 * these rows are what the engine writes in Live mode. `__tests__/audit-details.test.ts` drives
 * the simulator and compares the keys of every row with the ones it writes. The same holds for
 * the severity of a row and for the severity and the parameters of an event (decision D103).
 */
import type { TimeSource } from '@dems/shared/domain';
import {
  DEFAULT_EXPORT_DESTINATION,
  EVIDENCE_STATUS_STAGE,
  EvidenceStatus,
  FaultKind,
  HISTORY_SEAL_DELAY_MS,
  OperatorRole,
  RecordingProfileId,
  ScenarioName,
  SessionOutcome,
  SubjectType,
  TRACK_ORDER,
  buildScenarioState,
  caseNumberFor,
  createEvidenceItem,
  createIdleState,
  evidenceIdFor,
  recordingBytes,
  sessionIdFor,
  tamperEvidenceItem,
  verifyEvidenceItem,
  type ActiveSession,
  type CustodyEntry,
  type EvidenceItem,
  type EvidenceMarker,
  type SessionHistoryEntry,
  type SessionNote,
  type TimelineEvent,
} from '@dems/shared/sim';
import { activeSessionToRow, evidenceCustodyToRows, evidenceItemToRow, evidenceTracksToRows, sessionHistoryToRow } from '../mapping';
import type { ActiveSessionRow, EvidenceCustodyRow, EvidenceItemRow, EvidenceTrackRow, SessionHistoryRow } from '../schema';
import type { OperatorDirectory } from './identity';
import { BULK_MIX, minimumOf } from './minimums';
import type { FixtureRng } from './rng';
import { DAY_MS, FIXTURE_WORLD_DAYS, FRAME_HASH_STREAM, HOUR_MS, MINUTE_MS, SECOND_MS, SEEDED_DATASET_DAYS, UNICODE_SAMPLE, padded, type World } from './world';

/** A finished recording, for the parts that add rows about it. */
export interface RecordingPlan {
  readonly sessionId: string;
  readonly evidenceId: string | null;
  readonly investigatorId: string;
  readonly startedAt: number;
  readonly endedAt: number;
  readonly sealed: boolean;
}

export interface RecordingRows {
  readonly recordings: readonly RecordingPlan[];
  readonly sessionHistory: SessionHistoryRow[];
  readonly evidenceItems: EvidenceItemRow[];
  readonly evidenceTracks: EvidenceTrackRow[];
  readonly evidenceCustody: EvidenceCustodyRow[];
  readonly activeSession: ActiveSessionRow[];
}

type Kind = 'SEALED' | 'EXPORTED' | 'ARCHIVED' | 'UNDER_REVIEW' | 'RECORDED' | 'NOT_STARTED';

/** An evidence item while the fixture still adds custody entries to it. */
interface ItemDraft {
  item: EvidenceItem;
  readonly kind: Kind;
  /** `created_at` of the row: when the item was sealed, or the session was closed as incomplete. */
  readonly writtenAt: number;
  readonly long: boolean;
}

const need = (minimum: number, have: number): number => Math.max(0, minimum - have);

/** Faults that end a session as INCOMPLETE. */
const SESSION_ENDING_FAULTS = [FaultKind.POWER_FAIL, FaultKind.STORAGE_FULL, FaultKind.TPM_FAILURE, FaultKind.SECURITY_FAULT, FaultKind.CAMERA_LOSS] as const;
const SUBJECT_TYPES = [SubjectType.TERSANGKA, SubjectType.SAKSI, SubjectType.LAINNYA] as const;
const STOP_REASONS = ['Examination concluded', 'Break requested by the subject', 'Counsel requested a pause', 'Examination adjourned'] as const;
/** How long the long recording lasts, and what its integrity stream holds. */
const LONG_RECORDING_MS = 55 * MINUTE_MS;
const LONG_STREAM = { frameHash: 100, writeVerified: 60, timestampConfirmed: 40, markers: 20, notes: 12, snapshots: 8 } as const;
/** Items whose stored media was altered after sealing, and how many of them were verified since. */
const EXTRA_TAMPERED = 2;
const TAMPERED_VERIFIED = 8;
/** Custody rows above the contract's minimum, so that the count does not sit on the edge. */
const CUSTODY_MARGIN = 20;

function timeSource(rng: FixtureRng): TimeSource {
  const draw = rng.next();
  return draw < 0.85 ? 'GNSS' : draw < 0.97 ? 'NTP' : 'RTC';
}

export function buildRecordings(world: World, directory: OperatorDirectory): RecordingRows {
  const { now, base } = world;
  const rng = world.rng('recordings');
  const frames = world.rng(FRAME_HASH_STREAM);
  const baseHistory = base.slices.sessionHistory;
  const baseEvidence = base.slices.evidence;
  const have = (status: EvidenceStatus): number => baseEvidence.filter((item) => item.status === status).length;

  // How many of each kind the contract's minimums ask for, above what the seed holds.
  const mix = BULK_MIX.evidenceItems;
  const exported = need(mix.exported, have(EvidenceStatus.EXPORTED));
  const archived = need(mix.archived, have(EvidenceStatus.ARCHIVED));
  const underReview = need(mix.underReview, have(EvidenceStatus.UNDER_REVIEW));
  const recorded = need(mix.recorded, have(EvidenceStatus.RECORDED));
  const notStarted = need(BULK_MIX.sessionHistory.withoutEvidence, baseHistory.filter((entry) => entry.evidenceId === null).length);
  const incomplete = Math.max(need(BULK_MIX.sessionHistory.incomplete, baseHistory.filter((entry) => entry.outcome === SessionOutcome.INCOMPLETE).length), recorded + notStarted);
  const recordedSessions = incomplete - notStarted;
  const sealedSessions = Math.max(
    need(BULK_MIX.sessionHistory.sealed, baseHistory.filter((entry) => entry.outcome === SessionOutcome.SEALED).length),
    need(minimumOf('session_history'), baseHistory.length) - incomplete,
    need(minimumOf('evidence_items'), baseEvidence.length) - recordedSessions,
    exported + archived + underReview + need(mix.sealed, have(EvidenceStatus.SEALED)),
  );
  const kinds: Kind[] = rng.shuffle([
    ...Array.from({ length: exported }, (): Kind => 'EXPORTED'),
    ...Array.from({ length: archived }, (): Kind => 'ARCHIVED'),
    ...Array.from({ length: underReview }, (): Kind => 'UNDER_REVIEW'),
    ...Array.from({ length: sealedSessions - exported - archived - underReview }, (): Kind => 'SEALED'),
    ...Array.from({ length: recordedSessions }, (): Kind => 'RECORDED'),
    ...Array.from({ length: notStarted }, (): Kind => 'NOT_STARTED'),
  ]);
  // The long recording: the first plainly sealed one in the second half of the history.
  const longIndex = kinds.findIndex((kind, index) => kind === 'SEALED' && index >= Math.floor(kinds.length / 2));

  const days = FIXTURE_WORLD_DAYS - SEEDED_DATASET_DAYS + 1;
  const room = base.slices.device.room;
  const deviceId = base.slices.device.id;
  const history: SessionHistoryEntry[] = [];
  const drafts: ItemDraft[] = [];
  const recordings: RecordingPlan[] = [];
  const openCases: string[] = [];

  /** A later instant: `from` plus a draw, but an hour before `now` at the latest. */
  const later = (from: number, minimum: number, maximum: number): number => Math.max(from, Math.min(now - HOUR_MS, from + rng.int(minimum, maximum)));

  let index = 0;
  let exports = 0;
  for (let day = 0; day < days; day += 1) {
    const daysAgo = FIXTURE_WORLD_DAYS - day;
    const today = Math.floor(((day + 1) * kinds.length) / days) - Math.floor((day * kinds.length) / days);
    const slot = Math.floor((12 * HOUR_MS) / Math.max(1, today));
    for (let position = 0; position < today; position += 1, index += 1) {
      const kind = kinds[index] ?? 'SEALED';
      const long = index === longIndex;
      const createdAt = world.dayAt(daysAgo, 7) + position * slot + rng.int(0, 10 * 60) * SECOND_MS;
      const startedAt = createdAt + 90 * SECOND_MS;
      const durationMs = long ? LONG_RECORDING_MS : rng.int(3 * 60, 15 * 60) * SECOND_MS;
      const endedAt = startedAt + durationMs;
      const sessionNumber = world.counters.session;
      world.counters.session += 1;
      const sessionId = sessionIdFor(sessionNumber, createdAt);
      const investigator = rng.pick(directory.candidates(createdAt, endedAt + MINUTE_MS, OperatorRole.INVESTIGATOR)).operator.id;
      // Three sessions in four open a new case; the others continue a recent one.
      let caseNumber: string;
      if (openCases.length === 0 || rng.chance(0.72)) {
        caseNumber = caseNumberFor(world.counters.caseNumber, createdAt);
        world.counters.caseNumber += 1;
        openCases.push(caseNumber);
        if (openCases.length > 30) openCases.shift();
      } else {
        caseNumber = rng.pick(openCases);
      }
      const label = padded(sessionNumber, 4);
      const subjectName = index % 37 === 11 ? `Fixture Subject ${label} (${UNICODE_SAMPLE})` : `Fixture Subject ${label}`;
      const subjectType = rng.pick(SUBJECT_TYPES);
      const sessionRoom = index % 41 === 7 ? `${room} · 取調室` : room;
      const startSource = timeSource(rng);
      const endSource = rng.chance(0.9) ? startSource : timeSource(rng);
      const common = { caseNumber, subjectName, subjectType, investigatorId: investigator, room: sessionRoom, profileId: RecordingProfileId.STANDARD_1080P25 };

      world.record(createdAt, {
        audit: { type: 'SESSION_CREATED', message: `Session ${sessionId} created`, actorId: investigator, sessionId, details: { caseNumber } },
        event: { type: 'SESSION_CREATED', message: `Session ${sessionId} created`, sessionId },
      });
      // One session in six also carries the events of the steps in between, for the spread of event types.
      const detailed = index % 6 === 0;
      if (detailed) world.record(createdAt + 20 * SECOND_MS, { event: { type: 'PRECHECK_STARTED', message: 'Pre-recording checks started', sessionId } });
      world.record(startedAt - 30 * SECOND_MS, {
        audit: { type: 'PRECHECK_PASSED', message: 'Pre-recording checks passed', actorId: investigator, sessionId },
        ...(detailed ? { event: { type: 'PRECHECK_PASSED', message: 'Pre-recording checks passed', severity: 'SUCCESS', sessionId } as const } : {}),
      });

      if (kind === 'NOT_STARTED') {
        // A fault before the recording started: the session is closed as INCOMPLETE, with no evidence.
        const faultKind = rng.pick(SESSION_ENDING_FAULTS);
        const faultAt = startedAt - 10 * SECOND_MS;
        const closedAt = faultAt + 63 * SECOND_MS;
        world.record(faultAt, {
          audit: {
            type: 'FAULT_RAISED',
            message: `Fault ${faultKind} raised before the recording started`,
            severity: 'CRITICAL',
            sessionId,
            deviceId,
            details: { kind: faultKind, fromState: 'ARMED' },
          },
          event: { type: 'FAULT_RAISED', message: `Fault ${faultKind} — session stopped`, severity: 'CRITICAL', sessionId, params: { kind: faultKind } },
        });
        world.record(faultAt + MINUTE_MS, {
          audit: { type: 'RECOVERY_STARTED', message: 'Recovery scan started', sessionId },
          event: { type: 'RECOVERY_STARTED', message: 'Recovery scan started', severity: 'WARNING', sessionId },
        });
        world.record(closedAt, {
          audit: { type: 'SESSION_INCOMPLETE', message: `Session ${sessionId} marked INCOMPLETE (never recorded)`, severity: 'WARNING', sessionId },
          event: { type: 'SESSION_INCOMPLETE', message: `Session ${sessionId} closed as INCOMPLETE`, severity: 'WARNING', sessionId },
        });
        world.record(closedAt + SECOND_MS, {
          audit: { type: 'RECOVERY_COMPLETED', message: 'Recovery completed', sessionId },
          event: { type: 'RECOVERY_COMPLETED', message: 'Recovery completed', sessionId },
        });
        history.push({
          id: sessionId,
          outcome: SessionOutcome.INCOMPLETE,
          ...common,
          createdAt,
          startedAt: null,
          endedAt: closedAt,
          durationMs: 0,
          sizeBytes: 0,
          evidenceId: null,
          faultKind,
          startTimeSource: null,
          endTimeSource: null,
        });
        continue;
      }

      const evidenceNumber = world.counters.evidence;
      world.counters.evidence += 1;
      const evidenceId = evidenceIdFor(evidenceNumber, createdAt);
      const sizeBytes = recordingBytes(durationMs);
      const incompleteSession = kind === 'RECORDED';
      const sealedAt = incompleteSession ? null : endedAt + HISTORY_SEAL_DELAY_MS;
      const faultKind = incompleteSession ? rng.pick(SESSION_ENDING_FAULTS) : null;

      world.record(startedAt, {
        audit: { type: 'RECORDING_STARTED', message: `Recording started (${sessionId})`, actorId: investigator, sessionId },
        event: { type: 'RECORDING_STARTED', message: `Recording started · ${sessionId}`, severity: 'SUCCESS', sessionId },
      });

      // Markers and notes: on the long recording, and on one recording in nine.
      const markers: EvidenceMarker[] = [];
      const notes: SessionNote[] = [];
      const markerCount = long ? LONG_STREAM.markers : index % 9 === 4 ? rng.int(1, 3) : 0;
      const noteCount = long ? LONG_STREAM.notes : index % 9 === 4 ? rng.int(0, 2) : 0;
      for (let marker = 1; marker <= markerCount; marker += 1) {
        const at = startedAt + Math.floor((durationMs * marker) / (markerCount + 1));
        const text = marker === 1 && (long || index % 2 === 0) ? `Key statement (${UNICODE_SAMPLE})` : `Fixture marker ${marker}`;
        markers.push({ id: world.nextItem('TL'), at, index: marker, label: text });
        world.record(at, {
          audit: { type: 'MARKER_ADDED', message: long ? `Marker ${marker} added: ${text}` : `Marker ${marker} added`, actorId: investigator, sessionId, details: { label: text, index: marker } },
          event: { type: 'MARKER_ADDED', message: `Marker ${marker} added`, sessionId },
        });
      }
      for (let note = 1; note <= noteCount; note += 1) {
        const at = startedAt + Math.floor((durationMs * (2 * note - 1)) / (2 * noteCount + 1));
        const text = note === 1 ? `Fixture note ${label}-${note}: rights read and confirmed (${UNICODE_SAMPLE})` : `Fixture note ${label}-${note}`;
        const noteId = world.nextItem('NOTE');
        notes.push({ id: noteId, at, authorId: investigator, text });
        world.record(at, {
          audit: { type: 'NOTE_ADDED', message: 'Investigator note added', actorId: investigator, sessionId, details: { noteId, length: text.length } },
          event: { type: 'NOTE_ADDED', message: 'Investigator note added', sessionId },
        });
      }
      if (long) {
        const stream = (count: number, record: (at: number, number: number) => void, phase: number): void => {
          for (let number = 1; number <= count; number += 1) record(startedAt + Math.floor((durationMs * (number - phase)) / count), number);
        };
        stream(
          LONG_STREAM.frameHash,
          (at, number) =>
            world.record(at, {
              audit: {
                type: 'FRAME_HASH',
                message: `Frame hash recorded · segment ${number}`,
                sessionId,
                evidenceId,
                details: { trackId: number % 2 === 0 ? 'VIDEO-01' : 'VIDEO-02', segment: number, sha256: frames.hex(64) },
              },
            }),
          0.5,
        );
        stream(
          LONG_STREAM.writeVerified,
          (at) =>
            world.record(at, {
              audit: {
                type: 'WRITE_VERIFIED',
                message: 'Storage write verified',
                sessionId,
                deviceId: 'HDD-EVIDENCE',
                details: { bytesWritten: recordingBytes(at - startedAt), volume: 'HDD-EVIDENCE' },
              },
            }),
          0.3,
        );
        stream(
          LONG_STREAM.timestampConfirmed,
          (at) =>
            world.record(at, {
              audit: { type: 'TIMESTAMP_CONFIRMED', message: `Secure timestamp confirmed · ${startSource}`, sessionId, details: { source: startSource, offsetMs: 3 } },
            }),
          0.7,
        );
        stream(
          LONG_STREAM.snapshots,
          (at, number) =>
            world.record(at, {
              audit: { type: 'SNAPSHOT_TAKEN', message: `Snapshot ${number} taken`, actorId: investigator, sessionId, details: { index: number, cameraId: 'VIDEO-01' } },
              event: { type: 'SNAPSHOT_TAKEN', message: `Snapshot ${number} taken`, sessionId },
            }),
          0.4,
        );
      }

      const custody: CustodyEntry[] = [{ at: startedAt, action: 'RECORDING_STARTED', actorId: investigator, detail: null }];
      if (incompleteSession) {
        custody.push({ at: endedAt, action: 'SESSION_INCOMPLETE', actorId: null, detail: `${faultKind ?? 'FAULT'}; recovered` });
        world.record(endedAt, {
          audit: {
            type: 'FAULT_RAISED',
            message: `Fault ${faultKind ?? 'FAULT'} raised during the recording`,
            severity: 'CRITICAL',
            sessionId,
            deviceId,
            details: { kind: faultKind, fromState: 'RECORDING' },
          },
          event: { type: 'FAULT_RAISED', message: `Fault ${faultKind ?? 'FAULT'} — recovery marker written`, severity: 'CRITICAL', sessionId, params: { kind: faultKind } },
        });
        world.record(endedAt + MINUTE_MS, {
          audit: { type: 'RECOVERY_STARTED', message: 'Recovery scan started', sessionId },
          event: { type: 'RECOVERY_STARTED', message: 'Recovery scan started', severity: 'WARNING', sessionId },
        });
        world.record(endedAt + 63 * SECOND_MS, {
          audit: { type: 'SESSION_INCOMPLETE', message: `Session ${sessionId} marked INCOMPLETE (never sealed)`, severity: 'WARNING', sessionId, evidenceId },
          event: { type: 'SESSION_INCOMPLETE', message: `Session ${sessionId} recovered as INCOMPLETE`, severity: 'WARNING', sessionId },
        });
        world.record(endedAt + 64 * SECOND_MS, {
          audit: { type: 'RECOVERY_COMPLETED', message: 'Recovery completed', sessionId },
          event: { type: 'RECOVERY_COMPLETED', message: 'Recovery completed', sessionId },
        });
      } else {
        custody.push({ at: sealedAt ?? endedAt, action: 'SEALED', actorId: null, detail: null });
      }

      let item = createEvidenceItem({
        evidenceId,
        sessionId,
        caseNumber,
        recordedAt: startedAt,
        endedAt,
        sizeBytes,
        subjectName,
        subjectType,
        investigatorId: investigator,
        room: sessionRoom,
        profileId: RecordingProfileId.STANDARD_1080P25,
        sealedAt,
        // Review, export and archive move the status later, as the server's commands do.
        status: incompleteSession ? EvidenceStatus.RECORDED : EvidenceStatus.SEALED,
        custody,
        markers,
        notes,
        startTimeSource: startSource,
        endTimeSource: endSource,
      });

      if (!incompleteSession && sealedAt !== null) {
        world.record(endedAt, {
          audit: { type: 'RECORDING_STOPPED', message: `Recording stopped (${sessionId})`, actorId: investigator, sessionId, details: { reason: rng.pick(STOP_REASONS) } },
          ...(detailed ? { event: { type: 'RECORDING_STOPPED', message: `Recording stopped · ${sessionId}`, sessionId, params: { sessionId, durationMs } } as const } : {}),
        });
        if (detailed) world.record(endedAt + SECOND_MS, { event: { type: 'FINALIZATION_STARTED', message: `Finalization started · ${sessionId}`, sessionId, params: { evidenceId } } });
        world.record(sealedAt, {
          audit: { type: 'EVIDENCE_SEALED', message: `Evidence ${evidenceId} sealed`, sessionId, evidenceId, details: { manifestHash: item.manifestHash } },
          event: { type: 'EVIDENCE_SEALED', message: `Evidence sealed · ${evidenceId}`, severity: 'SUCCESS', sessionId, params: { evidenceId } },
        });
        if (index % 10 === 3) {
          world.record(sealedAt + 30 * SECOND_MS, {
            audit: { type: 'SUMMARY_ACKNOWLEDGED', message: `Summary of ${sessionId} acknowledged`, actorId: investigator, sessionId, evidenceId },
          });
        }

        // What was done with the sealed item afterwards, by a supervisor.
        let last = sealedAt;
        const supervisor = (at: number): string => rng.pick(directory.candidates(at, at, OperatorRole.SUPERVISOR)).operator.id;
        const review = (): void => {
          last = later(last, HOUR_MS, 48 * HOUR_MS);
          const actor = supervisor(last);
          item = { ...item, status: EvidenceStatus.UNDER_REVIEW, lifecycleStage: EVIDENCE_STATUS_STAGE.UNDER_REVIEW, custody: [...item.custody, { at: last, action: 'REVIEW_OPENED', actorId: actor, detail: null }] };
          world.record(last, {
            audit: { type: 'EVIDENCE_REVIEW_OPENED', message: `Review opened for ${evidenceId}`, actorId: actor, evidenceId },
            event: { type: 'EVIDENCE_REVIEW', message: `Evidence under review · ${evidenceId}`, params: { evidenceId } },
          });
        };
        if (kind === 'UNDER_REVIEW' || (kind === 'EXPORTED' && index % 4 === 0)) review();
        if (kind === 'EXPORTED') {
          last = later(last, 2 * HOUR_MS, 60 * HOUR_MS);
          const at = last;
          const actor = supervisor(at);
          // The first export, and every fifth after it, carries text outside ASCII.
          const unicode = exports % 5 === 0;
          exports += 1;
          const destination = unicode ? `Fixture destination ${label} (${UNICODE_SAMPLE})` : DEFAULT_EXPORT_DESTINATION;
          const reason = unicode ? `Fixture reason: prosecutor request ${label} (${UNICODE_SAMPLE})` : `Fixture reason: prosecutor request ${label}`;
          item = { ...item, status: EvidenceStatus.EXPORTED, lifecycleStage: EVIDENCE_STATUS_STAGE.EXPORTED, custody: [...item.custody, { at, action: 'EXPORTED', actorId: actor, detail: destination }] };
          world.deferExport(at, (exportId) =>
            world.record(at, {
              audit: {
                type: 'EVIDENCE_EXPORTED',
                message: `Evidence ${evidenceId} exported`,
                actorId: actor,
                evidenceId,
                details: { exportId, destination, reason, eventKind: 'EXPORT' },
              },
              event: { type: 'EVIDENCE_EXPORTED', message: `Evidence exported · ${evidenceId}`, severity: 'SUCCESS', params: { evidenceId, exportId } },
            }),
          );
        }
        if (kind === 'ARCHIVED') {
          last = later(last, 5 * DAY_MS, 20 * DAY_MS);
          const actor = supervisor(last);
          item = { ...item, status: EvidenceStatus.ARCHIVED, lifecycleStage: EVIDENCE_STATUS_STAGE.ARCHIVED, custody: [...item.custody, { at: last, action: 'ARCHIVED', actorId: actor, detail: null }] };
          world.record(last, {
            audit: { type: 'EVIDENCE_ARCHIVED', message: `Evidence ${evidenceId} archived`, actorId: actor, evidenceId, details: { retentionPolicy: base.slices.storagePolicy.retentionPolicy } },
            event: { type: 'EVIDENCE_ARCHIVED', message: `Evidence archived · ${evidenceId}`, params: { evidenceId } },
          });
        }
      }

      drafts.push({ item, kind, writtenAt: sealedAt ?? endedAt + 63 * SECOND_MS, long });
      recordings.push({ sessionId, evidenceId, investigatorId: investigator, startedAt, endedAt, sealed: !incompleteSession });
      history.push({
        id: sessionId,
        outcome: incompleteSession ? SessionOutcome.INCOMPLETE : SessionOutcome.SEALED,
        ...common,
        createdAt,
        startedAt,
        endedAt,
        durationMs,
        sizeBytes,
        evidenceId,
        faultKind,
        startTimeSource: startSource,
        endTimeSource: endSource,
      });
    }
  }

  // ── Tamper and verification ──────────────────────────────────────────────────────────────────
  const verifyRng = world.rng('verification');
  /** Verifies `draft` after its last custody entry, with the shared check, and records the result. */
  const verify = (draft: ItemDraft): void => {
    const lastEntry = draft.item.custody[draft.item.custody.length - 1];
    const at = Math.max(lastEntry?.at ?? 0, Math.min(now - HOUR_MS, (lastEntry?.at ?? 0) + verifyRng.int(10 * MINUTE_MS, 30 * HOUR_MS)));
    const actor = verifyRng.pick(directory.candidates(at, at)).operator.id;
    const result = verifyEvidenceItem(draft.item, at);
    const failed = result.tracks.filter((track) => !track.ok).map((track) => track.trackId);
    const evidenceId = draft.item.id;
    draft.item = {
      ...draft.item,
      verification: { status: result.ok ? 'PASS' : 'FAIL', at },
      custody: [...draft.item.custody, { at, action: result.ok ? 'VERIFIED' : 'VERIFY_FAILED', actorId: actor, detail: result.ok ? null : `Mismatch: ${failed.join(', ')}` }],
    };
    world.record(at, {
      audit: {
        type: result.ok ? 'EVIDENCE_VERIFIED' : 'EVIDENCE_VERIFY_FAILED',
        message: result.ok ? `Evidence ${evidenceId} verified: every hash matches` : `Evidence ${evidenceId} failed verification (${failed.join(', ')})`,
        severity: result.ok ? 'INFO' : 'CRITICAL',
        actorId: actor,
        evidenceId,
        details: { manifestOk: result.manifestOk, signatureOk: result.signatureOk, failedTracks: failed.join(','), ...(result.ok ? {} : { eventKind: 'TAMPER' }) },
      },
      event: {
        type: result.ok ? 'EVIDENCE_VERIFIED' : 'EVIDENCE_VERIFY_FAILED',
        message: result.ok ? `Evidence verified · ${evidenceId}` : `Integrity check FAILED · ${evidenceId}`,
        severity: result.ok ? 'SUCCESS' : 'CRITICAL',
        params: { evidenceId, failedTracks: failed.join(',') },
      },
    });
  };

  const plainlySealed = drafts.filter((draft) => draft.kind === 'SEALED' && !draft.long);
  const tamperedWanted = need(mix.tampered, baseEvidence.filter((item) => item.tampered).length) + EXTRA_TAMPERED;
  const stride = Math.max(1, Math.floor(plainlySealed.length / Math.max(1, tamperedWanted)));
  const tampered = plainlySealed.filter((_, position) => position % stride === 0).slice(0, tamperedWanted);
  tampered.forEach((draft, position) => {
    draft.item = tamperEvidenceItem(draft.item, TRACK_ORDER[position % TRACK_ORDER.length]);
    if (position < TAMPERED_VERIFIED) verify(draft);
  });

  // Verifications that pass, until the custody table is above its minimum.
  const custodySoFar = drafts.reduce((count, draft) => count + draft.item.custody.length, 0);
  const passing = need(minimumOf('evidence_custody'), (base.counts['evidence_custody'] ?? 0) + custodySoFar) + CUSTODY_MARGIN;
  drafts
    .filter((draft) => !draft.item.tampered && draft.kind !== 'RECORDED')
    .filter((_, position) => position % 3 === 1)
    .slice(0, passing)
    .forEach(verify);

  const context = { seededAt: base.seededAt, lastResetAt: null };
  const evidenceItems: EvidenceItemRow[] = drafts.map((draft) => {
    const lastEntry = draft.item.custody[draft.item.custody.length - 1];
    return { ...evidenceItemToRow(draft.item, { ...context, at: draft.writtenAt }), updatedAt: Math.max(draft.writtenAt, lastEntry?.at ?? 0) };
  });

  return {
    recordings,
    sessionHistory: history.map(sessionHistoryToRow),
    evidenceItems,
    evidenceTracks: drafts.flatMap((draft) => evidenceTracksToRows(draft.item)),
    evidenceCustody: drafts.flatMap((draft) => evidenceCustodyToRows(draft.item)),
    activeSession: [],
  };
}

/** The kinds of the timeline items of the recording session, in a cycle of ten. */
const TIMELINE_CYCLE = ['AUTOSAVE', 'CHECK', 'AUTOSAVE', 'HEALTH', 'AUDIO_PEAK', 'AUTOSAVE', 'MARKER', 'CHECK', 'NOTE', 'SNAPSHOT'] as const;

/**
 * The variant of the contract's table: one session in RECORDING with a full 200-item timeline,
 * the largest row the schema holds. The session is the shared `recording` scenario's own (its
 * precheck, its input, its times), with the next free session number and a timeline of 200 items.
 */
export function buildActiveSession(world: World): ActiveSessionRow[] {
  const { now, base } = world;
  const scenario = buildScenarioState(ScenarioName.RECORDING, createIdleState({ now, seed: base.slices.meta.seed }));
  const shared: ActiveSession | null = scenario.session;
  if (shared === null || shared.startedAt === null) throw new RangeError('the shared recording scenario has no recording session.');
  const startedAt = shared.startedAt;
  const number = world.counters.session;
  world.counters.session += 1;
  const sessionId = sessionIdFor(number, shared.createdAt);
  const actor = shared.input.investigatorId;
  const items = BULK_MIX.activeSessionVariant.timelineItems;

  const timeline: TimelineEvent[] = [
    { id: world.nextItem('TL'), at: startedAt, kind: 'START', label: 'Recording started', detail: null, channel: null, params: { sessionId } },
  ];
  const notes: SessionNote[] = [];
  let markerCount = 0;
  let snapshotCount = 0;
  for (let position = 1; position < items; position += 1) {
    const at = startedAt + Math.floor(((now - startedAt) * position) / items);
    const kind = TIMELINE_CYCLE[position % TIMELINE_CYCLE.length] ?? 'AUTOSAVE';
    if (kind === 'MARKER') {
      markerCount += 1;
      const label = markerCount === 1 ? `Key statement (${UNICODE_SAMPLE})` : `Fixture marker ${markerCount}`;
      timeline.push({ id: world.nextItem('TL'), at, kind, label, detail: null, channel: null, params: { index: markerCount, label } });
      world.record(at, {
        audit: { type: 'MARKER_ADDED', message: `Marker ${markerCount} added`, actorId: actor, sessionId, details: { label, index: markerCount } },
        event: { type: 'MARKER_ADDED', message: `Marker ${markerCount} added`, sessionId },
      });
    } else if (kind === 'NOTE') {
      const noteId = world.nextItem('NOTE');
      const text = `Fixture note ${notes.length + 1} of the recording session`;
      notes.push({ id: noteId, at, authorId: actor, text });
      timeline.push({ id: world.nextItem('TL'), at, kind, label: 'Investigator note', detail: text, channel: null, params: { noteId, length: text.length } });
      world.record(at, {
        audit: { type: 'NOTE_ADDED', message: 'Investigator note added', actorId: actor, sessionId, details: { noteId, length: text.length } },
        event: { type: 'NOTE_ADDED', message: 'Investigator note added', sessionId },
      });
    } else if (kind === 'SNAPSHOT') {
      snapshotCount += 1;
      timeline.push({ id: world.nextItem('TL'), at, kind, label: `Snapshot ${snapshotCount}`, detail: 'VIDEO-01', channel: null, params: { index: snapshotCount, cameraId: 'VIDEO-01' } });
      world.record(at, {
        audit: { type: 'SNAPSHOT_TAKEN', message: `Snapshot ${snapshotCount} taken`, actorId: actor, sessionId, details: { index: snapshotCount, cameraId: 'VIDEO-01' } },
        event: { type: 'SNAPSHOT_TAKEN', message: `Snapshot ${snapshotCount} taken`, sessionId },
      });
    } else if (kind === 'AUDIO_PEAK') {
      timeline.push({ id: world.nextItem('TL'), at, kind, label: 'Audio peak -3.1 dBFS', detail: 'MIC 2', channel: 'AUDIO-02', params: { dbfs: -3.1, track: 'AUDIO-02' } });
    } else if (kind === 'AUTOSAVE') {
      const segment = Math.floor(position / 3) + 1;
      timeline.push({ id: world.nextItem('TL'), at, kind, label: `Autosave · segment ${segment}`, detail: null, channel: null, params: { segment, bytesWritten: recordingBytes(at - startedAt) } });
    } else if (kind === 'CHECK') {
      timeline.push({ id: world.nextItem('TL'), at, kind, label: 'Integrity check passed', detail: 'Hash chain · GNSS', channel: null, params: { source: 'GNSS' } });
    } else {
      timeline.push({ id: world.nextItem('TL'), at, kind, label: 'Health check OK', detail: null, channel: null, params: {} });
    }
  }

  const session: ActiveSession = {
    ...shared,
    id: sessionId,
    timeline,
    notes,
    markerCount,
    snapshotCount,
    bytesWritten: recordingBytes(now - startedAt),
    evidenceId: null,
  };
  world.record(shared.createdAt, {
    audit: { type: 'SESSION_CREATED', message: `Session ${sessionId} created`, actorId: actor, sessionId, details: { caseNumber: shared.input.caseNumber } },
    event: { type: 'SESSION_CREATED', message: `Session ${sessionId} created`, sessionId },
  });
  world.record(startedAt - 30 * SECOND_MS, { audit: { type: 'PRECHECK_PASSED', message: 'Pre-recording checks passed', actorId: actor, sessionId } });
  world.record(startedAt, {
    audit: { type: 'RECORDING_STARTED', message: `Recording started (${sessionId})`, actorId: actor, sessionId },
    event: { type: 'RECORDING_STARTED', message: `Recording started · ${sessionId}`, severity: 'SUCCESS', sessionId },
  });
  return [activeSessionToRow(session, { at: now, seededAt: base.seededAt, lastResetAt: null })];
}
