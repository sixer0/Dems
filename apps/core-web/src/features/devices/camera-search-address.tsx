import { useId, useState, type FormEvent } from 'react'
import { Button, Description, FieldError, Input, Label, Spinner, TextField } from '@heroui/react'
import { LocateFixed } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useCoreErrorPresenter } from '@/lib/core-errors'
import { startRefusal, typedAddressOf, useCameraSearchController, useGateReason } from './camera-search'

/**
 * What the form says about the last press:
 * - `FORM`: the text is not a dotted IPv4 literal. Decided here; nothing was sent.
 * - `NOT_ALLOWED`: the Core answered `422` with `DISCOVERY_ADDRESS_NOT_ALLOWED`. The Core sent nothing to the address.
 * - `NOT_PROBED`: the Core answered `200` with `created: false` - the caller's own search was still running, so the address was not asked.
 */
type AddressProblem = 'FORM' | 'NOT_ALLOWED' | 'NOT_PROBED'

/**
 * The typed address of the camera search (task 4, blueprint row 98, package WP-12; contract row 94:
 * the optional member `address` of operation 93, web console only). The explicit fallback for a
 * camera that does not answer the search: the operator types ONE address and the Core asks that one
 * address. What answers is a candidate like any other - the same list, the same Connect.
 *
 * - The form rule is the contract's: a dotted IPv4 literal (`typedAddressOf`). A name, a port, a
 *   link or an IPv6 text is refused in the form, beside the field, and no request is made.
 * - Whether the Core may ask the address is the Core's rule alone; its refusal has its own sentence.
 * - No address is asked while a search runs: the control is disabled with its reason, and a `200`
 *   that says the address was not asked is said, never drawn as a search of the address.
 * - It is the same gated control as "Search for cameras" (G13): the role, a recording and the
 *   Core's spacing disable it with the same reasons.
 */
export function CameraSearchAddress() {
  const { t } = useTranslation()
  const search = useCameraSearchController()
  const reasonOf = useGateReason()
  const presentCoreError = useCoreErrorPresenter()
  const reasonId = useId()
  const [text, setText] = useState('')
  const [problem, setProblem] = useState<AddressProblem | null>(null)
  const running = search.starting || search.panel === 'SEARCHING'
  const reason = reasonOf(search.block) ?? (running ? t('common.captureSearch.typedAddress.searching') : null)
  const blocked = search.block !== null || running

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (blocked) return
    const address = typedAddressOf(text)
    if (address === null) {
      // Refused in the form: nothing leaves the page.
      setProblem('FORM')
      return
    }
    setProblem(null)
    void search.start(address).then((answer) => {
      if (answer === null) return
      if (answer.ok) {
        if (!answer.search.created) setProblem('NOT_PROBED')
        return
      }
      const refusal = startRefusal(answer)
      if (refusal === 'ADDRESS_NOT_ALLOWED') setProblem('NOT_ALLOWED')
      // What neither the panel nor this form words goes to the shared presenter (an outage, a time-out, a 403).
      else if ((refusal === 'OTHER' || refusal === 'ROLE') && answer.failure !== null) presentCoreError(answer.failure)
    })
  }

  return (
    <section className="dev-search-progress" data-testid="camera-search-address" data-problem={problem ?? undefined} aria-label={t('common.captureSearch.typedAddress.title')}>
      <h3 className="dev-sel-group">{t('common.captureSearch.typedAddress.title')}</h3>
      <p className="dev-sel-reason" data-testid="camera-search-address-intro">
        {t('common.captureSearch.typedAddress.intro')}
      </p>
      <form className="dev-scan-head" onSubmit={onSubmit} noValidate data-testid="camera-search-address-form">
        <TextField
          value={text}
          onChange={(value) => {
            setText(value)
            setProblem(null)
          }}
          isInvalid={problem === 'FORM' || problem === 'NOT_ALLOWED'}
          isDisabled={search.block !== null}
        >
          <Label>{t('common.captureSearch.typedAddress.label')}</Label>
          <Input className="font-mono" inputMode="decimal" autoComplete="off" autoCapitalize="off" spellCheck={false} data-testid="camera-search-address-input" />
          {problem === 'FORM' ? (
            <FieldError data-testid="camera-search-address-form-error">{t('common.captureSearch.typedAddress.form')}</FieldError>
          ) : problem === 'NOT_ALLOWED' ? (
            <FieldError data-testid="camera-search-address-not-allowed">{t('common.captureSearch.typedAddress.notAllowed')}</FieldError>
          ) : (
            <Description>{t('common.captureSearch.typedAddress.hint')}</Description>
          )}
        </TextField>
        <span className="dev-search-control" data-block={search.block?.kind}>
          <Button type="submit" size="sm" variant="outline" isDisabled={blocked} isPending={search.starting} aria-describedby={reason === null ? undefined : reasonId} data-testid="camera-search-address-button">
            {search.starting ? <Spinner size="sm" color="current" aria-hidden="true" /> : <LocateFixed aria-hidden="true" size={14} />}
            {t('common.captureSearch.typedAddress.action')}
          </Button>
          {reason === null ? null : (
            <span id={reasonId} className="dev-sel-reason" data-testid="camera-search-address-reason">
              {reason}
            </span>
          )}
        </span>
      </form>
      {problem === 'NOT_PROBED' ? (
        <p className="dev-sel-reason" role="status" data-testid="camera-search-address-not-probed">
          {t('common.captureSearch.typedAddress.notProbed')}
        </p>
      ) : null}
    </section>
  )
}
