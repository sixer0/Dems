import { Alert, Button, Chip } from '@heroui/react'
import { Camera, Mic } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { LOCAL_STATE_VIEW, localStateSentenceKey } from './capture-inputs'
import { ROSTER_SLOT_KEY, rosterCardName, useRegisteredRoster, type RosterCard } from './registered-devices-model'
import { DeviceSourceBadge, LocalSourceOn } from './source-badge'
import { useRealCapture, type SourceDeviceKind } from './source-class'

/**
 * One registered device beyond the built-in ids (task 3, R-11, blueprint row 140; ux §8f.3): its
 * name, its id, the state chip, the ONE "Development source" badge and the 'is on' line (both from
 * the Core's data only), what it is used as, the sentence of a local device that cannot be opened,
 * the named rate warning of a microphone, and "View device".
 *
 * The card keeps its name and its badge in every state. It offers no other source in its place and
 * no control that opens or changes a system setting (R-11 AC-5, AC-9; D80(11)).
 */
function RegisteredDeviceCard({ card, onView }: { card: RosterCard; onView: (deviceId: string) => void }) {
  const { t } = useTranslation()
  const realCapture = useRealCapture()
  const name = rosterCardName(t, card, realCapture)
  const view = LOCAL_STATE_VIEW[card.state]
  const sentenceKey = card.local ? localStateSentenceKey(card.state, card.kind) : null
  const Icon = card.kind === 'CAMERA' ? Camera : Mic
  return (
    <li className="dev-roster-card" data-testid={`registered-device-${card.id}`} data-state={card.state} data-adapter={card.device.adapter ?? undefined}>
      <div className="dev-roster-head">
        <Icon aria-hidden="true" size={16} strokeWidth={1.6} />
        <span className="dev-tile-name" data-testid={`registered-device-name-${card.id}`}>
          {name}
        </span>
        <span className="dev-roster-id">{card.id}</span>
        <Chip size="sm" variant="soft" color={view.tone} data-testid={`registered-device-state-${card.id}`}>
          <Chip.Label>{t(view.chip)}</Chip.Label>
        </Chip>
        {/* Decided by the Core: the badge only from a `sourceClass` it sent, in real capture only; 'is on' only from `sourceOpen`. */}
        <DeviceSourceBadge device={card.device} testId={`source-badge-roster-${card.id}`} />
        <LocalSourceOn device={card.device} place={`roster-${card.id}`} />
      </div>
      <div className="dev-roster-foot">
        <span className="dev-sel-reason" data-testid={`registered-device-used-${card.id}`}>
          {card.slot === null ? t('common.developmentRoster.usedAs.NONE') : t(ROSTER_SLOT_KEY[card.slot])}
        </span>
        <Button size="sm" variant="outline" onPress={() => onView(card.id)} data-testid={`registered-device-view-${card.id}`} aria-label={t('common.developmentRoster.detailLabel', { name })}>
          {t('common.captureSearch.viewDevice')}
        </Button>
      </div>
      {sentenceKey === null ? null : (
        <p className="dev-sel-reason" data-testid={`registered-device-sentence-${card.id}`}>
          {t(sentenceKey)}
        </p>
      )}
      {card.rateAtLimit ? <RateAtLimitWarning deviceId={card.id} /> : null}
    </li>
  )
}

/**
 * The NAMED warning of a microphone whose rate controller is at its limit (capture protocol 4,
 * `MIC_RATE_AT_LIMIT`; D128): never hidden, never softened into a generic fault. Drawn while the
 * Core's advisory alert for that microphone is active.
 */
export function RateAtLimitWarning({ deviceId }: { deviceId: string }) {
  const { t } = useTranslation()
  return (
    <Alert status="warning" data-testid={`registered-device-rate-${deviceId}`}>
      <Alert.Indicator />
      <Alert.Content>
        <Alert.Title>{t('common.developmentRoster.rateAtLimit.title')}</Alert.Title>
        <Alert.Description>{t('common.developmentRoster.rateAtLimit.body')}</Alert.Description>
      </Alert.Content>
    </Alert>
  )
}

export interface RegisteredDevicesProps {
  kind: SourceDeviceKind
  /** "View device": the page opens the detail of that registered device. */
  onView: (deviceId: string) => void
}

/**
 * The registered cameras, or the registered microphones, beyond the built-in ids — from the Core's
 * device list (ruling D137 (2)). Renders NOTHING when the Core lists none: a Core without an added
 * or local device, and the in-app simulator before a camera was added, look exactly as before.
 */
export function RegisteredDevices({ kind, onView }: RegisteredDevicesProps) {
  const { t } = useTranslation()
  const cards = useRegisteredRoster(kind)
  if (cards.length === 0) return null
  const title = t(kind === 'CAMERA' ? 'common.developmentRoster.cameras' : 'common.developmentRoster.microphones')
  return (
    <section className="dev-roster" data-testid={`registered-devices-${kind}`} aria-label={title}>
      <h3 className="dev-roster-title">{title}</h3>
      <ul className="dev-scan-list">
        {cards.map((card) => (
          <RegisteredDeviceCard key={card.id} card={card} onView={onView} />
        ))}
      </ul>
    </section>
  )
}
