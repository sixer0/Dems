import { forwardRef, useRef, type ReactNode } from 'react'
import { Chip } from '@heroui/react'
import { Ban, Camera, FileOutput, Server, TabletSmartphone, Waypoints, Wrench, type LucideIcon } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { NetworkDomain } from '@dems/shared/domain'
import { useSim } from '@dems/shared/sim'
import { palette, toneChipProps, toneHex } from '@dems/shared/tokens'
import { AnimatedBeam } from '@/components/ui/animated-beam'
import { cn } from '@/lib/utils'
import { DOMAIN_TONE } from './model'
import { NetworkTimePanel } from './panel'
import { selectDomainStates, type DomainState } from './sim-adapter'

const DOMAIN_ORDER: readonly NetworkDomain[] = ['CAMERA', 'MANAGEMENT', 'SERVICE_UPDATE', 'EXPORT_TRANSFER']
const DOMAIN_ICON: Record<NetworkDomain, LucideIcon> = {
  CAMERA: Camera,
  MANAGEMENT: TabletSmartphone,
  SERVICE_UPDATE: Wrench,
  EXPORT_TRANSFER: FileOutput,
}
/** All beams of the diagram share one ambient slot (§9.4, D63). */
const BEAM_GROUP = 'nt-beams'

/** A beam moves only while its domain carries traffic; otherwise its static path shows the state. */
function beamLive(state: DomainState): boolean {
  return state === 'ACTIVE' || state === 'DEGRADED' || state === 'TRANSFER' || state === 'UPDATING'
}

function pathColour(state: DomainState): string {
  if (state === 'DOWN') return palette.danger
  if (state === 'DEGRADED') return palette.warning
  return palette.gray
}

/**
 * Network domains (01_specs §14.5.6 row 4; design book §21.1, 01_explore §21.1; SYS-005): a
 * segmentation diagram with MU **AnimatedBeam** paths (Camera ↔ Core ↔ Tablet live; the Service and
 * Export paths dashed until they carry traffic; the forbidden Camera ↔ Tablet route crossed out),
 * then the four domain cards with VLAN, state and the book's access rule. The domain states come
 * from the simulator's `selectDomainStates` (`sim-adapter.ts`).
 */
export function DomainsPanel() {
  const { t } = useTranslation()
  const states = useSim(selectDomainStates)
  const vlans = useSim((s) => {
    const byId: Record<string, number> = {}
    for (const domain of s.network.domains) byId[domain.id] = domain.vlan
    return byId
  })
  return (
    <NetworkTimePanel id="domains" icon={Waypoints} title={t('networkTime.domains.title')}>
      <DomainDiagram states={states} vlans={vlans} />
      <ul className="nt-domains" data-testid="network-time-domains">
        {DOMAIN_ORDER.map((id) => {
          const Icon = DOMAIN_ICON[id]
          const state = states[id]
          return (
            <li key={id} className="nt-domain" data-state={state} data-testid={`network-time-domain-${id}`}>
              <div className="nt-domain-head">
                <Icon className="nt-domain-icon" aria-hidden="true" strokeWidth={1.75} />
                <p className="nt-domain-name">{t(`networkTime.domains.name.${id}`)}</p>
                <span className="nt-domain-vlan nt-mono">{t('networkTime.domains.vlan', { vlan: vlans[id] ?? 0 })}</span>
              </div>
              <p className="nt-domain-access">{t(`networkTime.domains.access.${id}`)}</p>
              <div className="nt-domain-foot">
                <span className="nt-domain-rule">{t(`networkTime.domains.rule.${id}`)}</span>
                <Chip size="sm" variant="soft" {...toneChipProps(DOMAIN_TONE[state])}>
                  {t(`networkTime.domains.state.${state}`)}
                </Chip>
              </div>
            </li>
          )
        })}
      </ul>
    </NetworkTimePanel>
  )
}

interface DiagramProps {
  states: Record<NetworkDomain, DomainState>
  vlans: Record<string, number>
}

