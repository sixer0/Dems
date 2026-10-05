/**
 * Session Monitor (04_mobile_specs §4.5, MB 4) at `/session/live`; step 79 (05_mobile_plan M-10).
 *
 * The route renders this screen only while RECORDING (`useSessionLiveRedirect`, step 70). Regions:
 * S1 header (guarded back, "Active Session", History), S2 REC row with the clock-derived timer,
 * S2b §5.4 status strip, S3 live feed (step-72 live loops through CameraFeed, D50), S4 MIC cards
 * (the 20 Hz shared-value meter path, D57), S5 Snapshot / Bookmark / Audio Monitor / Settings,
 * S6 "End Session" (hold 1.5 s, then a mandatory reason; D38 Q-M5), S7 the connection banner.
 *
 * Layout per 04 §2.4 (D17): phone portrait stacks MB 4; phone landscape splits feed | controls;
 * tablet portrait puts the feed full width over meters | status + timeline; tablet landscape uses
 * three columns: feed 58% | timer + meters + status | timeline + actions, with End Session pinned
 * bottom right. Panes carry `pane-feed`, `pane-meters`, `pane-timeline` (MA-12).
 *
 * Back is guarded while RECORDING (§3.6): hardware back, the header arrow and `router.back()` open
 * "Recording continues on the Core. Leave the monitor?"; Back never stops a recording. Keep-awake
 * is held by the runtime (step 73, tag `dems-session`) for the whole RECORDING state.
 *
 * Motion (§7.3 M-PG-SM): 0 header; 80 feed; 140 MIC cards; 200 actions (stagger 40); 260 End
 * Session. Ambient loops: the REC pulse and the feed frame glow (2 of the 4 allowed, 03M P3).
 *
 * **Live mode** (backend task, plan row W68; 04_client_integration_spec §8.6 S2-1, §8.7 S4-2; I8).
 * The screen is the same in both modes; what changes is where the data comes from and when a
 * command's continuation runs (`useMonitorActions`, `settle`):
 *
 * | Site | At the press | Once the Core holds the effect (`ok`) | On a refusal |
 * |---|---|---|---|
 * | Snapshot (S2-1) | the tile is busy (LB-1); the shutter flashes if the Core has not answered yet (LB-4: it changes no record) | the thumbnail flight, the counter pop, the toast | the toast says why; nothing else |
 * | Marker (S2-1, S4-2) | the Add button is busy | the timeline's newest node is read (S4-2: it is the marker, CL-16), the toast with its time, the chip flight; the field closes | the field stays open with the label |
 * | End Session (S2-1) | the Dialog's confirm is busy | the Dialog closes; route-sync follows STOPPING | the Dialog stays (`end-session.tsx`) |
 * | Camera, CLIP reset | one command per control | results ignored, as before | the toast (presenter in LIVE) |
 *
 * The meters come from the socket (I8): the Live source writes the store's `audio` slice from each
 * `meters` frame, the runtime copies it into Reanimated shared values, and the meters draw on the UI
 * thread; this screen sends no request for them and re-renders for none of them. The timer reads the
 * store's clock, which in LIVE follows the Core's. Nothing starts on mount, so React StrictMode (a
 * development build mounts effects twice, D158 F69-1) sends nothing twice.
 */
