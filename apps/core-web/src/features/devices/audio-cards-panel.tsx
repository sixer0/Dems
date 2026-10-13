import { useId } from 'react'
import { Alert, Button, Chip, Description, Label, Radio, RadioGroup, Spinner } from '@heroui/react'
import { ListPlus, Search } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { CAPTURE_AUDIO_CARD_MAX_ENTRIES } from '@dems/shared/api'
import { formatClock } from '@dems/shared/realtime'
import { captureDeviceName } from '@/lib/capture-notices'
import { useCoreErrorPresenter } from '@/lib/core-errors'
import {
  cardKeyOf,
  inputsOf,
  isChoiceOf,
  listRefusal,
  registerRefusal,
  useAudioCards,
  type AudioCardsBlock,
  type AudioCardsController,
  type CaptureAudioCard,
  type InputChoice,
  type RegisterOutcome,
} from './audio-cards'
import { useGateReason } from './camera-search'
import { DeviceText } from './camera-search-panel'

/** The sentence beside a blocked control; an open session has the sentence of these two operations. */
function useBlockReason(): (block: AudioCardsBlock | null) => string | null {
  const { t } = useTranslation()
  const reasonOf = useGateReason()
  return (block) => (block?.kind === 'LOCKED' ? t('common.captureAudioCards.locked') : reasonOf(block))
}

/**
 * One capture device of one sound card as the listing found it: the product name the card announced
 * (untrusted device text: a text node, never markup, never part of a sentence), what the Core read of
 * it, and its inputs 1 to the channel count as ONE single-choice group. An input the listing names a
 * microphone for is shown as registered, with that microphone.
 */
function Card({ card, position, choice, disabled, onChoose }: { card: CaptureAudioCard; position: number; choice: InputChoice | null; disabled: boolean; onChoose: (choice: InputChoice) => void }) {
  const { t } = useTranslation()
  const key = cardKeyOf(card)
  const inputs = inputsOf(card)
  return (
    <li className="dev-scan-result" data-testid={`audio-card-${key}`} data-inputs={card.channelCount}>
      <div className="dev-scan-row">
        <DeviceText text={card.product} className="dev-tile-name" />
        <span className="dev-tile-sub">{t('common.captureAudioCards.card.inputs', { count: card.channelCount })}</span>
        <span className="dev-tile-sub">{t('common.captureAudioCards.card.device', { index: card.deviceIndex })}</span>
        <span className="dev-tile-sub font-mono" data-testid={`audio-card-usb-${key}`}>
          {card.usbId === null ? t('common.captureAudioCards.card.notUsb') : t('common.captureAudioCards.card.usbId', { id: card.usbId })}
        </span>
        {card.sampleBits.length === 0 ? null : <span className="dev-tile-sub">{t('common.captureAudioCards.card.sampleBits', { bits: card.sampleBits.join(', ') })}</span>}
      </div>
      <RadioGroup
        orientation="horizontal"
        isDisabled={disabled}
        value={isChoiceOf(choice, card) && choice !== null ? String(choice.inputNumber) : null}
        onChange={(value) => {
          const picked = inputs.find((input) => String(input.inputNumber) === value)
          if (picked !== undefined) onChoose({ cardId: card.cardId, deviceIndex: card.deviceIndex, inputNumber: picked.inputNumber })
        }}
        data-testid={`audio-card-inputs-${key}`}
      >
        <Label>{t('common.captureAudioCards.inputsLabel', { position })}</Label>
        {inputs.map((input) => (
          <Radio key={input.inputNumber} value={String(input.inputNumber)} data-testid={`audio-card-input-${key}-${input.inputNumber}`} data-registered={input.deviceId ?? undefined}>
            <Radio.Content>
              <Radio.Control>
                <Radio.Indicator />
              </Radio.Control>
              <Label>{t('common.captureAudioCards.input', { number: input.inputNumber })}</Label>
            </Radio.Content>
            {input.deviceId === null ? null : (
              <Description>
                <Chip size="sm" variant="soft" color="default">
                  <Chip.Label>{t('common.captureAudioCards.registeredAs', { device: captureDeviceName(t, input.deviceId) })}</Chip.Label>
                </Chip>
              </Description>
            )}
          </Radio>
        ))}
      </RadioGroup>
    </li>
  )
}