function DomainDiagram({ states, vlans }: DiagramProps) {
  const { t } = useTranslation()
  const containerRef = useRef<HTMLDivElement>(null)
  const cameraRef = useRef<HTMLDivElement>(null)
  const coreRef = useRef<HTMLDivElement>(null)
  const tabletRef = useRef<HTMLDivElement>(null)
  const serviceRef = useRef<HTMLDivElement>(null)
  const exportRef = useRef<HTMLDivElement>(null)
  const camera = states.CAMERA
  const mgmt = states.MANAGEMENT
  const service = states.SERVICE_UPDATE
  const exportState = states.EXPORT_TRANSFER
  return (
    <div ref={containerRef} className="nt-diagram" role="img" aria-label={t('networkTime.domains.diagramLabel')} data-testid="network-time-diagram">
      <AnimatedBeam
        containerRef={containerRef}
        fromRef={cameraRef}
        toRef={tabletRef}
        curvature={130}
        pathColor={palette.danger}
        pathOpacity={0.3}
        pathWidth={1.5}
        active={false}
        className="nt-beam-dashed"
      />
      <AnimatedBeam
        containerRef={containerRef}
        fromRef={cameraRef}
        toRef={coreRef}
        pathColor={pathColour(camera)}
        active={beamLive(camera)}
        duration={4}
        loopGroup={BEAM_GROUP}
      />
      <AnimatedBeam
        containerRef={containerRef}
        fromRef={coreRef}
        toRef={tabletRef}
        pathColor={pathColour(mgmt)}
        active={beamLive(mgmt)}
        duration={4}
        delay={1.2}
        loopGroup={BEAM_GROUP}
        className={mgmt === 'DEGRADED' ? 'nt-beam-dashed' : undefined}
      />
      <AnimatedBeam
        containerRef={containerRef}
        fromRef={serviceRef}
        toRef={coreRef}
        curvature={-18}
        active={beamLive(service)}
        duration={3}
        gradientStartColor={toneHex.info}
        gradientStopColor={toneHex.info}
        loopGroup={BEAM_GROUP}
        className="nt-beam-dotted"
      />
      <AnimatedBeam
        containerRef={containerRef}
        fromRef={coreRef}
        toRef={exportRef}
        curvature={-18}
        active={beamLive(exportState)}
        duration={3}
        gradientStartColor={toneHex.info}
        gradientStopColor={toneHex.info}
        loopGroup={BEAM_GROUP}
        className="nt-beam-dashed"
      />

      <p className="nt-diagram-noroute">
        <Ban className="nt-noroute-icon" aria-hidden="true" strokeWidth={2} />
        {t('networkTime.domains.noRoute')}
      </p>
      <DiagramNode ref={cameraRef} area="camera" icon={Camera} label={t('networkTime.domains.cameras')} state={camera} vlan={vlans.CAMERA}>
        <CameraLeds />
      </DiagramNode>
      <p className="nt-edge nt-edge-camera nt-mono">{t('networkTime.domains.cameraNic')}</p>
      <DiagramNode ref={coreRef} area="core" icon={Server} label={t('networkTime.domains.core')} core />
      <p className="nt-edge nt-edge-mgmt nt-mono">{t('networkTime.domains.mgmtNic')}</p>
      <DiagramNode ref={tabletRef} area="tablet" icon={TabletSmartphone} label={t('networkTime.domains.tablet')} state={mgmt} vlan={vlans.MANAGEMENT} />
      <DiagramNode ref={serviceRef} area="service" icon={Wrench} label={t('networkTime.domains.service')} state={service} vlan={vlans.SERVICE_UPDATE} small />
      <DiagramNode ref={exportRef} area="export" icon={FileOutput} label={t('networkTime.domains.export')} state={exportState} vlan={vlans.EXPORT_TRANSFER} small />
    </div>
  )
}

interface DiagramNodeProps {
  area: string
  icon: LucideIcon
  label: string
  state?: DomainState
  vlan?: number
  core?: boolean
  small?: boolean
  children?: ReactNode
}

const DiagramNode = forwardRef<HTMLDivElement, DiagramNodeProps>(function DiagramNode(
  { area, icon: Icon, label, state, vlan, core, small, children },
  ref,
) {
  const { t } = useTranslation()
  const tone = state ? DOMAIN_TONE[state] : 'accent'
  return (
    <div className={cn('nt-node-cell', `nt-cell-${area}`)}>
      <div
        ref={ref}
        className={cn('nt-node', core && 'nt-node-core', small && 'nt-node-small')}
        data-state={state}
        data-testid={`network-time-node-${area}`}
        style={{ ['--nt-node-tone' as string]: toneHex[tone] }}
      >
        <Icon className="nt-node-icon" aria-hidden="true" strokeWidth={1.75} />
        <span className="nt-node-label">{label}</span>
        {vlan !== undefined ? <span className="nt-node-vlan nt-mono">{t('networkTime.domains.vlan', { vlan })}</span> : null}
        {children}
      </div>
    </div>
  )
})

function CameraLeds() {
  const links = useSim((s) => s.ports.filter((port) => port.id === 'POE_CAM_1' || port.id === 'POE_CAM_2_AUX').map((port) => port.link))
  return (
    <span className="nt-node-leds" aria-hidden="true">
      {links.map((link, i) => (
        <span key={i} className="nt-node-led" data-link={link ? 'up' : 'down'} />
      ))}
    </span>
  )
}
