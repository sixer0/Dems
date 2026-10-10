/**
 * Playback of the sealed camera files of a schema-v2 item on the tablet and the phone (blueprint
 * row 92, M8-W3; UX spec flow 5; R-3, R-4; MB-07): one expo-video player per camera file, fed by a
 * signed media session of operation 88 with the operator's `Authorization` header, synchronised on
 * the one audio timeline, with the audio-source band under the scrubber.
 *
 * - **Opening is a press.** Each session is a bearer path and writes an audit row on the Core, so
 *   the app asks for it when the operator presses Play, never on mount. G7: "Checking your
 *   permissions..." until the role is known.
 * - **The path** goes from the session object straight into the source handed to the player
 *   (`videoSourceOf`) and is in no state that is logged, cached or stored. A player error is
 *   recorded by the file and the position only — never by a source or a message of the player.
 * - **Two files, one clock.** Both files carry the same audio track (R-4): the first one leads and
 *   is audible, the second follows it muted and is re-aligned when it drifts. The playhead and the
 *   band follow the leading player's `timeUpdate` events; no timer of this screen drives them.
 * - **The session lives 60 s.** The player renews ON DEMAND, never on a timer: before a Play or a
 *   seek on a session that is at its end (the Core's clock, 5 s margin), and once after a player
 *   error ON SUCH A SESSION — then it goes back to the same position and plays on if it was
 *   playing. A second error at the same place is not renewed again: playback stops there with its
 *   position. **An error on a session that has NOT ended is not renewed at all** (wave K Z1,
 *   G94b-10): the native player has already asked the Core for that place again by itself before it
 *   reports an error, and a new media session cannot change what the Core answers there - a second
 *   round only repeated the refused requests. Playback stops with its position; "Open again" is the
 *   operator's, rate-limited.
 * - **A renewal keeps the playhead** (wave K Z1): the position goes to the new players once when the
 *   source is handed over and AGAIN when the leading player reports the stream loaded (a write the
 *   player dropped while it had no index yet); until then the new stream's own "0:00" is not shown.
 * - **A failed fragment is an integrity failure, not a player error**: when operation 88 answers
 *   `FRAGMENT_NOT_AUTHENTIC`, or playback stopped and the last verify run of this screen names a
 *   failed fragment, the player says which file and fragment.
 * - **States** (UX §6.5): `409 MEDIA_NOT_AVAILABLE` is a fixed message with no player; a refusal
 *   for the role says so; anything else goes to the shared presenter first and offers a
 *   rate-limited "Open again" (3 s, 6 s, 12 s; three tries, by the Core's clock).
 * - **A seek is sent only to a stream that can be sought** (wave K M1, G94b-01). The Android player
 *   (Media3 behind expo-video) maps EVERY seek on a fragmented file that carries no segment index
 *   to position 0 and reports no duration for it. So the player's own report decides: a duration at
 *   `sourceLoad` = the stream has its index, the scrubber seeks; no duration = the scrubber is
 *   disabled and says why, the second file is not "re-aligned" (that would restart it), and Play
 *   runs from where the player is. The session is asked WITH the index (`SEEK_INDEX_MEMBER`).
 * - Plain views and the kit; nothing here is animated (E-13).
 */
import { VideoView, useVideoPlayer, type VideoPlayer } from 'expo-video';
import { Alert, Button, Slider, Spinner } from 'heroui-native';
import { Pause, Play, RotateCcw } from 'lucide-react-native';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';
import { Permission, selectCan, selectOperator, useSim, useSimInstance } from '@dems/shared/sim';
import { derived, fontFamily, palette, radius, spacing, typography } from '@dems/shared/tokens';
import { newCorrelationId, reportRuntimeIssue, useCoreErrorPresenter, useMobileLive } from '@/runtime';
import { AudioSourceBand } from './audio-source-band';
import { VerifiedSourceBadge } from './development-source';
import { CAMERA_FILE_IDS, type CameraFileId, type ItemV2 } from './item-v2';
import { cameraFilesOf, mediaSessionStale, mediaTransportOf, openMediaSessions, videoSourceOf, type MediaSessionRefusal, type MediaSessions } from './media-session';
import { bandDurationMs, bandSegments, clampSeek, formatMediaTime, needsResync, permissionGate, seekAvailabilityOf, type SeekAvailability, type VerifiedSources } from './sealed-playback';