import { useIsFocused, useRouter } from 'expo-router';
import { Button, useToast } from 'heroui-native';
import { ArrowLeft, History } from 'lucide-react-native';
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { BackHandler, ScrollView, StyleSheet, Text, View, useWindowDimensions, type View as RNView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { useAnimatedStyle, useSharedValue, withSequence, withSpring, withTiming } from 'react-native-reanimated';
import type { AudioTrackId, VideoTrackId } from '@dems/shared/domain';
import { useSimInstance } from '@dems/shared/sim';
import { useCoreLinkReadOnly, usePendingPress } from '@/runtime';
import { derived, fontFamily, motion as motionTokens, palette, spacing, statusText, typography } from '@dems/shared/tokens';
import { SectionCard } from '@/components/kit';
import type { MeterVariant } from '@/components/composed/dbfs-meter';
import { SessionTimeline, type TimelineItem } from '@/components/composed/session-timeline';
import { timelineTime } from '@/components/composed/session-timeline.math';
import { Pane, SafeScreen, useLayoutClass } from '@/layout';
import { enterRise, triggerHaptic, useMotionPolicy, useMotionSettings, useMotionState } from '@/motion';
import { BackGuardDialog, useBackGuard, type BackGuard } from '@/navigation';
import { ActionTiles } from './action-tiles';
import { ConnectionBanner } from './connection-banner';
import { EndSession } from './end-session';
import { LiveFeed } from './live-feed';
import { MarkerFlight, type FlightRect, type MarkerFlightSpec } from './marker-flight';
import { MicCard } from './mic-card';
import { AudioMonitorSheet, MonitorSettingsSheet, TimelineSheet } from './monitor-sheets';
import { RecDot, RecRow, RecTimer } from './rec-indicator';
import {
  monitorArrangement,
  monitorColumnWidths,
  showsInlineTimeline,
  timelineItems,
  unseenCount,
  usesCameraTabs,
  type MonitorArrangement,
} from './session-live.math';
import { StatusStrip } from './status-strip';
import {
  useMonitorActions,
  useMonitorCameras,
  type MonitorHandlers,
  useMonitorMics,
  useMonitorSession,
  useMonitorTimeline,
} from './use-monitor';

type SheetName = 'timeline' | 'audio' | 'settings';

/**
 * Snapshot and marker confirmations sit at the bottom for 2.5 s: at the top (the app default, §4.19)
 * they covered the header's History icon, which is where the marker chip flies (seen on dems_phone).
 */
const CONFIRM_TOAST = { placement: 'bottom', duration: 2500 } as const;

/** §7.3 M-PG-SM enter beats (ms after the route enters). */
const BEAT = { feed: 80, mics: 140, actions: 200, end: 260 } as const;

/** Measures a view in window coordinates (null when it is not laid out). */
function measure(ref: RNView | null): Promise<FlightRect | null> {
  return new Promise((resolve) => {
    if (ref === null) {
      resolve(null);
      return;
    }
    ref.measureInWindow((x, y, width, height) => resolve(width > 0 || height > 0 ? { x, y, width, height } : null));
  });
}

export function SessionLiveScreen() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const sim = useSimInstance();
  const focused = useIsFocused();
  const appActive = useMotionState((s) => s.appActive);
  const paused = !focused || !appActive;
  const settings = useMotionSettings();
  const policy = useMotionPolicy();
  const { layoutClass } = useLayoutClass();
  const arrangement = monitorArrangement(layoutClass);

  const session = useMonitorSession();
  const { activeCameraId, cameras } = useMonitorCameras();
  const mics = useMonitorMics();
  const events = useMonitorTimeline();
  const readOnly = useCoreLinkReadOnly();
  const actions = useMonitorActions();

  // §3.6: while RECORDING, every way back asks first; leaving never touches the session.
  const recording = session.state === 'RECORDING';
  const guard = useBackGuard({ enabled: recording });
  const dialogGuard = useRootBackPrompt(guard, recording && focused);

  const [sheet, setSheet] = useState<SheetName | null>(null);
  const [monitoringPaused, setMonitoringPaused] = useState(false);
  const [meterVariant, setMeterVariant] = useState<MeterVariant>('card');
  const [shutterSignal, setShutterSignal] = useState(0);
  const [snapshotSignal, setSnapshotSignal] = useState(0);
  // One camera command at a time for the three camera controls (feed tap, tabs, settings sheet).
  const cameraPress = usePendingPress();
  const [seenEvents, setSeenEvents] = useState(session.timelineLength);
  const [flight, setFlight] = useState<MarkerFlightSpec | null>(null);

  const rootRef = useRef<RNView>(null);
  const bookmarkRef = useRef<RNView>(null);
  const historyRef = useRef<RNView>(null);
  const timelineRef = useRef<RNView>(null);
  const flightKey = useRef(0);

  const items: TimelineItem[] = timelineItems(events).map((item) => ({
    id: item.id,
    at: item.at,
    title: t(`session.timeline.kind.${item.kind}`),
    tone: item.tone,
    ...(item.detail ? { detail: item.detail } : {}),
  }));
  const inlineTimeline = showsInlineTimeline(arrangement);
  const unseen = inlineTimeline ? 0 : unseenCount(session.timelineLength, seenEvents);

  const openSheet = (name: SheetName) => {
    triggerHaptic('primaryPress');
    if (name === 'timeline') setSeenEvents(session.timelineLength);
    setSheet(name);
  };
  const closeSheet = () => {
    // Events that arrived while the timeline was open count as seen.
    if (sheet === 'timeline') setSeenEvents(sim.store.getState().session?.timeline.length ?? 0);
    setSheet(null);
  };

  const onBack = dialogGuard.requestBack;

  // S2-1 Snapshot. Simulated mode: `ok` runs before `snapshot` returns, so the flash, the flight, the
  // pop and the toast play together as before. Live mode: the flash at the press, the rest on the settle.
  const onSnapshot = (release: () => void) => {
    let settled = false;
    let flashed = false;
    actions.snapshot({
      ok: () => {
        if (!flashed) setShutterSignal((n) => n + 1);
        setSnapshotSignal((n) => n + 1);
        toast.show({ variant: 'success', label: t('session.actions.snapshot.captured'), ...CONFIRM_TOAST });
      },
      done: () => {
        settled = true;
        release();
      },
    });
    if (!settled) {
      // LB-4: the Core has not answered yet. The flash changes no record; a refusal leaves nothing of
      // it once its 180 ms are over, and the toast says why.
      flashed = true;
      setShutterSignal((n) => n + 1);
    }
  };

  // S2-1 Marker, then S4-2: the timeline's newest node is read in `ok`, where the store already holds
  // the marker (CL-16), in both modes.
  const onAddMarker = (label: string | undefined, { added, done }: { added: () => void; done: () => void }) => {
    actions.addMarker(label, {
      ok: () => {
        const state = sim.store.getState();
        const node = state.session?.timeline.at(-1);
        const shown = node?.label ?? label ?? '';
        toast.show({
          variant: 'success',
          label: t('session.actions.addMarker.added', { time: timelineTime(node?.at ?? sim.clock.now()) }),
          ...CONFIRM_TOAST,
        });
        // M-C-17: fly a chip from the Bookmark tile to the History icon (phone) or the inline timeline.
        if (settings.policy === 'full') {
          const target = inlineTimeline ? timelineRef.current : historyRef.current;
          void Promise.all([measure(rootRef.current), measure(bookmarkRef.current), measure(target)]).then(([root, from, to]) => {
            if (!root || !from || !to) return;
            flightKey.current += 1;
            const shift = (r: FlightRect): FlightRect => ({ ...r, x: r.x - root.x, y: r.y - root.y });
            setFlight({ key: flightKey.current, from: shift(from), to: shift(to), label: shown });
          });
        }
        added();
      },
      done,
    });
  };
  const onFlightDone = useCallback(() => setFlight(null), []);

  // S2-1 End Session. Route-sync (step 73) and the route's own redirect take the screen to
  // /session/finalizing once the store holds STOPPING; the Dialog handles its own outcome.
  const onEnd = (reason: string, handlers: MonitorHandlers) => {
    actions.endSession(reason, handlers);
  };
  // Results ignored, as before ([CS:S2-1]); a refusal is still shown and logged by the wrapper.
  const onClipReset = (channel: AudioTrackId, release: () => void) => {
    actions.resetClip(channel, { done: release });
  };
  const onSwitchCamera = (cameraId: VideoTrackId) => {
    cameraPress.run((release) => actions.setActiveCamera(cameraId, { done: release }));
  };

  // --- Regions -------------------------------------------------------------------------------
  const feed = (
    <LiveFeed
      activeCameraId={activeCameraId}
      cameras={cameras}
      paused={paused}
      monitoringPaused={monitoringPaused}
      cameraTabs={usesCameraTabs(arrangement)}
      onSwitchCamera={onSwitchCamera}
      cameraBusy={cameraPress.busy}
      shutterSignal={shutterSignal}
      snapshotSignal={snapshotSignal}
      snapshotCount={session.snapshotCount}
    />
  );
  const micCards = (direction: 'row' | 'column') => (
    <View style={direction === 'row' ? styles.micRow : styles.micColumn}>
      {mics.map((mic) => (
        <MicCard
          key={mic.id}
          mic={mic}
          variant={meterVariant}
          paused={paused || sheet === 'audio' || monitoringPaused}
          monitoringPaused={monitoringPaused}
          onClipReset={onClipReset}
          style={direction === 'column' ? styles.micColumnCard : undefined}
        />
      ))}
    </View>
  );
  const tiles = (layout: 'row' | 'grid') => (
    <ActionTiles
      layout={layout}
      readOnly={readOnly}
      markerPresentation={arrangement === 'stack' || arrangement === 'split' ? 'bottom-sheet' : 'popover'}
      onSnapshot={onSnapshot}
      onAddMarker={onAddMarker}
      onOpenAudioMonitor={() => openSheet('audio')}
      onOpenSettings={() => openSheet('settings')}
      bookmarkRef={bookmarkRef}
    />
  );
  const endSession = <EndSession disabled={readOnly} onEnd={onEnd} />;
  const timeline = (
    <View ref={timelineRef} collapsable={false} style={styles.timelineHost}>
      <SessionTimeline
        items={items}
        order="newest-first"
        motion={policy}
        emptyLabel={t('features.session-live.sheets.timelineEmpty')}
        testID="monitor-timeline"
      />
    </View>
  );

  const header = (
    <MonitorHeader
      arrangement={arrangement}
      sessionId={session.id}
      unseen={unseen}
      onBack={onBack}
      onHistory={inlineTimeline ? null : () => openSheet('timeline')}
      historyRef={historyRef}
    />
  );

  return (
    <SafeScreen id="session-live" style={styles.root}>
      <View ref={rootRef} collapsable={false} style={styles.fill}>
        {header}
        <View style={styles.banner}>
          <ConnectionBanner />
        </View>
        <MonitorBody
          arrangement={arrangement}
          paused={paused}
          feed={feed}
          micCards={micCards}
          tiles={tiles}
          endSession={endSession}
          timeline={timeline}
        />
        <MarkerFlight flight={flight} onDone={onFlightDone} />
      </View>

      <BackGuardDialog guard={dialogGuard.guard} variant="monitor" />
      <TimelineSheet isOpen={sheet === 'timeline'} onClose={closeSheet} items={items} />
      <AudioMonitorSheet
        isOpen={sheet === 'audio'}
        onClose={closeSheet}
        mics={mics}
        monitoringPaused={monitoringPaused}
        onClipReset={onClipReset}
      />
      <MonitorSettingsSheet
        isOpen={sheet === 'settings'}
        onClose={closeSheet}
        monitoringPaused={monitoringPaused}
        onMonitoringPausedChange={setMonitoringPaused}
        activeCameraId={activeCameraId}
        cameras={cameras}
        onSwitchCamera={onSwitchCamera}
        meterVariant={meterVariant}
        onMeterVariantChange={setMeterVariant}
      />
    </SafeScreen>
  );
}

