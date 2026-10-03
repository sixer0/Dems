import { useKeepAwake } from 'expo-keep-awake';
import { Button, Card, Chip, Skeleton, Surface, useToast } from 'heroui-native';
import { Activity } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { ScrollView, Text, View, useWindowDimensions, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { Easing, FadeInDown, FadeInUp, ReduceMotion } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import { HeartbeatStateLabel } from '@dems/shared/domain';
import { useHeartbeat } from '@dems/shared/realtime';
import {
  BADGES,
  HeartbeatStateIcon,
  HeartbeatStateTone,
  motion,
  palette,
  toneChipProps,
  toneHex,
  toneTextHex,
} from '@dems/shared/tokens';
import { TONE_ICONS } from '@/lib/tone-icons';
import { triggerHaptic } from '@/motion';
import { PulseRing } from './pulse-ring';
import { useHealth } from './use-health';

/** `slow` is the Motion proof mode (`demsdemo://?motion=slow`, masterplan/01_specs.md §5.6). */
export type MotionMode = 'normal' | 'slow';

/** Rev 3 (D17): two panes at >= 900 dp, one column below (phone portrait, narrow tablet). */
export const TWO_PANE_MIN_WIDTH = 900;

const { spring, easing, duration, choreography, proofSlowFactor } = motion;
const SLOW_DURATION_MS = duration.slower * proofSlowFactor; // 6,400 ms
const LUXE = Easing.bezier(...easing.luxe);

interface EnterProps {
  mode: MotionMode;
  style?: StyleProp<ViewStyle>;
  children: ReactNode;
}

/** Left pane: Reanimated layout animation on the UI thread (NFR3). */
function EnterFromBelow({ mode, style, children }: EnterProps) {
  if (mode === 'slow') {
    return (
      <Animated.View
        style={style}
        entering={FadeInDown.duration(SLOW_DURATION_MS).easing(LUXE).reduceMotion(ReduceMotion.System)}
      >
        {children}
      </Animated.View>
    );
  }
  return (
    <Animated.View
      style={style}
      entering={FadeInDown.springify()
        .stiffness(spring.gentle.stiffness)
        .damping(spring.gentle.damping)
        .mass(spring.gentle.mass)
        .reduceMotion(ReduceMotion.System)}
    >
      {children}
    </Animated.View>
  );
}

/** Right pane: same spring, delayed by the choreography token (80 ms; 800 ms in slow mode). */
function EnterFromAbove({ mode, style, children }: EnterProps) {
  if (mode === 'slow') {
    return (
      <Animated.View
        style={style}
        entering={FadeInUp.delay(choreography.delayChildren * proofSlowFactor)
          .duration(SLOW_DURATION_MS)
          .easing(LUXE)
          .reduceMotion(ReduceMotion.System)}
      >
        {children}
      </Animated.View>
    );
  }
  return (
    <Animated.View
      style={style}
      entering={FadeInUp.delay(choreography.delayChildren)
        .springify()
        .stiffness(spring.gentle.stiffness)
        .damping(spring.gentle.damping)
        .mass(spring.gentle.mass)
        .reduceMotion(ReduceMotion.System)}
    >
      {children}
    </Animated.View>
  );
}

export interface HomeScreenProps {
  motionMode: MotionMode;
}

/**
 * Mobile stack-proof screen (masterplan/01_specs.md §5.5 rev 3): HeroUI Native components,
 * Reanimated enter transition, Skia pulse ring and the live heartbeat. Responsive and unlocked
 * (D17): rotation re-lays out live through `useWindowDimensions()`.
 *
 * Typography tokens sit on plain `Text` elements (Uniwind, no class merging); on kit components the
 * size token and the colour are kept on separate elements, because the kit's tailwind-merge would
 * drop `text-display` next to `text-accent` (row 17 finding S17-1).
 */
export function HomeScreen({ motionMode }: HomeScreenProps) {
  useKeepAwake();
  const { width } = useWindowDimensions();
  const twoPane = width >= TWO_PANE_MIN_WIDTH;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: palette.black }}>
      <ScrollView
        contentContainerStyle={{
          padding: 32,
          gap: 24,
          flexDirection: twoPane ? 'row' : 'column',
          alignItems: twoPane ? 'flex-start' : 'stretch',
        }}
      >
        <EnterFromBelow mode={motionMode} style={twoPane ? { flex: 3 } : undefined}>
          <HeroCard />
        </EnterFromBelow>
        <EnterFromAbove mode={motionMode} style={[twoPane ? { flex: 2 } : null, { gap: 24 }]}>
          <HeartbeatPanel />
          <ServicePanel />
        </EnterFromAbove>
      </ScrollView>
    </SafeAreaView>
  );
}