export interface SealedPlayerProps {
  evidenceId: string;
  /** The recorded duration of the item, in ms. */
  durationMs: number;
  item: ItemV2;
  /** The source classes of the last verify run on this screen, or null. */
  sources: VerifiedSources | null;
  /** The fragments the last verify run on this screen named as failed (operation 41), if any. */
  failedFragments?: readonly { readonly trackId: string; readonly seq: number }[];
  /**
   * Raised by the screen's Play / Pause action; once per value the player opens, starts - or, while
   * it plays, pauses (wave K Z1, G94b-04: the action reads "Pause" then).
   */
  playToken: number | null;
  /** Wave K Z1 (G94b-04): told whenever the player starts or stops playing, so the screen's action can read "Pause". */
  onPlayingChange?: (playing: boolean) => void;
  /**
   * Wave H C2: the camera files the Core says the package holds (operation 40 `media.files`, else
   * the VIDEO entries of the item's own `files` / `tracks`). null / absent: not reported - the
   * player then asks as before and shows what operation 88 opens.
   */
  fileIds?: readonly CameraFileId[] | null;
}

type Phase =
  | { readonly kind: 'idle' }
  | { readonly kind: 'opening' }
  | { readonly kind: 'ready'; readonly sessions: MediaSessions; readonly stoppedAtMs: number | null; readonly stopCause: StopCause | null; readonly renewing: boolean }
  | { readonly kind: 'refused'; readonly refusal: MediaSessionRefusal | 'NO_TRANSPORT' };

/**
 * Why playback stopped and did not resume by itself (wave H C2, G94-07):
 *   SESSION  the media session was at its end by the Core's clock when the player failed again
 *            (its 60 s ran out: a stall, a throttled link), or the renewal got no session. Nothing
 *            is said about integrity: "Press Play to continue" renews and goes on;
 *   PLAYER   the player failed on a session that had NOT ended (wave K Z1, G94b-10: such a session is
 *            never renewed by itself), or failed again at the place of a renewal: the stop names its
 *            position and points to Verify (an integrity answer is Verify's to give).
 */
type StopCause = 'SESSION' | 'PLAYER';

interface Resume {
  readonly seconds: number;
  readonly play: boolean;
}

const IDLE: Phase = { kind: 'idle' };
/** A player error that comes back within this much media time of the last automatic renewal is not renewed again. */
const SAME_PLACE_MS = 1_500;
/** "Open again": at least 3 s between tries, doubling, three tries (by the Core's clock; no timer here). */
const RETRY_BASE_MS = 3_000;
const RETRY_MAX = 3;
const TIME_UPDATE_S = 0.25;

// Player property writes live in module functions: the React Compiler forbids assigning to a value
// returned from a hook inside the component, and expo-video exposes these as properties.
function setupPlayer(muted: boolean) {
  return (player: VideoPlayer) => {
    player.loop = false;
    player.muted = muted;
    player.timeUpdateEventInterval = TIME_UPDATE_S;
  };
}
function setTime(player: VideoPlayer, seconds: number): void {
  try {
    player.currentTime = seconds;
  } catch {
    // Not seekable yet; the next time update re-aligns it.
  }
}

