/**
 * Evidence playback (04_mobile_specs §4.11 D6 Play; D50, D68; row 83: "the play sheet uses the
 * step-72 media subset with an AUDIO-01 and AUDIO-02 switch").
 *
 * Three expo-video players over the bundled 640 × 360 subset:
 * - the camera clip (VIDEO-01 or VIDEO-02; no audio stream, DR-92-8), shown in a `VideoView`;
 * - MIC 1 (AUDIO-01) and MIC 2 (AUDIO-02), audio-only m4a files played by players with NO view
 *   (D68: step 83 proves on the devices that expo-video plays them). Both run in step with the clip;
 *   only the selected one is unmuted, so the two tracks are never mixed.
 *
 * The scrubber spans the RECORDED duration; the clips are 31–47 s DEMO excerpts from the recording
 * start, so a recording position p plays every clip at p mod the clip length (the excerpt rule,
 * 64_demo_media §5). The position runs on the wall clock while playing and is published at 4 Hz
 * (04 §7.8: text ≤ 4 Hz); once a second each player is re-seeked if it drifted.
 *
 * Every function that calls a hook is named `use…` (D66).
 */
import { useVideoPlayer, type VideoPlayer, type VideoSource } from 'expo-video';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import type { AudioTrackId, VideoTrackId } from '@dems/shared/domain';
import { demoVideoAssetOf, type DemoMediaItem } from '@/components/media';
import { reportRuntimeIssue } from '@/runtime';
import { clampPosition, excerptOffsetMs, needsResync } from './evidence-model';

/** Position publish interval (4 Hz). */
export const PLAYBACK_TICK_MS = 250;
/** Drift check every n ticks (once a second). */
const RESYNC_EVERY_TICKS = 4;

export interface EvidencePlaybackOptions {
  media: DemoMediaItem;
  /** The recorded duration the scrubber spans, ms. */
  durationMs: number;
  /** The DEMO excerpt length of every clip, ms (from the package). */
  clipMs: number;
  initialCamera?: VideoTrackId;
  initialMic?: AudioTrackId;
  /** False pauses playback (sheet closed, screen unfocused, app in the background). */
  active: boolean;
  /** For the persistent log. */
  evidenceId: string;
}

export interface EvidencePlayback {
  readonly videoPlayer: VideoPlayer;
  readonly playing: boolean;
  /** Recording position, ms (published at 4 Hz). */
  readonly positionMs: number;
  readonly camera: VideoTrackId;
  readonly mic: AudioTrackId;
  /** A player reported an error (logged once per player). */
  readonly error: boolean;
  play(): void;
  pause(): void;
  toggle(): void;
  seek(positionMs: number): void;
  setCamera(camera: VideoTrackId): void;
  setMic(mic: AudioTrackId): void;
}

function setupLoop(muted: boolean) {
  return (player: VideoPlayer) => {
    player.loop = true;
    player.muted = muted;
  };
}

// Player property writes live in module functions: the React Compiler forbids assigning to a value
// returned from a hook inside the component, and expo-video exposes mute and seek as properties.
function setMuted(player: VideoPlayer, muted: boolean): void {
  player.muted = muted;
}

function seekTo(player: VideoPlayer, seconds: number): void {
  player.currentTime = seconds;
}