// ---------------------------------------------------------------------------------------------
// Back with nothing underneath (F-79-1)
// ---------------------------------------------------------------------------------------------

interface RootBackPrompt {
  /** The guard the Dialog reads: the stack guard, plus the prompt for a Back with no route below. */
  guard: BackGuard;
  /** The header arrow: pop when there is a screen below (the stack guard asks), else ask here. */
  requestBack: () => void;
}

/**
 * The step-70 guard (`usePreventRemove`) asks when Back would REMOVE the monitor. After a sign-in or
 * relaunch the router replaces straight to `/session/live` (§3.7 resync), so no route may sit
 * below it; Android's Back then has nothing to pop and falls through to the OS, which leaves the
 * app without asking (found on dems_phone, F-79-1). While RECORDING and focused, this hook takes
 * the hardware Back first: with a route below it lets the stack pop (the guard asks); with none it
 * opens the same Dialog itself, and "Go to Home" goes through the guard's `leaveTo('/home')`
 * (`dismissTo`, which replaces when Home is not in the history). A Back while the Dialog is open
 * means "Stay". Nothing here touches the session.
 */
function useRootBackPrompt(guard: BackGuard, active: boolean): RootBackPrompt {
  const router = useRouter();
  const [rootPrompt, setRootPrompt] = useState(false);
  const prompting = guard.isPrompting || (rootPrompt && active);

  const stay = () => {
    setRootPrompt(false);
    guard.stay();
  };

  useEffect(() => {
    if (!active) return undefined;
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      if (prompting) {
        setRootPrompt(false);
        guard.stay();
        return true;
      }
      if (router.canGoBack()) return false; // the stack pops; usePreventRemove asks
      setRootPrompt(true);
      return true;
    });
    return () => subscription.remove();
  }, [active, prompting, guard, router]);

  return {
    guard: {
      isPrompting: prompting,
      stay,
      leave: () => {
        if (rootPrompt) {
          setRootPrompt(false);
          guard.leaveTo('/home');
        } else {
          guard.leave();
        }
      },
      leaveTo: (href) => {
        setRootPrompt(false);
        guard.leaveTo(href);
      },
    },
    requestBack: () => {
      if (router.canGoBack()) router.back();
      else if (active) setRootPrompt(true);
      else router.replace('/home');
    },
  };
}

