import { Chip, Drawer } from '@heroui/react'
import { Camera, Mic } from 'lucide-react'
import { isGeneratedSource } from './own-core-words'
import { useTranslation } from 'react-i18next'
import { LOCAL_STATE_VIEW, localStateSentenceKey } from './capture-inputs'
import { RateAtLimitWarning } from './registered-devices'
import { ROSTER_SLOT_KEY, rosterCardName, rosterLimitKey, rosterSourceKey, rosterStateNotChecked, useRosterCard, type RosterCard } from './registered-devices-model'
import { DeviceSourceBadge, LocalSourceOn } from './source-badge'
import { useRealCapture, useRealCaptureCore } from './source-class'

export interface RegisteredDeviceDrawerProps {
  /** The registered device to show, or null: closed. An id the Core's list does not hold shows nothing. */
  deviceId: string | null
  onClose: () => void
}

/**
 * "View device" of a registered device beyond the built-in ids (task 3, R-11, blueprint row 140;
 * ux §8c.3 "View device", §8f.2 "the device drawer header"): the kit `Drawer`, as the page's device
 * drawer, with what the Core's device list says of it and nothing else — no health line, no log and
 * no command are invented for a device the page has no simulator view of.
 *
 * For a development source it states the source's LIMIT (D128: the local microphone is not fit for
 * recording yet; D136 (3): the local camera is variable-rate). It holds no password field and no
 * address of a local device; a network camera's address is the host the Core sent, never a
 * credential URL (RK-12).
 */
export function RegisteredDeviceDrawer({ deviceId, onClose }: RegisteredDeviceDrawerProps) {
  const { t } = useTranslation()
  const realCapture = useRealCapture()
  const card = useRosterCard(deviceId)
  const name = card === undefined ? undefined : rosterCardName(t, card, realCapture)
  return (
    <Drawer.Backdrop
      isOpen={card !== undefined}
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
    >
      <Drawer.Content placement="right">
        <Drawer.Dialog aria-label={name === undefined ? undefined : t('common.developmentRoster.detailLabel', { name })} className="dev-drawer w-[460px] max-w-[92vw]" data-testid="registered-device-drawer" data-device={card?.id}>
          {card === undefined || name === undefined ? null : <Content card={card} name={name} realCapture={realCapture} />}
        </Drawer.Dialog>
      </Drawer.Content>
    </Drawer.Backdrop>
  )
}

function Content({ card, name, realCapture }: { card: RosterCard; name: string; realCapture: boolean }) {
  const { t } = useTranslation()
  const view = LOCAL_STATE_VIEW[card.state]
  // Fix wave L (G70c-02, G75d-06): the state only when checked; the model of a generated source is the dataset's, not a fact.
  const realCaptureCore = useRealCaptureCore()
  const notChecked = rosterStateNotChecked(card, realCaptureCore)
  const sentenceKey = card.local ? localStateSentenceKey(card.state, card.kind) : null
  const limitKey = rosterLimitKey(card, realCapture)
  const Icon = card.kind === 'CAMERA' ? Camera : Mic
  const { device } = card
  return (
    <>
      <Drawer.Header className="dev-drawer-header">
        <span className="dev-drawer-icon" data-tone={view.tone}>
          <Icon aria-hidden="true" size={22} strokeWidth={1.6} />
        </span>
        <div className="dev-drawer-titles">
          <Drawer.Heading className="dev-drawer-heading">{name}</Drawer.Heading>
          <p className="dev-drawer-sub">
            {t(card.kind === 'CAMERA' ? 'common.developmentRoster.kind.CAMERA' : 'common.developmentRoster.kind.MIC')} · {card.id}
          </p>
          <DeviceSourceBadge device={device} testId="source-badge-registered-drawer" />
          <LocalSourceOn device={device} place="registered-drawer" />
        </div>
        <Chip size="sm" variant="soft" color={notChecked ? 'default' : view.tone} data-testid="registered-drawer-state" data-checked={notChecked ? 'false' : undefined}>
          <Chip.Label title={notChecked ? t('web.waveL.state.notCheckedHint') : undefined}>{notChecked ? t('web.waveL.state.notChecked') : t(view.chip)}</Chip.Label>
        </Chip>
        <Drawer.CloseTrigger aria-label={t('common.actions.close')} />
      </Drawer.Header>
      <Drawer.Body className="dev-drawer-body">
        {sentenceKey === null ? null : (
          <p className="dev-sel-reason" data-testid="registered-drawer-sentence">
            {t(sentenceKey)}
          </p>
        )}
        {card.rateAtLimit ? <RateAtLimitWarning deviceId={card.id} /> : null}
        <dl className="dev-facts" data-testid="registered-drawer-facts">
          <Fact label={t('common.developmentRoster.field.id')} value={card.id} />
          <Fact label={t('common.developmentRoster.field.kind')} value={t(card.kind === 'CAMERA' ? 'common.developmentRoster.kind.CAMERA' : 'common.developmentRoster.kind.MIC')} />
          <Fact label={t('common.developmentRoster.field.source')} value={t(rosterSourceKey(device.adapter))} />
          {/* The model is what the device announced: shown as text in one line, never as the name. */}
          {realCaptureCore && isGeneratedSource(device) ? (
            <Fact label={t('common.developmentRoster.field.model')} value={t('web.waveL.source.generatedCamera')} />
          ) : (
            <Fact label={t('common.developmentRoster.field.model')} value={device.model ?? t('common.developmentRoster.modelUnknown')} untrusted />
          )}
          {/* A local device has no address; a network camera's is the host the Core sent. */}
          {card.local || device.host === null ? null : <Fact label={t('common.developmentRoster.field.address')} value={device.host} untrusted />}
          <Fact label={t('common.developmentRoster.field.usedAs')} value={card.slot === null ? t('common.developmentRoster.usedAs.NONE') : t(ROSTER_SLOT_KEY[card.slot])} />
          {device.streamState === null || notChecked ? null : <Fact label={t('common.developmentRoster.field.stream')} value={device.streamState} />}
        </dl>
        {limitKey === null ? null : (
          <section className="dev-roster-limits" data-testid="registered-drawer-limits" aria-label={t('common.developmentRoster.limits.title')}>
            <h4 className="dev-roster-title">{t('common.developmentRoster.limits.title')}</h4>
            <p className="dev-sel-reason">{t(limitKey)}</p>
          </section>
        )}
      </Drawer.Body>
    </>
  )
}

function Fact({ label, value, untrusted = false }: { label: string; value: string; untrusted?: boolean }) {
  return (
    <div className="dev-facts-row">
      <dt>{label}</dt>
      <dd className={untrusted ? 'dev-search-device-text' : undefined} title={untrusted ? value : undefined}>
        {value}
      </dd>
    </div>
  )
}