export function SealedPlayer({ evidenceId, durationMs, item, sources, failedFragments = [], playToken, onPlayingChange, fileIds = null }: SealedPlayerProps) {
  const { t } = useTranslation();
  const live = useMobileLive();
  const sim = useSimInstance();
  const presentCoreError = useCoreErrorPresenter();
  const operatorKnown = useSim((s) => selectOperator(s) !== null);
  const canView = useSim((s) => selectCan(s, Permission.EVIDENCE_VIEW));
  const gate = permissionGate({ operatorKnown, permitted: canView });
  const leadPlayer = useVideoPlayer(null, setupPlayer(false));
  const followPlayer = useVideoPlayer(null, setupPlayer(true));
  const [phase, setPhase] = useState<Phase>(IDLE);
  const [playing, setPlaying] = useState(false);
  const [positionMs, setPositionMs] = useState(0);
  const [dragMs, setDragMs] = useState<number | null>(null);
  const [retry, setRetry] = useState({ attempts: 0, until: 0 });
  /** What the leading player said about the stream of ONE set of sessions: UNKNOWN until its `sourceLoad` (G94b-01). */
  const [seekReport, setSeekReport] = useState<{ readonly of: MediaSessions | null; readonly value: SeekAvailability }>({ of: null, value: 'UNKNOWN' });
  const seekRef = useRef<SeekAvailability>('UNKNOWN');
  const busy = useRef(false);
  const resume = useRef<Resume | null>(null);
  const renewedAtMs = useRef<number | null>(null);
  const position = useRef(0);
  const playingRef = useRef(false);
  /** A renewal got no session: the open sessions are dead whatever their clock says, so Play renews first. */
  const sessionEnded = useRef(false);
  /** Wave K Z1: the place (seconds) a renewed session must come back to; null once the players are there. */
  const pendingStart = useRef<number | null>(null);
  /** Wave K Z1: true from the moment a new source goes to the players until the leading player has loaded it. */
  const handingOver = useRef(false);

  // G94b-04: the screen's action follows the player (and reads "Play" again when the player goes).
  useEffect(() => {
    onPlayingChange?.(playing);
  }, [playing, onPlayingChange]);
  useEffect(() => () => onPlayingChange?.(false), [onPlayingChange]);

  const segments = useMemo(() => bandSegments(item.audioIntervals, durationMs), [item.audioIntervals, durationMs]);
  const totalMs = bandDurationMs(item.audioIntervals, durationMs);
  const coreNow = useCallback((): number => sim.store.getState().clock.now, [sim]);

  const sessions = phase.kind === 'ready' ? phase.sessions : null;
  const opened = useMemo(() => (sessions === null ? [] : CAMERA_FILE_IDS.filter((fileId) => sessions[fileId] !== undefined)), [sessions]);
  /** The camera files this item has: one or two (fix F-M8) - the Core's own list when it states one (wave H C2). */
  const expected = useMemo(() => (fileIds !== null && fileIds.length > 0 ? fileIds : cameraFilesOf(item)), [fileIds, item]);
  /** The package is known to hold ONE camera file: said as a fact of the recording, not as a file that failed to open. */
  const oneCamera = fileIds !== null && fileIds.length === 1 ? fileIds[0] : null;
  const players = useMemo(() => [leadPlayer, followPlayer].slice(0, opened.length), [leadPlayer, followPlayer, opened.length]);

  /** A report counts for the sessions it was made on: a new source is judged anew. */
  const seek: SeekAvailability = seekReport.of === sessions ? seekReport.value : 'UNKNOWN';
  const markSeek = (value: SeekAvailability) => {
    seekRef.current = value;
    setSeekReport({ of: sessions, value });
  };
  /** A position is written to a player only when the stream can be sought: on a stream without an index the write restarts it at 0. */
  const align = (player: VideoPlayer, seconds: number) => {
    if (seekRef.current !== 'NONE') setTime(player, seconds);
  };

  const markPlaying = (value: boolean) => {
    playingRef.current = value;
    setPlaying(value);
  };

  const open = useCallback(
    async (then: Resume | null, renewal: boolean) => {
      if (live === null || busy.current) return;
      if (mediaTransportOf(live) === null) {
        // The runtime holds no operator session to name to the media route (pass D5). Nothing is asked.
        reportRuntimeIssue('warn', 'evidence.playback.transport', 'no media transport on the Live source', { evidenceId });
        setPhase({ kind: 'refused', refusal: 'NO_TRANSPORT' });
        return;
      }
      busy.current = true;
      setPhase((current) => (renewal && current.kind === 'ready' ? { ...current, renewing: true } : { kind: 'opening' }));
      const correlationId = newCorrelationId('evidence');
      let result: Awaited<ReturnType<typeof openMediaSessions>>;
      try {
        result = await openMediaSessions(live, evidenceId, expected);
      } catch {
        // The client returns failures as values; a throw is a defect. The player is not latched by it (R93-21).
        result = { sessions: {}, failure: null };
      } finally {
        busy.current = false;
      }
      if (Object.keys(result.sessions).length === 0) {
        const failure = result.failure;
        const refusal = failure?.refusal ?? 'FAILED';
        if (renewal && refusal === 'FAILED') {
          // G94-07: a RENEWAL that got no session ends the media session, not the recording. The
          // player keeps its place and says so; Play asks again. (A refusal by permission or
          // "no media" stays its own state below.)
          const presented = failure?.failure != null && presentCoreError(failure.failure);
          reportRuntimeIssue(presented ? 'warn' : 'error', 'evidence.playback.renew', `createEvidenceMediaSession -> ${failure?.code ?? 'NO_SESSION'}`, { evidenceId, status: failure?.status ?? null, code: failure?.code ?? 'NO_SESSION' }, correlationId);
          resume.current = null;
          playingRef.current = false;
          setPlaying(false);
          sessionEnded.current = true;
          setPhase((current) => (current.kind === 'ready' ? { ...current, stoppedAtMs: position.current, stopCause: 'SESSION', renewing: false } : { kind: 'refused', refusal }));
          return;
        }
        if (refusal === 'FAILED' || refusal === 'NOT_PERMITTED') {
          const presented = failure?.failure != null && presentCoreError(failure.failure);
          reportRuntimeIssue(presented ? 'warn' : 'error', 'evidence.playback.open', `createEvidenceMediaSession -> ${failure?.code ?? 'NO_SESSION'}`, { evidenceId, status: failure?.status ?? null, code: failure?.code ?? 'NO_SESSION' }, correlationId);
        }
        resume.current = null;
        playingRef.current = false;
        setPlaying(false);
        setPhase({ kind: 'refused', refusal });
        return;
      }
      resume.current = then;
      if (then === null) {
        position.current = 0;
        setPositionMs(0);
      }
      if (then?.play === true) {
        playingRef.current = true;
        setPlaying(true);
      }
      sessionEnded.current = false;
      setPhase({ kind: 'ready', sessions: result.sessions, stoppedAtMs: null, stopCause: null, renewing: false });
    },
    [evidenceId, expected, live, presentCoreError],
  );

  // The bearer path goes into the player's source here; it is taken out again when the sessions or the screen go.
  useEffect(() => {
    if (sessions === null || live === null) return undefined;
    const transport = mediaTransportOf(live);
    if (transport === null) return undefined;
    const target = resume.current;
    resume.current = null;
    // Z1: a renewal comes back to its place; the time updates of the new stream before that are not the playhead.
    pendingStart.current = target !== null && target.seconds > 0 ? target.seconds : null;
    handingOver.current = true;
    let alive = true;
    // A new source: what the last one could do says nothing about this one (the drawn state follows `sessions`).
    seekRef.current = 'UNKNOWN';
    const active = [leadPlayer, followPlayer].slice(0, opened.length);
    void Promise.all(active.map((player, index) => player.replaceAsync(videoSourceOf(sessions[opened[index] as CameraFileId]!, transport))))
      .then(() => {
        if (!alive) return;
        // Back to the same place on the new session (nothing to do for a first open at 0).
        if (target !== null && target.seconds > 0) for (const player of active) setTime(player, target.seconds);
        if (target?.play === true) for (const player of active) player.play();
      })
      .catch(() => {
        // The error itself may quote the source: only the fact is recorded.
        reportRuntimeIssue('warn', 'evidence.playback.source', 'a sealed file could not be handed to its player', { evidenceId });
        handingOver.current = false;
        // R93-14: nothing plays - the Pause state set for this hand-over is taken back.
        if (alive && target?.play === true) {
          playingRef.current = false;
          setPlaying(false);
        }
      });
    return () => {
      alive = false;
      for (const player of active) {
        try {
          player.pause();
          void player.replaceAsync(null).catch(() => undefined);
        } catch {
          // The player is already released with the screen.
        }
      }
    };
  }, [sessions, live, leadPlayer, followPlayer, opened, evidenceId]);

  const pause = useCallback(() => {
    for (const player of [leadPlayer, followPlayer]) {
      try {
        player.pause();
      } catch {
        // Released with the screen.
      }
    }
    playingRef.current = false;
    setPlaying(false);
  }, [leadPlayer, followPlayer]);

  const stale = (): boolean => sessionEnded.current || (sessions !== null && opened.some((fileId) => mediaSessionStale(sessions[fileId]!, coreNow())));
  /** The session is past its END by the Core's clock (no margin): a request on it is refused whatever the recording is. */
  const ended = (): boolean => sessions !== null && opened.some((fileId) => mediaSessionStale(sessions[fileId]!, coreNow(), 0));

  const canRetry = retry.attempts < RETRY_MAX && coreNow() >= retry.until;
  const consumeRetry = (): boolean => {
    const now = coreNow();
    if (retry.attempts >= RETRY_MAX || now < retry.until) return false;
    setRetry({ attempts: retry.attempts + 1, until: now + RETRY_BASE_MS * 2 ** retry.attempts });
    return true;
  };

  const play = () => {
    // After a renewal that got no session, asking again is rate-limited like "Open again" (3 s, 6 s, 12 s; three tries).
    if (sessionEnded.current && !consumeRetry()) return;
    if (stale()) {
      void open({ seconds: position.current / 1000, play: true }, true);
      return;
    }
    if (players.length > 1 && needsResync(leadPlayer.currentTime, followPlayer.currentTime, 0)) align(followPlayer, leadPlayer.currentTime);
    for (const player of players) player.play();
    markPlaying(true);
  };

  const seekTo = (ms: number) => {
    // G94b-01: this stream cannot be sought - nothing is sent to the player and the playhead stays where the player is.
    if (seekRef.current === 'NONE') return;
    const seconds = clampSeek(ms / 1000, totalMs / 1000);
    position.current = seconds * 1000;
    setPositionMs(seconds * 1000);
    if (stale()) {
      // The seek would be a new range request on a session at its end: renew first, then go there.
      void open({ seconds, play: playingRef.current }, true);
      return;
    }
    for (const player of players) setTime(player, seconds);
  };

  const onPlayerError = (fileId: CameraFileId) => {
    const at = position.current;
    reportRuntimeIssue('warn', 'evidence.playback.player', 'a player of a sealed file reported an error', { evidenceId, fileId, positionMs: Math.round(at) });
    const wasPlaying = playingRef.current;
    pause();
    const samePlace = renewedAtMs.current !== null && Math.abs(at - renewedAtMs.current) <= SAME_PLACE_MS;
    // G94b-10: only a session at its END is renewed by itself. On a live session the error is the
    // Core's answer for this place (the native player has retried it already): asking again through
    // a new session repeats the refused requests and nothing else.
    if (stale() && !samePlace && !busy.current && consumeRetry()) {
      renewedAtMs.current = at;
      void open({ seconds: at / 1000, play: wasPlaying }, true);
      return;
    }
    // G94-07: the cause is the session's end when the Core's clock is past it - never worded as integrity.
    const stopCause: StopCause = ended() ? 'SESSION' : 'PLAYER';
    setPhase((current) => (current.kind === 'ready' ? { ...current, stoppedAtMs: at, stopCause, renewing: false } : current));
  };

  // The media clock of the leading player, its end, and the errors of both players.
  useEffect(() => {
    if (sessions === null) return undefined;
    const subscriptions = [
      leadPlayer.addListener('timeUpdate', ({ currentTime }) => {
        // Z1: a renewed stream reports its own start until the position has been written to it.
        if (pendingStart.current !== null) {
          if (currentTime * 1000 + SAME_PLACE_MS < pendingStart.current * 1000) return;
          pendingStart.current = null;
        }
        const nowMs = Math.min(currentTime * 1000, totalMs);
        position.current = nowMs;
        setPositionMs(nowMs);
        if (renewedAtMs.current !== null && nowMs - renewedAtMs.current > SAME_PLACE_MS) {
          renewedAtMs.current = null;
          setRetry({ attempts: 0, until: 0 });
        }
        if (opened.length > 1 && needsResync(currentTime, followPlayer.currentTime)) align(followPlayer, currentTime);
      }),
      // Z1: taking the old source off a player makes it report its end. That is not the end of
      // the recording: while a new source is being handed over the report is not a Pause.
      leadPlayer.addListener('playToEnd', () => {
        if (!handingOver.current) pause();
      }),
      // Wave K M1 (G94b-01): whether THIS stream can be sought is the player's own report.
      leadPlayer.addListener('sourceLoad', ({ duration }) => {
        const available = seekAvailabilityOf(duration);
        handingOver.current = false;
        // Kept for the team: the file, and whether the Core said it sent the index. Never the source.
        if (available === 'NONE') reportRuntimeIssue('warn', 'evidence.playback.seek', 'the player reported no duration: this stream cannot be sought', { evidenceId, fileId: opened[0] ?? null, indexed: sessions[opened[0] as CameraFileId]?.indexed ?? false });
        markSeek(available);
        // Z1: the place of a renewal, written again now that the player knows the stream (a write
        // before the index was read is dropped by the Android player). A stream that cannot be
        // sought plays from its start: nothing is pending on it.
        const pending = pendingStart.current;
        if (pending !== null) {
          if (available === 'NONE') pendingStart.current = null;
          else for (const player of [leadPlayer, followPlayer].slice(0, opened.length)) if (needsResync(pending, player.currentTime)) setTime(player, pending);
        }
      }),
      ...[leadPlayer, followPlayer].slice(0, opened.length).map((player, index) =>
        player.addListener('statusChange', ({ status }) => {
          if (status === 'error') onPlayerError(opened[index] as CameraFileId);
        }),
      ),
    ];
    return () => {
      for (const subscription of subscriptions) subscription.remove();
    };
    // The handlers read refs and the players; they are bound once per set of sessions.
  }, [sessions]); // eslint-disable-line react-hooks/exhaustive-deps

  // The screen's Play action: open the sessions first, or start the players that are open.
  // The start waits one microtask, so a StrictMode remount cancels the first start instead of asking twice.
  useEffect(() => {
    if (playToken === null || gate !== 'ALLOWED') return undefined;
    let alive = true;
    queueMicrotask(() => {
      if (!alive) return;
      // G94b-04: the screen's action reads "Pause" while the player plays, and pauses it.
      if (phase.kind === 'ready') (playingRef.current ? pause : play)();
      else if (phase.kind === 'idle') void open({ seconds: 0, play: true }, false);
    });
    return () => {
      alive = false;
    };
  }, [playToken]); // eslint-disable-line react-hooks/exhaustive-deps

  const reopen = () => {
    if (!consumeRetry()) return;
    renewedAtMs.current = null;
    void open(phase.kind === 'ready' ? { seconds: position.current / 1000, play: false } : null, phase.kind === 'ready');
  };
  const reopenButton = (
    <Button size="sm" variant="outline" onPress={reopen} isDisabled={!canRetry} testID="evidence-playback-reopen">
      <RotateCcw size={16} color={canRetry ? palette.gold : palette.gray} />
      <Button.Label>{retry.attempts >= RETRY_MAX ? t('common.errors.maxRetries') : t('evidence.playback.reopen')}</Button.Label>
    </Button>
  );
  // R93-13: what the screen's last Verify run found, said as that - not as the place where playback stopped.
  const integrityText = (place: { readonly fileId: string; readonly seq: number }): string => t('evidence.playback.integrityVerify', { file: place.fileId, seq: place.seq });

  if (phase.kind === 'refused') {
    const text = t(`evidence.playback.${phase.refusal === 'NOT_AVAILABLE' ? 'notAvailable' : phase.refusal === 'NOT_PERMITTED' ? 'notPermitted' : 'failed'}`);
    return (
      <View style={styles.root} testID={`evidence-playback-refused-${phase.refusal}`}>
        <Alert status={phase.refusal === 'FAILED' || phase.refusal === 'NO_TRANSPORT' ? 'danger' : 'warning'}>
          <Alert.Indicator />
          <Alert.Content>
            <Alert.Title>{text}</Alert.Title>
          </Alert.Content>
        </Alert>
        {phase.refusal === 'FAILED' ? reopenButton : null}
      </View>
    );
  }

  if (phase.kind !== 'ready') {
    const opening = phase.kind === 'opening';
    return (
      <View style={styles.root} testID={`evidence-playback-${phase.kind}`}>
        <Text maxFontSizeMultiplier={1.2} style={styles.strong}>
          {t('evidence.playback.title')}
        </Text>
        <Text maxFontSizeMultiplier={1.2} style={styles.caption}>
          {gate === 'REFUSED' ? t('evidence.playback.notPermitted') : t('evidence.playback.note')}
        </Text>
        <Button variant="tertiary" onPress={() => void open(null, false)} isDisabled={gate !== 'ALLOWED' || opening} testID={`evidence-playback-open-${gate}`}>
          {opening ? <Spinner size="sm" /> : <Play size={18} color={palette.gold} fill={palette.gold} />}
          <Button.Label>{gate === 'CHECKING' ? t('evidence.playback.checking') : opening ? t('evidence.playback.opening') : t('evidence.playback.open')}</Button.Label>
        </Button>
      </View>
    );
  }

  // A file the item HAS and that did not open; a package of one camera misses nothing.
  const missing = expected.find((fileId) => phase.sessions[fileId] === undefined) ?? null;
  const stopped = phase.stoppedAtMs !== null;
  /** The stop is the media session's end only: said as that, with no integrity sentence (G94-07). */
  const sessionStop = stopped && phase.stopCause === 'SESSION';
  const verifiedFailure = stopped && !sessionStop ? (failedFragments.find((fragment) => (opened as readonly string[]).includes(fragment.trackId)) ?? null) : null;
  const shownMs = dragMs ?? positionMs;
  return (
    <View style={styles.root} testID={`evidence-playback-ready-${opened.join('+')}`}>
      <View style={styles.stages}>
        {opened.map((fileId, index) => {
          const track = sources?.state === 'DEVELOPMENT' ? sources.tracks.find((entry) => entry.trackId === fileId) : undefined;
          return (
            <View key={fileId} style={styles.file}>
              <View style={styles.fileHead}>
                <Text maxFontSizeMultiplier={1.2} style={styles.caption} numberOfLines={1}>
                  {t('evidence.playback.file', { track: t(`common.tracks.${fileId}`) })}
                </Text>
                {track ? <VerifiedSourceBadge sourceClass={track.sourceClass} testID={`evidence-playback-development-${fileId}`} /> : null}
              </View>
              <View style={styles.stage}>
                <VideoView
                  testID={`evidence-sealed-video-${fileId}`}
                  player={index === 0 ? leadPlayer : followPlayer}
                  style={StyleSheet.absoluteFill}
                  contentFit="contain"
                  nativeControls={false}
                  allowsPictureInPicture={false}
                  surfaceType="textureView"
                  accessible={false}
                />
              </View>
            </View>
          );
        })}
      </View>
      {missing !== null ? (
        <Text maxFontSizeMultiplier={1.2} style={styles.caption} testID="evidence-playback-one-file">
          {t('evidence.playback.oneFile', { track: t(`common.tracks.${opened[0] ?? missing}`) })}
        </Text>
      ) : oneCamera != null ? (
        <Text maxFontSizeMultiplier={1.2} style={styles.caption} testID="evidence-playback-one-camera">
          {t('evidence.itemFacts.media.oneCamera', { track: t(`common.tracks.${oneCamera}`) })}
        </Text>
      ) : null}
      {phase.renewing ? (
        <Text maxFontSizeMultiplier={1.2} style={styles.caption} accessibilityLiveRegion="polite" testID="evidence-playback-renewing">
          {t('evidence.playback.renewing')}
        </Text>
      ) : null}
      {sessionStop ? (
        <View style={styles.stoppedBlock} accessibilityLiveRegion="polite" testID="evidence-playback-stopped-session">
          <Alert status="warning">
            <Alert.Indicator />
            <Alert.Content>
              <Alert.Title>{t('evidence.itemFacts.playback.sessionEnded')}</Alert.Title>
            </Alert.Content>
          </Alert>
        </View>
      ) : stopped ? (
        <View style={styles.stoppedBlock} testID={`evidence-playback-stopped-${verifiedFailure ? 'integrity' : 'position'}`}>
          <Alert status={verifiedFailure ? 'danger' : 'warning'}>
            <Alert.Indicator />
            <Alert.Content>
              <Alert.Title>
                {verifiedFailure ? integrityText({ fileId: verifiedFailure.trackId, seq: verifiedFailure.seq }) : t('evidence.playback.stoppedAt', { at: formatMediaTime(phase.stoppedAtMs ?? 0) })}
              </Alert.Title>
            </Alert.Content>
          </Alert>
          {verifiedFailure ? null : reopenButton}
        </View>
      ) : null}

      <Slider
        value={shownMs}
        minValue={0}
        maxValue={Math.max(1, totalMs)}
        step={1000}
        isDisabled={seek === 'NONE'}
        onChange={(value) => setDragMs(Array.isArray(value) ? (value[0] ?? 0) : value)}
        onChangeEnd={(value) => {
          setDragMs(null);
          seekTo(Array.isArray(value) ? (value[0] ?? 0) : value);
        }}
        accessibilityLabel={t('evidence.media.scrub')}
        testID="evidence-sealed-scrubber"
      >
        <Slider.Track>
          <Slider.Fill />
          <Slider.Thumb />
        </Slider.Track>
      </Slider>
      {seek === 'NONE' ? (
        <Text maxFontSizeMultiplier={1.2} style={styles.caption} testID="evidence-playback-no-seek">
          {t('features.evidence.player.noSeek')}
        </Text>
      ) : null}
      <View style={styles.transport}>
        <Button
          size="md"
          variant="tertiary"
          isDisabled={(stopped && !sessionStop) || phase.renewing}
          onPress={() => (playing ? pause() : play())}
          accessibilityLabel={playing ? t('evidence.media.pause') : t('evidence.media.play')}
          testID={`evidence-sealed-toggle-${playing ? 'playing' : 'paused'}`}
        >
          {playing ? <Pause size={18} color={palette.gold} /> : <Play size={18} color={palette.gold} />}
          <Button.Label>{playing ? t('evidence.media.pause') : t('evidence.media.play')}</Button.Label>
        </Button>
        <Text maxFontSizeMultiplier={1.2} style={styles.time} testID="evidence-sealed-time">
          {formatMediaTime(shownMs)} / {formatMediaTime(totalMs)}
        </Text>
      </View>
      <AudioSourceBand segments={segments} totalMs={totalMs} positionMs={shownMs} sources={sources} itemIntervals={item.audioIntervals} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: spacing[2] },
  stages: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[1] + 2 },
  file: { flexGrow: 1, flexBasis: 240, minWidth: 0, gap: 4 },
  fileHead: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: spacing[1] },
  stage: { aspectRatio: 16 / 9, borderRadius: radius.px.lg, overflow: 'hidden', backgroundColor: palette.black, borderWidth: 1, borderColor: derived.border },
  stoppedBlock: { gap: spacing[1] },
  transport: { flexDirection: 'row', alignItems: 'center', gap: spacing[2] },
  time: { fontFamily: fontFamily.native.mono, fontSize: typography.data.size, lineHeight: typography.data.lineHeight, color: palette.foreground, fontVariant: ['tabular-nums'] },
  strong: { fontFamily: fontFamily.native.semibold, fontSize: typography.body.size, lineHeight: typography.body.lineHeight, color: palette.foreground },
  caption: { fontFamily: fontFamily.native.normal, fontSize: typography.caption.size, lineHeight: typography.caption.lineHeight, color: palette.gray },
});