// ---------------------------------------------------------------------------------------------
// Header (S1)
// ---------------------------------------------------------------------------------------------

interface MonitorHeaderProps {
  arrangement: MonitorArrangement;
  sessionId: string | null;
  unseen: number;
  onBack: () => void;
  /** `null` on tablets (the timeline is inline). */
  onHistory: (() => void) | null;
  historyRef: React.RefObject<RNView | null>;
}

function MonitorHeader({ arrangement, sessionId, unseen, onBack, onHistory, historyRef }: MonitorHeaderProps) {
  const { t } = useTranslation();
  const settings = useMotionSettings();
  const condensed = arrangement === 'split';
  const pop = useSharedValue(1);
  const lastUnseen = useRef(unseen);
  useEffect(() => {
    if (unseen > lastUnseen.current && settings.policy === 'full') {
      pop.set(withSequence(withTiming(1.35, { duration: 0 }), withSpring(1, motionTokens.spring.bouncy)));
    }
    lastUnseen.current = unseen;
  }, [unseen, settings.policy, pop]);
  const popStyle = useAnimatedStyle(() => ({ transform: [{ scale: pop.get() }] }));

  return (
    <Animated.View entering={enterRise(0, settings)} style={[styles.header, condensed ? styles.headerCondensed : null]}>
      <Button
        testID="monitor-back"
        isIconOnly
        size="lg"
        variant="ghost"
        onPress={onBack}
        accessibilityLabel={t('features.session-live.back')}
      >
        <ArrowLeft size={24} color={palette.gold} />
      </Button>
      <View style={styles.headerTitle}>
        <Text accessibilityRole="header" maxFontSizeMultiplier={1.2} numberOfLines={1} style={styles.title}>
          {t('features.session-live.title')}
        </Text>
        {sessionId && !condensed ? (
          <Text maxFontSizeMultiplier={1.2} numberOfLines={1} style={styles.sessionId} testID="monitor-session-id">
            {sessionId}
          </Text>
        ) : null}
      </View>
      {onHistory ? (
        <View ref={historyRef} collapsable={false}>
          <Button
            testID="monitor-history"
            isIconOnly
            size="lg"
            variant="ghost"
            onPress={onHistory}
            accessibilityLabel={t('features.session-live.history')}
            accessibilityHint={t('features.session-live.historyHint')}
          >
            <History size={24} color={palette.gold} />
          </Button>
          {unseen > 0 ? (
            <Animated.View pointerEvents="none" style={[styles.badge, popStyle]} testID="monitor-history-badge">
              <Text
                maxFontSizeMultiplier={1.2}
                style={styles.badgeText}
                accessibilityLabel={t('features.session-live.historyBadge', { count: unseen })}
              >
                {unseen > 9 ? '9+' : String(unseen)}
              </Text>
            </Animated.View>
          ) : null}
        </View>
      ) : null}
    </Animated.View>
  );
}

