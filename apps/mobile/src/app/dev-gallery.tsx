/**
 * Debug-only gallery of the step-71 compositions and asset renderers (05_mobile_plan M-04).
 * Created once by step 71; step 70 owns src/app/** afterwards (P6) and keeps this route public.
 *
 *   demsdemo:///dev-gallery?section=rings|meters|numbers|steps|timeline|media&motion=full|reduced|off
 *
 * `motion=off` (or `reduced`) is the D43 test switch: ambient loops stop, meters stay functional.
 * Fake data follows the real paths: audio frames are written into shared values at 20 Hz from JS
 * (04 §5.4), timers tick at 1 Hz. Release builds redirect home.
 */
import { Redirect, useIsFocused, useLocalSearchParams } from 'expo-router';
import { Button, Card, Chip, Surface, Switch, Typography } from 'heroui-native';
import { useEffect, useState, type ReactNode } from 'react';
import { ScrollView, Text, View, useWindowDimensions } from 'react-native';
import { useSharedValue } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import { DISPLAY_UTC_OFFSET_MINUTES } from '@dems/shared/realtime';
import { palette } from '@dems/shared/tokens';
import { DbfsMeter } from '@/components/composed/dbfs-meter';
import { DBFS_FLOOR } from '@/components/composed/dbfs-meter.math';
import { GlowRing, type GlowRingState } from '@/components/composed/glow-ring';
import { RollingNumber } from '@/components/composed/rolling-number';
import { SessionTimeline, type TimelineItem } from '@/components/composed/session-timeline';
import { Stepper, type StepStatus } from '@/components/composed/stepper';
import { CameraFeed, Emblem, EmblemDraw, HeroBackdrop } from '@/components/media';
import { seededRandom } from '@/components/media/hero-backdrop.math';

type Motion = 'full' | 'reduced';
const SECTIONS = ['rings', 'meters', 'numbers', 'steps', 'timeline', 'media'] as const;
type Section = (typeof SECTIONS)[number];
const SECTION_LABEL: Record<Section, string> = {
  rings: 'Glow ring',
  meters: 'dBFS meters',
  numbers: 'Rolling numbers',
  steps: 'Stepper',
  timeline: 'Timeline',
  media: 'Media',
};
const RING_STATES: GlowRingState[] = ['ready', 'attention', 'critical', 'offline', 'recording'];

function parseMotion(value: string | undefined): Motion {
  return value === 'off' || value === 'reduced' ? 'reduced' : 'full';
}

function parseSection(value: string | undefined): Section {
  return SECTIONS.find((s) => s === value) ?? 'rings';
}

export default function DevGalleryRoute() {
  const params = useLocalSearchParams<{ motion?: string; section?: string }>();
  if (!__DEV__) return <Redirect href="/" />;
  // A new deep link to this route reuses the mounted screen with new params; keying remounts it,
  // so `?section=` and the D43 `?motion=off` switch always apply.
  const motion = parseMotion(params.motion);
  const section = parseSection(params.section);
  return <DevGallery key={`${section}:${motion}`} initialMotion={motion} initialSection={section} />;
}