/** What the last registration did, by its change code; or its refusal, by its reason. Never the answer's own text. */
function Outcome({ outcome }: { outcome: RegisterOutcome }) {
  const { t } = useTranslation()
  if (outcome.kind === 'DONE') {
    const { registration } = outcome
    return (
      <Alert status="success" role="status" data-testid="audio-cards-registered" data-change={registration.change} data-device={registration.deviceId}>
        <Alert.Indicator />
        <Alert.Content>
          <Alert.Title>{t(`common.captureAudioCards.result.${registration.change}`, { number: registration.inputNumber, device: captureDeviceName(t, registration.deviceId) })}</Alert.Title>
        </Alert.Content>
      </Alert>
    )
  }
  const key = outcome.refusal === 'BEYOND_CARD' ? 'AUDIO_INPUT_BEYOND_CARD' : outcome.refusal === 'NOT_REGISTRABLE' ? 'AUDIO_INPUT_NOT_REGISTRABLE' : outcome.refusal
  return (
    <Alert status={outcome.refusal === 'FAILED' ? 'danger' : 'warning'} role="status" data-testid="audio-cards-refused" data-refusal={outcome.refusal}>
      <Alert.Indicator />
      <Alert.Content>
        <Alert.Title>{t(`common.captureAudioCards.refusal.${key}`)}</Alert.Title>
      </Alert.Content>
    </Alert>
  )
}

/** The inline notices of a refused call: explained states in the panel, never a toast. */
function Notices({ cards }: { cards: AudioCardsController }) {
  const { t } = useTranslation()
  switch (cards.notice) {
    case 'NOT_READY':
      return (
        <Alert status="warning" data-testid="audio-cards-not-ready">
          <Alert.Indicator />
          <Alert.Content>
            <Alert.Title>{t('common.captureAudioCards.notReady')}</Alert.Title>
          </Alert.Content>
        </Alert>
      )
    case 'LIST_FAILED':
      return (
        <Alert status="danger" data-testid="audio-cards-list-failed">
          <Alert.Indicator />
          <Alert.Content>
            <Alert.Title>{t('common.captureAudioCards.listFailed')}</Alert.Title>
          </Alert.Content>
        </Alert>
      )
    case 'BUSY':
      return (
        <p className="dev-sel-reason" role="status" data-testid="audio-cards-busy">
          {t('common.captureAudioCards.busy')}
        </p>
      )
    case 'LOCKED':
      return (
        <p className="dev-sel-reason" role="status" data-testid="audio-cards-locked">
          {t('common.captureAudioCards.locked')}
        </p>
      )
    case null:
      return null
  }
}

/**
 * "Sound cards" in the microphone panel of Devices & Inputs (task 4, blueprint row 72; operations 98
 * and 99, web console only): "List sound cards" asks the Core once, the list shows each card with
 * its inputs, and "Register as microphone" registers the ONE input that is chosen. Nothing lists by
 * itself, nothing is chosen for the operator, and inputs are never mixed: one microphone is one input
 * of one card. Every state is an answer of the Core; a control that cannot be used is disabled with
 * its reason, never hidden.
 */