export function useEvidencePlayback({
  media,
  durationMs,
  clipMs,
  initialCamera = 'VIDEO-01',
  initialMic = 'AUDIO-01',
  active,
  evidenceId,
}: EvidencePlaybackOptions): EvidencePlayback {
  // D60 (2026-11-04): four video tracks; a track the demo corpus does not ship yet plays the first loop.
  const [initialVideo] = useState<VideoSource>(() => demoVideoAssetOf(media, 'video', initialCamera));
  const videoPlayer = useVideoPlayer(initialVideo, setupLoop(true));
  const mic1 = useVideoPlayer(media.audio['AUDIO-01'], setupLoop(initialMic !== 'AUDIO-01'));
  const mic2 = useVideoPlayer(media.audio['AUDIO-02'], setupLoop(initialMic !== 'AUDIO-02'));

  const [playing, setPlaying] = useState(false);
  const [positionMs, setPositionMs] = useState(0);
  const [camera, setCameraState] = useState<VideoTrackId>(initialCamera);
  const [mic, setMicState] = useState<AudioTrackId>(initialMic);
  const [error, setError] = useState(false);

  // The playback clock: position at `startedAt` (wall ms), or paused at `position`.
  const clock = useRef({ position: 0, startedAt: null as number | null });

  const currentPosition = useCallback((): number => {
    const { position, startedAt } = clock.current;
    return startedAt === null ? position : clampPosition(position + (Date.now() - startedAt), durationMs);
  }, [durationMs]);

  const players = useCallback((): VideoPlayer[] => [videoPlayer, mic1, mic2], [videoPlayer, mic1, mic2]);

  const seekPlayers = useCallback(
    (position: number) => {
      const offsetS = excerptOffsetMs(position, clipMs) / 1000;
      for (const player of players()) {
        try {
          seekTo(player, offsetS);
        } catch (cause) {
          reportRuntimeIssue('warn', 'evidence.play.seek', cause, { evidenceId });
        }
      }
    },
    [clipMs, players, evidenceId],
  );

  const pause = useCallback(() => {
    clock.current = { position: currentPosition(), startedAt: null };
    for (const player of players()) player.pause();
    setPositionMs(clock.current.position);
    setPlaying(false);
  }, [currentPosition, players]);

  const play = useCallback(() => {
    let position = currentPosition();
    if (position >= durationMs) position = 0;
    seekPlayers(position);
    clock.current = { position, startedAt: Date.now() };
    for (const player of players()) player.play();
    setPositionMs(position);
    setPlaying(true);
  }, [currentPosition, durationMs, seekPlayers, players]);

  const toggle = useCallback(() => (clock.current.startedAt === null ? play() : pause()), [play, pause]);

  const seek = useCallback(
    (target: number) => {
      const position = clampPosition(target, durationMs);
      const wasPlaying = clock.current.startedAt !== null;
      clock.current = { position, startedAt: wasPlaying ? Date.now() : null };
      seekPlayers(position);
      setPositionMs(position);
    },
    [durationMs, seekPlayers],
  );

  const setMic = useCallback(
    (next: AudioTrackId) => {
      setMuted(mic1, next !== 'AUDIO-01');
      setMuted(mic2, next !== 'AUDIO-02');
      setMicState(next);
    },
    [mic1, mic2],
  );

  const setCamera = useCallback(
    (next: VideoTrackId) => {
      setCameraState(next);
      const source = demoVideoAssetOf(media, 'video', next);
      void videoPlayer
        .replaceAsync(source)
        .then(() => {
          seekTo(videoPlayer, excerptOffsetMs(currentPosition(), clipMs) / 1000);
          if (clock.current.startedAt !== null) videoPlayer.play();
        })
        .catch((cause: unknown) => {
          reportRuntimeIssue('error', 'evidence.play.camera', cause, { evidenceId, camera: next });
          setError(true);
        });
    },
    [media, videoPlayer, currentPosition, clipMs, evidenceId],
  );

  // 4 Hz position, end of recording, once-a-second drift correction.
  useEffect(() => {
    if (!playing) return undefined;
    let ticks = 0;
    const id = setInterval(() => {
      const position = currentPosition();
      if (position >= durationMs) {
        clock.current = { position: durationMs, startedAt: null };
        for (const player of players()) player.pause();
        setPositionMs(durationMs);
        setPlaying(false);
        return;
      }
      setPositionMs(position);
      ticks += 1;
      if (ticks % RESYNC_EVERY_TICKS !== 0 || clipMs <= 0) return;
      const expectedS = excerptOffsetMs(position, clipMs) / 1000;
      for (const player of players()) {
        if (needsResync(player.currentTime, expectedS, clipMs / 1000)) seekTo(player, expectedS);
      }
    }, PLAYBACK_TICK_MS);
    return () => clearInterval(id);
  }, [playing, currentPosition, durationMs, clipMs, players]);

  // Inactive (sheet closed, unfocused) pauses.
  useEffect(() => {
    if (!active && clock.current.startedAt !== null) pause();
  }, [active, pause]);

  // The app going to the background pauses too (expo-video pauses its players there; the playback
  // clock must stop with them).
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state !== 'active' && clock.current.startedAt !== null) pause();
    });
    return () => subscription.remove();
  }, [pause]);

  // Player errors: logged once per player; the sheet shows a retry-free error line.
  useEffect(() => {
    const tracks: [VideoPlayer, string][] = [
      [videoPlayer, 'video'],
      [mic1, 'AUDIO-01'],
      [mic2, 'AUDIO-02'],
    ];
    const subscriptions = tracks.map(([player, track]) =>
      player.addListener('statusChange', ({ status, error: cause }) => {
        if (status !== 'error') return;
        reportRuntimeIssue('error', 'evidence.play.player', new Error(cause?.message ?? 'player error'), { evidenceId, track });
        setError(true);
      }),
    );
    return () => subscriptions.forEach((subscription) => subscription.remove());
  }, [videoPlayer, mic1, mic2, evidenceId]);

  return { videoPlayer, playing, positionMs, camera, mic, error, play, pause, toggle, seek, setCamera, setMic };
}