function DevGallery({ initialMotion, initialSection }: { initialMotion: Motion; initialSection: Section }) {
  const [motion, setMotion] = useState<Motion>(initialMotion);
  const [section, setSection] = useState<Section>(initialSection);
  const focused = useIsFocused();
  const paused = !focused;
  const { width } = useWindowDimensions();
  const wide = width >= 840;

  return (
    <SafeAreaView testID="screen-dev-gallery" style={{ flex: 1, backgroundColor: palette.black }}>
      <ScrollView stickyHeaderIndices={[0]} contentContainerStyle={{ paddingBottom: 48 }}>
        <View style={{ backgroundColor: palette.black, paddingHorizontal: 20, paddingTop: 16, paddingBottom: 12, gap: 12 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <Emblem size={26} />
              <View>
                <Text className="font-display text-h3 text-accent">DEV GALLERY</Text>
                <Text className="text-caption text-muted">Step 71 compositions · debug build only</Text>
              </View>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Text className="text-caption text-muted">Reduce motion</Text>
              <Switch
                testID="gallery-motion-switch"
                isSelected={motion === 'reduced'}
                onSelectedChange={(on) => setMotion(on ? 'reduced' : 'full')}
              />
            </View>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
            {SECTIONS.map((s) => (
              <Chip
                key={s}
                testID={`gallery-tab-${s}`}
                variant={s === section ? 'primary' : 'secondary'}
                color={s === section ? 'accent' : 'default'}
                onPress={() => setSection(s)}
                accessibilityRole="tab"
                accessibilityState={{ selected: s === section }}
              >
                <Chip.Label>{SECTION_LABEL[s]}</Chip.Label>
              </Chip>
            ))}
          </ScrollView>
        </View>
        <View style={{ paddingHorizontal: 20, gap: 16, width: '100%', maxWidth: 820, alignSelf: 'center' }}>
          {section === 'rings' ? <RingsSection motion={motion} paused={paused} wide={wide} /> : null}
          {section === 'meters' ? <MetersSection motion={motion} paused={paused} wide={wide} /> : null}
          {section === 'numbers' ? <NumbersSection motion={motion} paused={paused} /> : null}
          {section === 'steps' ? <StepsSection motion={motion} /> : null}
          {section === 'timeline' ? <TimelineSection motion={motion} /> : null}
          {section === 'media' ? <MediaSection motion={motion} paused={paused} wide={wide} /> : null}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function Panel({ id, title, caption, children }: { id: string; title: string; caption?: string; children: ReactNode }) {
  return (
    <Card testID={`gallery-${id}`} className="rounded-xl">
      <Card.Header>
        <Card.Title>{title}</Card.Title>
        {caption ? <Card.Description>{caption}</Card.Description> : null}
      </Card.Header>
      <Card.Body style={{ gap: 16 }}>{children}</Card.Body>
    </Card>
  );
}

function Row({ children, wrap = true }: { children: ReactNode; wrap?: boolean }) {
  return <View style={{ flexDirection: 'row', flexWrap: wrap ? 'wrap' : 'nowrap', gap: 10, alignItems: 'center' }}>{children}</View>;
}

// ---------------------------------------------------------------------------------------------
// C-1 GlowRing
// ---------------------------------------------------------------------------------------------

function RingsSection({ motion, paused, wide }: { motion: Motion; paused: boolean; wide: boolean }) {
  const [state, setState] = useState<GlowRingState>('ready');
  const [replay, setReplay] = useState(0);
  const recording = state === 'recording';
  return (
    <Panel id="rings" title="C-1 GlowRing" caption="Tick ring rotation, arc sweep, breathing glow, state morph with one bloom on escalation.">
      <View style={{ flexDirection: wide ? 'row' : 'column', alignItems: 'center', gap: 24, justifyContent: 'center' }}>
        <GlowRing mode="hero" size={280} state={state} motion={motion} paused={paused} replayKey={replay} accessibilityLabel={`System ${state}`}>
          <View style={{ alignItems: 'center', gap: 6 }}>
            <Emblem size={52} />
            <Text className="text-label uppercase text-muted">System</Text>
            <Text className="font-display text-h2 text-accent">{recording ? 'REC' : state.toUpperCase()}</Text>
          </View>
        </GlowRing>
        <View style={{ alignItems: 'center', gap: 12 }}>
          <GlowRing mode="mini" size={96} state={state} motion={motion} paused={paused} replayKey={replay} />
          <Typography type="body-xs" color="muted">
            mini (no rotation)
          </Typography>
        </View>
      </View>
      <Row>
        {RING_STATES.map((s) => (
          <Chip key={s} variant={s === state ? 'primary' : 'secondary'} color={s === state ? 'accent' : 'default'} onPress={() => setState(s)}>
            <Chip.Label>{s}</Chip.Label>
          </Chip>
        ))}
      </Row>
      <Button variant="outline" onPress={() => setReplay((n) => n + 1)}>
        <Button.Label>Replay sweep</Button.Label>
      </Button>
    </Panel>
  );
}

// ---------------------------------------------------------------------------------------------
// C-2 DbfsMeter
// ---------------------------------------------------------------------------------------------

/** Speech-like fake audio written into shared values at 20 Hz from JS (the real runtime path, 04 §5.4). */
function useFakeAudio(seed: number, running: boolean) {
  const level = useSharedValue(DBFS_FLOOR);
  const clip = useSharedValue(0);
  useEffect(() => {
    if (!running) {
      level.set(DBFS_FLOOR);
      return;
    }
    const rand = seededRandom(seed);
    let t = 0;
    let base = -24;
    const id = setInterval(() => {
      t += 50;
      base = Math.max(-32, Math.min(-14, base + (rand() - 0.5) * 1.6));
      const envelope = Math.max(0, Math.sin(t / 160 + seed) * Math.sin(t / 610 + seed * 2));
      level.set(base - 8 + envelope * 16 + (rand() - 0.5) * 2.5);
    }, 50);
    return () => clearInterval(id);
  }, [seed, running, level]);
  return { level, clip };
}

function MetersSection({ motion, paused, wide }: { motion: Motion; paused: boolean; wide: boolean }) {
  const [mic1Signal, setMic1Signal] = useState(true);
  const [monitoringPaused, setMonitoringPaused] = useState(false);
  const mic1 = useFakeAudio(3, mic1Signal && !paused);
  const mic2 = useFakeAudio(11, !paused);

  const clipMic2 = () => {
    mic2.clip.set(1);
    mic2.level.set(-1);
  };

  return (
    <Panel id="meters" title="C-2 DbfsMeter" caption="20 Hz shared values, spring-smoothed on the UI thread, 1.5 s peak hold, 4 Hz readout, zero React renders per frame.">
      <View style={{ flexDirection: wide ? 'row' : 'column', gap: 12 }}>
        {[
          { name: 'MIC 1', audio: mic1, signal: mic1Signal },
          { name: 'MIC 2', audio: mic2, signal: true },
        ].map(({ name, audio, signal }) => (
          <Surface key={name} variant="secondary" className="rounded-xl" style={{ flex: 1, padding: 14, gap: 10 }}>
            <Text className="text-label uppercase text-foreground">{name}</Text>
            <DbfsMeter
              testID={`gallery-meter-${name.replace(' ', '').toLowerCase()}`}
              level={audio.level}
              clip={audio.clip}
              motion={motion}
              paused={paused}
              signal={signal ? 'ok' : 'no-signal'}
              monitoringPaused={monitoringPaused}
              onClipReset={() => audio.clip.set(0)}
              accessibilityLabel={`${name} level`}
            />
          </Surface>
        ))}
      </View>
      <Surface variant="secondary" className="rounded-xl" style={{ padding: 14, gap: 10 }}>
        <Text className="text-label uppercase text-muted">Large (audio monitor sheet)</Text>
        <DbfsMeter level={mic2.level} clip={mic2.clip} variant="large" motion={motion} paused={paused} onClipReset={() => mic2.clip.set(0)} />
        <Text className="text-label uppercase text-muted">Compact (device tile)</Text>
        <DbfsMeter level={mic1.level} variant="compact" motion={motion} paused={paused} signal={mic1Signal ? 'ok' : 'no-signal'} />
      </Surface>
      <Row>
        <Button size="sm" variant="danger-soft" onPress={clipMic2}>
          <Button.Label>Clip MIC 2</Button.Label>
        </Button>
        <Button size="sm" variant="outline" onPress={() => setMic1Signal((s) => !s)}>
          <Button.Label>{mic1Signal ? 'MIC 1 no signal' : 'MIC 1 signal back'}</Button.Label>
        </Button>
        <Button size="sm" variant="outline" onPress={() => setMonitoringPaused((p) => !p)}>
          <Button.Label>{monitoringPaused ? 'Resume monitoring' : 'Pause monitoring'}</Button.Label>
        </Button>
      </Row>
    </Panel>
  );
}

// ---------------------------------------------------------------------------------------------
// C-6 RollingNumber
// ---------------------------------------------------------------------------------------------

function secondsOfLocalDay(nowMs: number): number {
  return Math.floor((nowMs + DISPLAY_UTC_OFFSET_MINUTES * 60_000) / 1000) % 86_400;
}

function NumbersSection({ motion, paused }: { motion: Motion; paused: boolean }) {
  const timer = useSharedValue(1458); // 00:24:18 (MB 4)
  const clock = useSharedValue(0);
  const [kpi, setKpi] = useState(20);
  const [bandwidth, setBandwidth] = useState(12.4);

  useEffect(() => {
    clock.set(secondsOfLocalDay(Date.now()));
    if (paused) return;
    const id = setInterval(() => {
      timer.set(timer.get() + 1);
      clock.set(secondsOfLocalDay(Date.now()));
    }, 1000);
    return () => clearInterval(id);
  }, [paused, timer, clock]);

  return (
    <Panel id="numbers" title="C-6 RollingNumber" caption="slide: per-digit odometer columns on the UI thread; count: counter spring after the 120 ms held beat.">
      <Surface variant="secondary" className="rounded-xl" style={{ padding: 16, gap: 6 }}>
        <Text className="text-label uppercase text-muted">Session timer (shared value, 1 Hz)</Text>
        <RollingNumber value={timer} format={{ kind: 'duration' }} motion={motion} color={palette.foreground} accessibilityLabel="Session timer" />
      </Surface>
      <Surface variant="secondary" className="rounded-xl" style={{ padding: 16, gap: 6 }}>
        <Text className="text-label uppercase text-muted">System time, UTC+07:00</Text>
        <RollingNumber value={clock} format={{ kind: 'clock' }} motion={motion} color={palette.gold} accessibilityLabel="System time" />
      </Surface>
      <Row>
        <Surface variant="secondary" className="rounded-xl" style={{ padding: 16, gap: 4, minWidth: 140 }}>
          <Text className="text-label uppercase text-muted">Storage used</Text>
          <RollingNumber value={kpi} mode="count" size="h1" face="sans" suffix="%" motion={motion} />
        </Surface>
        <Surface variant="secondary" className="rounded-xl" style={{ padding: 16, gap: 4, minWidth: 140 }}>
          <Text className="text-label uppercase text-muted">Bandwidth</Text>
          <RollingNumber value={bandwidth} mode="slide" size="h2" face="mono" format={{ kind: 'decimal', decimals: 1 }} suffix=" Mbps" motion={motion} />
        </Surface>
      </Row>
      <Button
        variant="outline"
        onPress={() => {
          setKpi((v) => (v >= 90 ? 20 : v + 17));
          setBandwidth((v) => Math.round((v + 3.7) * 10) / 10);
        }}
      >
        <Button.Label>Change values</Button.Label>
      </Button>
    </Panel>
  );
}

// ---------------------------------------------------------------------------------------------
// C-4 Stepper
// ---------------------------------------------------------------------------------------------

const WIZARD = [
  { key: 'info', label: 'Session Info' },
  { key: 'check', label: 'Devices Check' },
  { key: 'ready', label: 'Ready' },
];
const PIPELINE = [
  { key: 'close', label: 'Close tracks', description: 'Finalise both video and audio tracks' },
  { key: 'hash', label: 'Hash tracks', description: 'SHA-256 per track' },
  { key: 'manifest', label: 'Build manifest' },
  { key: 'sign', label: 'Sign manifest', description: 'Simulated signature' },
  { key: 'seal', label: 'Seal evidence' },
];

function StepsSection({ motion }: { motion: Motion }) {
  const [current, setCurrent] = useState(0);
  const [pipeline, setPipeline] = useState<StepStatus[]>(PIPELINE.map(() => 'pending'));
  const [runId, setRunId] = useState(0);

  useEffect(() => {
    if (runId === 0) return;
    const timers: ReturnType<typeof setTimeout>[] = [];
    PIPELINE.forEach((_, i) => {
      timers.push(setTimeout(() => setPipeline((p) => p.map((s, j) => (j === i ? 'running' : s))), i * 900));
      timers.push(setTimeout(() => setPipeline((p) => p.map((s, j) => (j === i ? 'done' : s))), i * 900 + 800));
    });
    return () => timers.forEach(clearTimeout);
  }, [runId]);

  return (
    <Panel id="steps" title="C-4 Stepper" caption="Wizard (MB 3) and pipeline variants; connector fill, check draw, one halo pulse per activation.">
      <Stepper steps={WIZARD} current={current} motion={motion} testID="gallery-wizard" onStepPress={setCurrent} />
      <Row>
        <Button size="sm" variant="outline" isDisabled={current === 0} onPress={() => setCurrent((c) => Math.max(0, c - 1))}>
          <Button.Label>Back</Button.Label>
        </Button>
        <Button size="sm" variant="primary" onPress={() => setCurrent((c) => (c >= WIZARD.length ? 0 : c + 1))}>
          <Button.Label>{current >= WIZARD.length ? 'Restart' : 'Next'}</Button.Label>
        </Button>
      </Row>
      <Stepper steps={PIPELINE} statuses={pipeline} orientation="vertical" motion={motion} testID="gallery-pipeline" />
      <Button
        variant="outline"
        onPress={() => {
          setPipeline(PIPELINE.map(() => 'pending'));
          setRunId((n) => n + 1);
        }}
      >
        <Button.Label>Run finalization pipeline</Button.Label>
      </Button>
    </Panel>
  );
}

// ---------------------------------------------------------------------------------------------
// C-3 SessionTimeline
// ---------------------------------------------------------------------------------------------

function TimelineSection({ motion }: { motion: Motion }) {
  const [items, setItems] = useState<TimelineItem[]>(() => {
    const now = Date.now();
    return [
      { id: 'start', at: now - 24 * 60_000, title: 'Recording started', detail: 'VIDEO 1, VIDEO 2, MIC 1, MIC 2', tone: 'danger' },
      { id: 'gnss', at: now - 23 * 60_000, title: 'Time source locked', detail: 'GNSS stratum-1', tone: 'success' },
      { id: 'm1', at: now - 12 * 60_000, title: 'Marker', detail: 'Subject enters the room', tone: 'info' },
    ];
  });
  const add = (kind: 'marker' | 'snapshot') =>
    setItems((list) => [
      ...list,
      {
        id: `${kind}-${list.length + 1}`,
        at: Date.now(),
        title: kind === 'marker' ? 'Marker' : 'Snapshot',
        detail: kind === 'marker' ? `Bookmark ${list.length + 1}` : 'CAM 1 frame captured',
        tone: kind === 'marker' ? 'info' : 'accent',
      },
    ]);
  return (
    <Panel id="timeline" title="C-3 SessionTimeline" caption="Insertion: the line grows, the node pops, the text rises; the newest halo pulses twice.">
      <SessionTimeline items={items} motion={motion} testID="gallery-timeline" />
      <Row>
        <Button size="sm" variant="outline" onPress={() => add('marker')}>
          <Button.Label>Add marker</Button.Label>
        </Button>
        <Button size="sm" variant="outline" onPress={() => add('snapshot')}>
          <Button.Label>Add snapshot</Button.Label>
        </Button>
      </Row>
    </Panel>
  );
}

// ---------------------------------------------------------------------------------------------
// Asset renderers
// ---------------------------------------------------------------------------------------------

function MediaSection({ motion, paused, wide }: { motion: Motion; paused: boolean; wide: boolean }) {
  const [camera, setCamera] = useState<'CAM-1' | 'CAM-2'>('CAM-1');
  const [noSignal, setNoSignal] = useState(false);
  const [drawKey, setDrawKey] = useState(0);
  const [scanning, setScanning] = useState(false);
  const [posterAt] = useState(() => Date.now() - 3_600_000);
  return (
    <>
      <Panel id="camera" title="CameraFeed" caption="Procedural placeholder room until step 72 wires the licensed still; Ken Burns, grain, scanline, burnt-in time.">
        <View style={{ flexDirection: wide ? 'row' : 'column', gap: 12 }}>
          <View style={{ flex: 1 }}>
            <CameraFeed cameraId={camera} motion={motion} paused={paused} noSignal={noSignal} testID="gallery-feed-live" />
          </View>
          <View style={{ flex: 1 }}>
            <CameraFeed cameraId="CAM-2" mode="poster" motion={motion} timestampBaseMs={posterAt} showTimestamp testID="gallery-feed-poster" />
          </View>
        </View>
        <Row>
          <Button size="sm" variant="outline" onPress={() => setCamera((c) => (c === 'CAM-1' ? 'CAM-2' : 'CAM-1'))}>
            <Button.Label>Switch to {camera === 'CAM-1' ? 'CAM 2' : 'CAM 1'}</Button.Label>
          </Button>
          <Button size="sm" variant="outline" onPress={() => setNoSignal((s) => !s)}>
            <Button.Label>{noSignal ? 'Restore signal' : 'Drop signal'}</Button.Label>
          </Button>
        </Row>
      </Panel>
      <Panel id="emblem" title="Emblem" caption="Placeholder path data (step 72 swaps in the shared brand module). Static SVG and the Skia draw.">
        <Row>
          <Emblem size={32} />
          <Emblem size={56} />
          <EmblemDraw size={112} motion={motion} replayKey={drawKey} scanning={scanning} testID="gallery-emblem-draw" />
        </Row>
        <Row>
          <Button size="sm" variant="outline" onPress={() => setDrawKey((k) => k + 1)}>
            <Button.Label>Replay draw</Button.Label>
          </Button>
          <Button size="sm" variant="outline" onPress={() => setScanning((s) => !s)}>
            <Button.Label>{scanning ? 'Stop scan' : 'Scan (sign-in pending)'}</Button.Label>
          </Button>
        </Row>
      </Panel>
      <Panel id="hero" title="HeroBackdrop" caption="Graded still (placeholder light here), topographic texture, light streaks, slow push-in.">
        <View style={{ height: 240, borderRadius: 12, overflow: 'hidden' }}>
          <HeroBackdrop motion={motion} paused={paused}>
            <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8 }}>
              <Emblem size={64} />
              <Text className="font-display text-h1 text-foreground">DEMS</Text>
              <Text className="font-display text-caption text-accent">EDGE CLIENT</Text>
            </View>
          </HeroBackdrop>
        </View>
      </Panel>
    </>
  );
}