export function AudioCards() {
  const { t } = useTranslation()
  const cards = useAudioCards()
  const reasonOf = useBlockReason()
  const presentCoreError = useCoreErrorPresenter()
  const listReasonId = useId()
  const registerReasonId = useId()
  const { listing, choice } = cards
  const blockReason = reasonOf(cards.block)
  const registerReason = blockReason ?? (choice === null ? t('common.captureAudioCards.pickFirst') : null)

  const onList = () => {
    void cards.list().then((answer) => {
      if (answer === null || answer.ok) return
      // What the panel does not word itself goes to the shared presenter (an outage, a time-out, a 403).
      const refusal = listRefusal(answer)
      if ((refusal === 'OTHER' || refusal === 'ROLE') && answer.failure !== null) presentCoreError(answer.failure)
    })
  }
  const onRegister = () => {
    void cards.register().then((answer) => {
      if (answer === null || answer.ok) return
      if (registerRefusal(answer) === 'ROLE' && answer.failure !== null) presentCoreError(answer.failure)
    })
  }

  return (
    <section className="dev-scan" data-testid="audio-cards" aria-label={t('common.captureAudioCards.title')} aria-busy={cards.busy !== null || undefined}>
      <h3 className="dev-sel-group">{t('common.captureAudioCards.title')}</h3>
      <div className="dev-scan-head">
        <span className="dev-search-control" data-testid="audio-cards-list" data-block={cards.block?.kind}>
          <Button
            size="sm"
            variant="outline"
            isDisabled={cards.block !== null || cards.busy !== null}
            isPending={cards.busy === 'LIST'}
            onPress={onList}
            aria-describedby={blockReason === null ? undefined : listReasonId}
            data-testid="audio-cards-list-button"
          >
            {cards.busy === 'LIST' ? <Spinner size="sm" color="current" aria-hidden="true" /> : <Search aria-hidden="true" size={14} />}
            {t(listing === null ? 'common.captureAudioCards.action' : 'common.captureAudioCards.again')}
          </Button>
          {blockReason === null ? null : (
            <span id={listReasonId} className="dev-sel-reason" data-testid="audio-cards-list-reason">
              {blockReason}
            </span>
          )}
        </span>
        <p className="dev-sel-reason" data-testid="audio-cards-description">
          {t('common.captureAudioCards.description')}
        </p>
      </div>
      <Notices cards={cards} />
      {listing === null ? null : (
        <div className="dev-scan-result" data-testid="audio-cards-result" data-count={listing.cards.length}>
          {listing.truncated ? (
            <Alert status="warning" data-testid="audio-cards-truncated">
              <Alert.Indicator />
              <Alert.Content>
                <Alert.Title>{t('common.captureAudioCards.truncated', { max: CAPTURE_AUDIO_CARD_MAX_ENTRIES })}</Alert.Title>
              </Alert.Content>
            </Alert>
          ) : null}
          {listing.cards.length === 0 ? (
            <p className="dev-sel-reason" role="status" data-testid="audio-cards-empty">
              {t('common.captureAudioCards.empty')}
            </p>
          ) : (
            <>
              <p className="dev-sel-reason" data-testid="audio-cards-pick-hint">
                {t('common.captureAudioCards.pickHint')}
              </p>
              {/* The order of the answer, as it is: never re-sorted, filtered or merged. */}
              <ul className="dev-scan-list">
                {listing.cards.map((card, index) => (
                  <Card key={cardKeyOf(card)} card={card} position={index + 1} choice={choice} disabled={cards.block !== null || cards.busy !== null} onChoose={cards.choose} />
                ))}
              </ul>
              <p className="dev-sel-reason" data-testid="audio-cards-trust">
                {t('common.captureAudioCards.trustNote')}
              </p>
              <span className="dev-search-control" data-testid="audio-cards-register">
                <Button
                  size="sm"
                  variant="primary"
                  isDisabled={cards.block !== null || cards.busy !== null || choice === null}
                  isPending={cards.busy === 'REGISTER'}
                  onPress={onRegister}
                  aria-describedby={registerReason === null ? undefined : registerReasonId}
                  data-testid="audio-cards-register-button"
                >
                  {cards.busy === 'REGISTER' ? <Spinner size="sm" color="current" aria-hidden="true" /> : <ListPlus aria-hidden="true" size={14} />}
                  {t('common.captureAudioCards.register')}
                </Button>
                {registerReason === null ? null : (
                  <span id={registerReasonId} className="dev-sel-reason" data-testid="audio-cards-register-reason">
                    {registerReason}
                  </span>
                )}
              </span>
            </>
          )}
          {cards.outcome === null ? null : <Outcome outcome={cards.outcome} />}
          <p className="dev-sel-reason" data-testid="audio-cards-listed-at">
            {t('common.captureAudioCards.listedAt', { time: formatClock(listing.searchedAt) })}
          </p>
        </div>
      )}
    </section>
  )
}
