import { Button, Card, Chip, Skeleton, Surface, toast } from '@heroui/react'
import { Activity } from 'lucide-react'
import { motion } from 'motion/react'
import { formatClock, useHeartbeat } from '@dems/shared/realtime'
import {
  BADGES,
  HeartbeatStateIcon,
  HeartbeatStateTone,
  motion as motionTokens,
  palette,
  toneChipProps,
  toneHex,
} from '@dems/shared/tokens'
import { HeartbeatStateLabel } from '@dems/shared/domain'
import { BorderBeam } from '@/components/ui/border-beam'
import { useAmbientLoop } from '@/motion'
import { SlidingNumber } from '@/components/ui/sliding-number'
import { TONE_ICONS } from '@/lib/tone-icons'
import { enterTransition, enterVariants, type MotionMode } from './motion-variants'
import { useHealth } from '@/lib/health-query'

export interface HomePageProps {
  motionMode: MotionMode
}

/**
 * Stack-proof placeholder route `/` (masterplan/01_specs.md §4.4): HeroUI v3 components, Magic UI
 * BorderBeam, Motion Primitives SlidingNumber, a Motion spring enter transition and a live
 * heartbeat indicator bound to mock-core.
 *
 * Typography tokens (`text-display`, `text-h1`, …) sit on plain elements, never next to a
 * `text-<colour>` class on a kit component: the kit's tailwind-merge would drop the size.
 */
export function HomePage({ motionMode }: HomePageProps) {
  const transition = enterTransition(motionMode)

  return (
    <motion.section
      className="mx-auto flex w-full max-w-[960px] flex-col gap-6 px-6 py-12"
      variants={enterVariants}
      initial="hidden"
      animate="visible"
      transition={transition}
    >
      <motion.div variants={enterVariants} transition={transition}>
        <HeroCard />
      </motion.div>
      <div className="grid gap-6 md:grid-cols-3">
        <motion.div variants={enterVariants} transition={transition}>
          <HeartbeatCard />
        </motion.div>
        <motion.div variants={enterVariants} transition={transition}>
          <ServiceCard />
        </motion.div>
        <motion.div variants={enterVariants} transition={transition}>
          <ClockCard />
        </motion.div>
      </div>
    </motion.section>
  )
}

function HeroCard() {
  const secure = BADGES.SECURE
  const SecureIcon = TONE_ICONS[secure.icon]
  return (
    <Card className="rounded-xl shadow-glow-2">
      <Card.Header className="gap-2">
        <div className="flex flex-wrap items-center gap-3">
          <Card.Title className="text-accent">
            <span className="block font-display text-display uppercase">DEMS EDGE CLIENT</span>
          </Card.Title>
          <Chip {...toneChipProps(secure.tone)} variant="soft">
            <SecureIcon aria-hidden size={14} />
            <Chip.Label>{secure.label}</Chip.Label>
          </Chip>
        </div>
        <Card.Description>Stack check · placeholder</Card.Description>
      </Card.Header>
      <Card.Content>
        <p className="text-body text-muted">
          Core console scaffold: HeroUI v3 on Tailwind 4, Motion, TanStack Router and Query, wired
          to the local mock-core heartbeat.
        </p>
      </Card.Content>
      <Card.Footer>
        <Button
          variant="primary"
          onPress={() =>
            toast.success('Toasts ready', { description: 'HeroUI toast queue is wired.' })
          }
        >
          Show test toast
        </Button>
      </Card.Footer>
      <StackCheckBeam />
    </Card>
  )
}

/**
 * The stack-check BorderBeam (step 54; review 40 m10): an ambient loop registered with the ambient
 * registry, so it counts against the ≤ 4 loops per viewport, pauses off screen and in a hidden tab,
 * and never runs under reduced motion (the beam is unmounted, not just paused).
 */
function StackCheckBeam() {
  const loop = useAmbientLoop('stack-check-border-beam')
  return (
    <span aria-hidden="true" className="contents" data-testid="stack-check-beam" {...loop.attrs}>
      {loop.running ? <BorderBeam size={220} duration={8} colorFrom={palette.gold} colorTo={palette.bronze} /> : null}
    </span>
  )
}

function HeartbeatCard() {
  const heartbeat = useHeartbeat()
  const tone = HeartbeatStateTone[heartbeat.state]
  const StateIcon = TONE_ICONS[HeartbeatStateIcon[heartbeat.state]]
  const dotColor = toneHex[tone]

  return (
    <Card className="h-full rounded-xl">
      <Card.Header className="flex-row items-center justify-between gap-2">
        <Card.Title className="flex items-center gap-2 text-muted">
          <Activity aria-hidden size={16} />
          <span className="text-label uppercase">Heartbeat</span>
        </Card.Title>
        <Chip {...toneChipProps(tone)} variant="soft" data-testid="heartbeat-chip">
          <StateIcon aria-hidden size={14} />
          <Chip.Label>{HeartbeatStateLabel[heartbeat.state]}</Chip.Label>
        </Chip>
      </Card.Header>
      <Card.Content className="flex-row items-center gap-4">
        <span className="relative inline-flex size-3 shrink-0" aria-hidden>
          <motion.span
            key={heartbeat.seq ?? -1}
            className="absolute inset-0 rounded-full"
            style={{ backgroundColor: dotColor }}
            initial={{ scale: 1, opacity: 0.6 }}
            animate={{ scale: [1, 1.8], opacity: [0.6, 0] }}
            transition={{
              duration: motionTokens.duration.beatOut / 1000,
              ease: motionTokens.easing.luxe,
            }}
          />
          <span className="relative inline-flex size-3 rounded-full" style={{ backgroundColor: dotColor }} />
        </span>
        <div
          data-testid="heartbeat-seq"
          className="font-display text-display tabular-nums text-foreground"
          aria-label={`Heartbeat sequence ${heartbeat.seq ?? 0}`}
        >
          <SlidingNumber value={heartbeat.seq ?? 0} />
        </div>
      </Card.Content>
    </Card>
  )
}

function ServiceCard() {
  const health = useHealth()
  return (
    <Card className="h-full rounded-xl">
      <Card.Header>
        <Card.Title className="text-muted">
          <span className="text-label uppercase">Service</span>
        </Card.Title>
      </Card.Header>
      <Card.Content>
        {health.isPending ? (
          <Skeleton className="h-5 w-48 rounded-md" />
        ) : health.isError ? (
          <Chip color="danger" variant="soft">
            <Chip.Label>Core unreachable</Chip.Label>
          </Chip>
        ) : (
          <p data-testid="health-version" className="font-mono text-data text-foreground">
            {health.data.service.replace(/^dems-/, '')} v{health.data.version} · api {health.data.apiVersion}
          </p>
        )}
      </Card.Content>
    </Card>
  )
}

function ClockCard() {
  const heartbeat = useHeartbeat()
  return (
    <Card className="h-full rounded-xl">
      <Card.Header>
        <Card.Title className="text-muted">
          <span className="text-label uppercase">Core time · UTC+07:00</span>
        </Card.Title>
      </Card.Header>
      <Card.Content className="gap-2">
        <p className="font-display text-h1 tabular-nums text-accent">{formatClock(heartbeat.serverTime)}</p>
        <Surface variant="secondary" className="self-start rounded-lg px-2 py-1">
          <span className="font-mono text-data text-muted">clients: {heartbeat.clients ?? '–'}</span>
        </Surface>
      </Card.Content>
    </Card>
  )
}