/** Settle delay for `useSettledKey`: after the §7.3 enter beats (≤ 260 ms + a 600 ms fade). */
const SETTLE_MS = 900;

/** `'initial'`, then `'settled'` once, `SETTLE_MS` after mount (only while `enabled`). */
function useSettledKey(enabled: boolean): string {
  const [settled, setSettled] = useState(false);
  useEffect(() => {
    if (!enabled) return undefined;
    const timer = setTimeout(() => setSettled(true), SETTLE_MS);
    return () => clearTimeout(timer);
  }, [enabled]);
  return settled ? 'settled' : 'initial';
}

// ---------------------------------------------------------------------------------------------
// Body per arrangement (04 §2.4)
// ---------------------------------------------------------------------------------------------

interface MonitorBodyProps {
  arrangement: MonitorArrangement;
  paused: boolean;
  feed: ReactNode;
  micCards: (direction: 'row' | 'column') => ReactNode;
  tiles: (layout: 'row' | 'grid') => ReactNode;
  endSession: ReactNode;
  timeline: ReactNode;
}

function MonitorBody({ arrangement, paused, feed, micCards, tiles, endSession, timeline }: MonitorBodyProps) {
  const { t } = useTranslation();
  const settings = useMotionSettings();
  const window = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const rise = (index: number, afterMs: number) => enterRise(index, settings, { afterMs });
  // Column widths are computed, not left to flex ratios: with flex ratios the 16:9 feed sized its
  // column from the row's height on dems_phone landscape and overflowed the screen (step 79 device run).
  const metersKey = useSettledKey(arrangement === 'tablet-landscape');
  const widths = monitorColumnWidths(arrangement, {
    width: window.width - insets.left - insets.right,
    height: window.height - insets.top - insets.bottom,
  });

  if (arrangement === 'stack') {
    return (
      <>
        <ScrollView style={styles.fill} contentContainerStyle={styles.stackContent}>
          <RecRow paused={paused} />
          <StatusStrip />
          <Animated.View entering={rise(0, BEAT.feed)}>
            <Pane name="feed">{feed}</Pane>
          </Animated.View>
          <Animated.View entering={rise(0, BEAT.mics)}>
            <Pane name="meters">{micCards('row')}</Pane>
          </Animated.View>
          <Animated.View entering={rise(0, BEAT.actions)}>{tiles('row')}</Animated.View>
        </ScrollView>
        <Animated.View entering={rise(0, BEAT.end)} style={styles.pinned}>
          {endSession}
        </Animated.View>
      </>
    );
  }

  if (arrangement === 'split') {
    return (
      <View style={styles.splitRow}>
        <Animated.View entering={rise(0, BEAT.feed)} style={[styles.splitFeed, { width: widths.feed }]}>
          <Pane name="feed">{feed}</Pane>
        </Animated.View>
        <ScrollView style={styles.splitSide} contentContainerStyle={styles.splitSideContent}>
          <RecRow paused={paused} timerSize="h1" />
          <Animated.View entering={rise(0, BEAT.mics)}>
            <Pane name="meters">{micCards('row')}</Pane>
          </Animated.View>
          <Animated.View entering={rise(0, BEAT.actions)}>{tiles('grid')}</Animated.View>
          <Animated.View entering={rise(0, BEAT.end)}>{endSession}</Animated.View>
        </ScrollView>
      </View>
    );
  }

  if (arrangement === 'tablet-portrait') {
    return (
      <>
        <ScrollView style={styles.fill} contentContainerStyle={styles.tabletContent}>
          <RecRow paused={paused} />
          <Animated.View entering={rise(0, BEAT.feed)}>
            <Pane name="feed">
              <SectionCard title={t('session.feed.title')}>{feed}</SectionCard>
            </Pane>
          </Animated.View>
          <Animated.View entering={rise(0, BEAT.actions)}>{tiles('row')}</Animated.View>
          <View style={styles.twoColumns}>
            <Animated.View entering={rise(0, BEAT.mics)} style={styles.column}>
              <Pane name="meters">
                <SectionCard title={t('session.audio.title')}>{micCards('column')}</SectionCard>
              </Pane>
            </Animated.View>
            <Animated.View entering={rise(1, BEAT.mics)} style={styles.column}>
              <Pane name="timeline">
                <SectionCard title={t('features.session-live.strip.label')}>
                  <StatusStrip direction="column" />
                </SectionCard>
                <SectionCard title={t('session.timeline.title')} style={styles.timelineCard}>
                  {timeline}
                </SectionCard>
              </Pane>
            </Animated.View>
          </View>
        </ScrollView>
        <Animated.View entering={rise(0, BEAT.end)} style={styles.pinnedTablet}>
          {endSession}
        </Animated.View>
      </>
    );
  }

  // tablet-landscape: feed 58% | timer + meters + status | timeline + actions (+ End Session).
  return (
    <View style={styles.threeColumns}>
      <Animated.View entering={rise(0, BEAT.feed)} style={{ width: widths.feed }}>
        <Pane name="feed">
          <SectionCard title={t('session.feed.title')}>
            {feed}
            <StatusStrip />
          </SectionCard>
        </Pane>
      </Animated.View>
      {/* A plain column (it fits 800 dp): inside a ScrollView the meters' canvases were measured
          before the content width existed and stayed blank after a remount on dems_tablet. */}
      <Animated.View entering={rise(1, BEAT.mics)} style={{ width: widths.side }}>
        <View style={styles.colScroll}>
          <SectionCard>
            <View style={styles.timerCard}>
              <View style={styles.timerHead}>
                <RecDot paused={paused} />
                <Text maxFontSizeMultiplier={1.2} style={styles.recLabel}>
                  {t('common.enums.sessionState.RECORDING')}
                </Text>
              </View>
              <RecTimer testID="monitor-timer" />
            </View>
          </SectionCard>
          <Pane name="meters">
            <SectionCard title={t('session.audio.title')}>
              {/* Remounted once after the column settles: on dems_tablet the meters in this column
                  stayed blank from their first mount until a re-render (step 79 device run). */}
              <View key={metersKey}>{micCards('column')}</View>
            </SectionCard>
          </Pane>
          <SectionCard title={t('features.session-live.strip.label')}>
            <StatusStrip direction="column" />
          </SectionCard>
        </View>
      </Animated.View>
      <Animated.View entering={rise(2, BEAT.actions)} style={[styles.colLast, { width: widths.side }]}>
        <View style={styles.colRight}>
          <Pane name="timeline" style={styles.fill}>
            <SectionCard title={t('session.timeline.title')} style={styles.fill}>
              <ScrollView style={styles.timelineScroll}>{timeline}</ScrollView>
            </SectionCard>
          </Pane>
          {tiles('grid')}
          {endSession}
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { backgroundColor: palette.black },
  fill: { flex: 1 },
  banner: { paddingHorizontal: spacing[3] },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[1],
    paddingHorizontal: spacing[1],
    minHeight: 64,
    borderBottomWidth: 1,
    borderBottomColor: derived.separator,
  },
  headerCondensed: { minHeight: 48 },
  headerTitle: { flex: 1, minWidth: 0 },
  title: {
    fontFamily: fontFamily.native.semibold,
    fontSize: typography.h2.size,
    lineHeight: typography.h2.lineHeight,
    color: palette.foreground,
  },
  sessionId: {
    fontFamily: fontFamily.native.mono,
    fontSize: typography.data.size,
    lineHeight: typography.data.lineHeight,
    color: palette.gray,
  },
  badge: {
    position: 'absolute',
    top: 6,
    right: 6,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    paddingHorizontal: 4,
    backgroundColor: palette.gold,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: { fontFamily: fontFamily.native.bold, fontSize: 11, lineHeight: 14, color: palette.black },
  // Phone portrait (MB 4).
  stackContent: { padding: spacing[3], gap: spacing[2] },
  micRow: { flexDirection: 'row', gap: spacing[1] },
  micColumn: { gap: spacing[1] },
  micColumnCard: { flex: 0 },
  pinned: { paddingHorizontal: spacing[3], paddingTop: spacing[1], paddingBottom: spacing[1] },
  // Phone landscape.
  splitRow: { flex: 1, flexDirection: 'row', gap: spacing[3], padding: spacing[2] },
  splitFeed: { justifyContent: 'center' },
  splitSide: { flex: 1, minWidth: 0 },
  splitSideContent: { gap: spacing[2], paddingBottom: spacing[2] },
  // Tablet portrait.
  tabletContent: { padding: spacing[4], gap: spacing[3] },
  twoColumns: { flexDirection: 'row', gap: spacing[4], alignItems: 'flex-start' },
  column: { flex: 1, gap: spacing[3] },
  timelineCard: { marginTop: spacing[3] },
  timelineHost: { minHeight: 80 },
  pinnedTablet: { paddingHorizontal: spacing[4], paddingVertical: spacing[2], alignSelf: 'stretch' },
  // Tablet landscape.
  threeColumns: { flex: 1, flexDirection: 'row', gap: spacing[3], padding: spacing[3] },
  colLast: { flex: 1 },
  colScroll: { gap: spacing[2], paddingBottom: spacing[2] },
  colRight: { flex: 1, gap: spacing[2] },
  timelineScroll: { maxHeight: 360 },
  timerCard: { gap: spacing[0] },
  timerHead: { flexDirection: 'row', alignItems: 'center' },
  recLabel: {
    fontFamily: fontFamily.native.semibold,
    fontSize: typography.h3.size,
    lineHeight: typography.h3.lineHeight,
    color: statusText.danger,
  },
});