function HeroCard() {
  const { toast } = useToast();
  const secure = BADGES.SECURE;
  const SecureIcon = TONE_ICONS[secure.icon];

  return (
    <Card className="rounded-xl">
      <Card.Header className="gap-2">
        <View className="flex-row flex-wrap items-center gap-3">
          <Card.Title className="text-accent">
            <Text className="font-display text-display uppercase">DEMS EDGE CLIENT</Text>
          </Card.Title>
          <Chip {...toneChipProps(secure.tone)} variant="soft">
            <SecureIcon size={14} color={toneTextHex[secure.tone]} />
            <Chip.Label>{secure.label}</Chip.Label>
          </Chip>
        </View>
        <Card.Description>Stack check · placeholder</Card.Description>
      </Card.Header>
      <Card.Body>
        <Text className="text-body text-muted">
          Mobile stack proof: HeroUI Native on Uniwind, Reanimated, Skia, Expo Router and TanStack
          Query, wired to the local mock-core over adb reverse.
        </Text>
      </Card.Body>
      <Card.Footer>
        <Button
          variant="primary"
          onPress={() => {
            triggerHaptic('stackCheckTap');
            toast.show({ label: 'Toasts ready', description: 'HeroUI Native toast is wired.' });
          }}
        >
          <Button.Label>Show test toast</Button.Label>
        </Button>
      </Card.Footer>
    </Card>
  );
}

function HeartbeatPanel() {
  const heartbeat = useHeartbeat();
  const tone = HeartbeatStateTone[heartbeat.state];
  const StateIcon = TONE_ICONS[HeartbeatStateIcon[heartbeat.state]];

  return (
    <Surface className="gap-4 rounded-xl p-5">
      <View className="flex-row items-center justify-between gap-2">
        <View className="flex-row items-center gap-2">
          <Activity size={16} color={palette.gray} />
          <Text className="text-label uppercase text-muted">Heartbeat</Text>
        </View>
        <Chip {...toneChipProps(tone)} variant="soft" testID="heartbeat-chip">
          <StateIcon size={14} color={toneTextHex[tone]} />
          <Chip.Label>{HeartbeatStateLabel[heartbeat.state]}</Chip.Label>
        </Chip>
      </View>
      <View className="flex-row items-center gap-4">
        <PulseRing seq={heartbeat.seq} coreColor={toneHex[tone]} />
        <Text testID="heartbeat-seq" className="font-display text-display text-accent">
          {heartbeat.seq ?? 0}
        </Text>
      </View>
    </Surface>
  );
}

function ServicePanel() {
  const health = useHealth();

  return (
    <Surface className="gap-3 rounded-xl p-5">
      <Text className="text-label uppercase text-muted">Service</Text>
      {health.isError ? (
        <Chip color="danger" variant="soft">
          <Chip.Label>Core unreachable</Chip.Label>
        </Chip>
      ) : (
        <Skeleton isLoading={health.isPending} className="rounded-md">
          <Text testID="health-version" className="font-mono text-data text-foreground">
            {health.data ? `mock-core v${health.data.version} · api ${health.data.apiVersion}` : 'mock-core'}
          </Text>
        </Skeleton>
      )}
    </Surface>
  );
}
