import { DemoMark } from '@/components/demo-mark'
import { useMemo, type RefObject } from 'react'
import {
  Button,
  Card,
  ComboBox,
  Description,
  FieldError,
  Form,
  Input,
  InputGroup,
  Label,
  ListBox,
  Select,
  Spinner,
  TextArea,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
} from '@heroui/react'
import { AnimatePresence, motion, type Variants } from 'motion/react'
import { ClipboardList, Gauge, ScanLine } from 'lucide-react'
import { Controller, useWatch, type Control, type FieldError as RhfFieldError } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { SESSION_INPUT_LIMITS, type SessionCreateFormValues } from '@dems/shared/api'
import {
  evaluatePrecheck,
  Permission,
  PRECHECK_ORDER,
  RECORDING_PROFILES,
  roleHas,
  ROOMS,
  useSim,
  type PrecheckEvaluation,
  type SimOperator,
  type SubjectType,
} from '@dems/shared/sim'
import { toneChipProps } from '@dems/shared/tokens'
import { tween, useMotionPolicy } from '@/motion'
import { cn } from '@/lib/utils'
import { useOwnCaptureCore, usePlatformNotReported } from '@/lib/own-capture'
import { isSessionMessage, SUBJECT_TONE, SUBJECT_TYPES } from './model'

export const INFO_FORM_ID = 'sn-info-form'

export interface InfoStepProps {
  control: Control<SessionCreateFormValues>
  /** Show every field error (after a submit attempt), not only touched fields. */
  submitted: boolean
  onSubmit: () => void
  onScan: () => void
  /** Delay before the field stagger (route enter, M-APP-04), ms. */
  enterDelayMs: number
  /**
   * Live mode (plan row W64, LB-1): the scan is in flight for longer than the reveal time. The
   * button shows the kit's pending state, with the `Spinner` in place of its icon. Never true in
   * Simulated mode, where the scan answers at once.
   */
  scanPending?: boolean
  /** The scan button's element (`aria-busy` while the scan is in flight, `usePendingControl`). */
  scanRef?: RefObject<HTMLButtonElement | null>
  /**
   * Live mode: the scan button names what it does (the Core server reserves the next number,
   * operation 32; nothing is scanned), with the words the mobile app shows
   * (`sessionNew.live.scanCaseNumber`: closing copy round, D164 DN-5). False in Simulated mode, where
   * the button keeps `sessionNew.info.caseNumber.scan`.
   */
  live?: boolean
}

function selectStartOperators(s: { operators: SimOperator[] }): SimOperator[] {
  return s.operators
}

/** The visible message for a field error (schema messages are `sessionNew.info.*` keys, D62). */
function useErrorText() {
  const { t } = useTranslation()
  return (error: RhfFieldError | undefined): string | null => {
    if (!error) return null
    return isSessionMessage(error.message) ? t(error.message) : t('common.errors.generic')
  }
}

/**
 * Step 1, Session Info (01_specs §14.5.11; research/04 §5.7; MB 3): kit `Form`, `TextField` with a
 * scan `Button isIconOnly`, `ToggleButtonGroup` subject type (Tersangka red / Saksi blue / Lainnya
 * neutral, EN gloss tooltips), `ComboBox` investigator, `Select` room and profile, `TextArea` notes,
 * `FieldError`. React Hook Form with the shared `sessionCreateSchema` lives in the page so the
 * values survive the step change. Motion (M-PG-NEW): rows stagger 30 ms; errors slide in (160).
 */
export function InfoStep({ control, submitted, onSubmit, onScan, enterDelayMs, scanPending = false, scanRef, live = false }: InfoStepProps) {
  const { t } = useTranslation()
  const scanLabel = t(live ? 'sessionNew.live.scanCaseNumber' : 'sessionNew.info.caseNumber.scan')
  const m = useMotionPolicy()
  const errorText = useErrorText()
  const operators = useSim(selectStartOperators)
  const investigators = useMemo(() => operators.filter((operator) => roleHas(operator.role, Permission.SESSION_START)), [operators])

  const container: Variants = {
    hidden: {},
    visible: { transition: { staggerChildren: m.flags.stagger ? m.seconds(30) : 0, delayChildren: m.seconds(enterDelayMs + 120) } },
  }
  const errorMotion = {
    initial: m.reduced ? { opacity: 0 } : { opacity: 0, y: -4 },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 0 },
    transition: tween('fast', 'standard', m.timeScale),
  }
  const show = (error: RhfFieldError | undefined, touched: boolean) => ((touched || submitted) && error ? errorText(error) : null)

  return (
    <div className="sn-info-grid" data-testid="sn-step-info">
      <Card className="sn-card sn-info-card">
        <header className="sn-card-header">
          <ClipboardList className="sn-card-icon" aria-hidden="true" strokeWidth={1.75} />
          <h2 className="sn-card-title">{t('sessionNew.info.title')}</h2>
        </header>
        <Form
          id={INFO_FORM_ID}
          validationBehavior="aria"
          className="sn-form"
          onSubmit={(event) => {
            event.preventDefault()
            onSubmit()
          }}
          aria-label={t('sessionNew.info.title')}
        >
          <motion.div className="sn-form-grid" variants={container} initial="hidden" animate="visible">
            <motion.div variants={m.variants.row} className="sn-field sn-field-case">
              <Controller
                control={control}
                name="caseNumber"
                render={({ field, fieldState }) => {
                  const message = show(fieldState.error, fieldState.isTouched)
                  return (
                    <TextField
                      name={field.name}
                      value={field.value}
                      onChange={field.onChange}
                      onBlur={field.onBlur}
                      isRequired
                      isInvalid={message !== null}
                      autoComplete="off"
                      data-testid="sn-field-case"
                    >
                      <Label>
                        {t('sessionNew.info.caseNumber.label')}
                        {/* Fix wave J (JW-17): every required field carries the mark, not only Subject Type. */}
                        <span className="sn-required" aria-hidden="true"> *</span>
                      </Label>
                      <InputGroup fullWidth>
                        <InputGroup.Input
                          ref={field.ref}
                          placeholder={t('sessionNew.info.caseNumber.placeholder')}
                          maxLength={SESSION_INPUT_LIMITS.caseNumberLength}
                          spellCheck={false}
                          className="sn-mono"
                          data-testid="sn-case-number"
                        />
                        <InputGroup.Suffix>
                          <Tooltip delay={300}>
                            <Button
                              ref={scanRef}
                              isIconOnly
                              size="sm"
                              variant="ghost"
                              aria-label={scanLabel}
                              onPress={onScan}
                              isPending={scanPending}
                              data-testid="sn-scan"
                            >
                              {scanPending ? <Spinner size="sm" color="current" aria-hidden="true" /> : <ScanLine className="size-4" aria-hidden="true" />}
                            </Button>
                            <Tooltip.Content placement="top">{scanLabel}</Tooltip.Content>
                          </Tooltip>
                        </InputGroup.Suffix>
                      </InputGroup>
                      <AnimatePresence initial={false}>
                        {message ? (
                          <motion.span key="error" {...errorMotion}>
                            <FieldError>{message}</FieldError>
                          </motion.span>
                        ) : null}
                      </AnimatePresence>
                    </TextField>
                  )
                }}
              />
            </motion.div>

            <motion.div variants={m.variants.row} className="sn-field sn-field-subject-type">
              <Controller
                control={control}
                name="subjectType"
                render={({ field, fieldState }) => {
                  const message = show(fieldState.error, fieldState.isTouched)
                  return (
                    <div className="sn-toggle-field" data-invalid={message ? 'true' : undefined}>
                      <span id="sn-subject-type-label" className="sn-label">
                        {t('sessionNew.info.subjectType.label')}
                        <span className="sn-required" aria-hidden="true">
                          *
                        </span>
                      </span>
                      <ToggleButtonGroup
                        aria-labelledby="sn-subject-type-label"
                        selectionMode="single"
                        selectedKeys={field.value ? new Set([field.value]) : new Set()}
                        onSelectionChange={(keys) => {
                          const [first] = [...keys]
                          field.onChange(first ?? undefined)
                          field.onBlur()
                        }}
                        fullWidth
                        className="sn-subject-group"
                        data-testid="sn-subject-type"
                      >
                        {SUBJECT_TYPES.map((type) => (
                          <SubjectToggle key={type} type={type} />
                        ))}
                      </ToggleButtonGroup>
                      <AnimatePresence initial={false}>
                        {message ? (
                          <motion.p key="error" role="alert" className="sn-field-error" {...errorMotion}>
                            {message}
                          </motion.p>
                        ) : null}
                      </AnimatePresence>
                    </div>
                  )
                }}
              />
            </motion.div>

            <motion.div variants={m.variants.row} className="sn-field">
              <Controller
                control={control}
                name="subjectName"
                render={({ field, fieldState }) => {
                  const message = show(fieldState.error, fieldState.isTouched)
                  return (
                    <TextField
                      name={field.name}
                      value={field.value}
                      onChange={field.onChange}
                      onBlur={field.onBlur}
                      isRequired
                      isInvalid={message !== null}
                      autoComplete="off"
                    >
                      <Label>
                        {t('sessionNew.info.subjectName.label')}
                        {/* Fix wave J (JW-17): every required field carries the mark, not only Subject Type. */}
                        <span className="sn-required" aria-hidden="true"> *</span>
                      </Label>
                      <Input
                        ref={field.ref}
                        placeholder={t('sessionNew.info.subjectName.placeholder')}
                        maxLength={SESSION_INPUT_LIMITS.subjectNameMax}
                        data-testid="sn-subject-name"
                      />
                      {/* Fix wave J (JW-17): the name was cut at the limit without a word. */}
                      {field.value.length >= SESSION_INPUT_LIMITS.subjectNameMax ? (
                        <Description data-testid="sn-subject-name-limit">{t('web.waveJ.sessionNew.nameLimit', { max: SESSION_INPUT_LIMITS.subjectNameMax })}</Description>
                      ) : null}
                      <AnimatePresence initial={false}>
                        {message ? (
                          <motion.span key="error" {...errorMotion}>
                            <FieldError>{message}</FieldError>
                          </motion.span>
                        ) : null}
                      </AnimatePresence>
                    </TextField>
                  )
                }}
              />
            </motion.div>

            <motion.div variants={m.variants.row} className="sn-field">
              <Controller
                control={control}
                name="investigatorId"
                render={({ field, fieldState }) => {
                  const message = show(fieldState.error, fieldState.isTouched)
                  return (
                    <ComboBox
                      name={field.name}
                      value={field.value || null}
                      onChange={(key) => field.onChange(typeof key === 'string' ? key : '')}
                      onBlur={field.onBlur}
                      isRequired
                      isInvalid={message !== null}
                      menuTrigger="focus"
                      data-testid="sn-investigator"
                    >
                      <Label>{t('sessionNew.info.investigator.label')}</Label>
                      <ComboBox.InputGroup>
                        <Input ref={field.ref} placeholder={t('sessionNew.info.investigator.placeholder')} data-testid="sn-investigator-input" />
                        <ComboBox.Trigger />
                      </ComboBox.InputGroup>
                      {message ? <FieldError>{message}</FieldError> : <Description>{t('sessionNew.info.investigator.hint')}</Description>}
                      <ComboBox.Popover>
                        <ListBox>
                          {investigators.map((operator) => (
                            <ListBox.Item key={operator.id} id={operator.id} textValue={operator.displayName}>
                              <span className="sn-option">
                                <span className="sn-option-name">{operator.displayName}</span>
                                <span className="sn-option-meta">{t(`common.roles.${operator.role}`)}</span>
                              </span>
                              <ListBox.ItemIndicator />
                            </ListBox.Item>
                          ))}
                        </ListBox>
                      </ComboBox.Popover>
                    </ComboBox>
                  )
                }}
              />
            </motion.div>

            <motion.div variants={m.variants.row} className="sn-field">
              <Controller
                control={control}
                name="room"
                render={({ field, fieldState }) => {
                  const message = show(fieldState.error, fieldState.isTouched)
                  return (
                    <Select
                      name={field.name}
                      value={field.value || null}
                      onChange={(key) => field.onChange(typeof key === 'string' ? key : '')}
                      onBlur={field.onBlur}
                      isRequired
                      isInvalid={message !== null}
                      data-testid="sn-room"
                    >
                      <Label>{t('sessionNew.info.room.label')}</Label>
                      <Select.Trigger>
                        <Select.Value />
                        <Select.Indicator />
                      </Select.Trigger>
                      {message ? <FieldError>{message}</FieldError> : null}
                      <Select.Popover>
                        <ListBox>
                          {ROOMS.map((room) => (
                            <ListBox.Item key={room} id={room} textValue={room}>
                              {room}
                              <ListBox.ItemIndicator />
                            </ListBox.Item>
                          ))}
                        </ListBox>
                      </Select.Popover>
                    </Select>
                  )
                }}
              />
            </motion.div>

            <motion.div variants={m.variants.row} className="sn-field">
              <Controller
                control={control}
                name="profileId"
                render={({ field, fieldState }) => {
                  const message = show(fieldState.error, fieldState.isTouched)
                  return (
                    <Select
                      name={field.name}
                      value={field.value || null}
                      onChange={(key) => field.onChange(typeof key === 'string' ? key : undefined)}
                      onBlur={field.onBlur}
                      isRequired
                      isInvalid={message !== null}
                      data-testid="sn-profile"
                    >
                      <Label>{t('sessionNew.info.profile.label')}</Label>
                      <Select.Trigger>
                        <Gauge className="size-4 text-accent" aria-hidden="true" />
                        <Select.Value />
                        <Select.Indicator />
                      </Select.Trigger>
                      {message ? <FieldError>{message}</FieldError> : null}
                      <Select.Popover>
                        <ListBox>
                          {RECORDING_PROFILES.map((profile) => (
                            <ListBox.Item key={profile.id} id={profile.id} textValue={t('sessionNew.info.profile.standard')}>
                              {t('sessionNew.info.profile.standard')}
                              <ListBox.ItemIndicator />
                            </ListBox.Item>
                          ))}
                        </ListBox>
                      </Select.Popover>
                    </Select>
                  )
                }}
              />
            </motion.div>

            <motion.div variants={m.variants.row} className="sn-field sn-field-notes">
              <Controller
                control={control}
                name="notes"
                render={({ field, fieldState }) => {
                  const message = show(fieldState.error, fieldState.isTouched)
                  const length = field.value?.length ?? 0
                  return (
                    <TextField
                      name={field.name}
                      value={field.value ?? ''}
                      onChange={field.onChange}
                      onBlur={field.onBlur}
                      isInvalid={message !== null}
                    >
                      <Label>{t('sessionNew.info.notes.label')}</Label>
                      <TextArea
                        ref={field.ref}
                        rows={3}
                        placeholder={t('sessionNew.info.notes.placeholder')}
                        maxLength={SESSION_INPUT_LIMITS.notesMax}
                        data-testid="sn-notes"
                      />
                      {message ? (
                        <FieldError>{message}</FieldError>
                      ) : (
                        <Description className="sn-count">
                          {t('sessionNew.info.notes.count', { count: length, max: SESSION_INPUT_LIMITS.notesMax.toLocaleString('en-US') })}
                        </Description>
                      )}
                    </TextField>
                  )
                }}
              />
            </motion.div>
          </motion.div>
          {/* Enter in a field submits; the visible Next lives in the footer (form="sn-info-form"). */}
          <button type="submit" hidden tabIndex={-1} aria-hidden="true" />
        </Form>
      </Card>
      <InfoAside control={control} investigators={investigators} />
    </div>
  )
}

function SubjectToggle({ type }: { type: SubjectType }) {
  const { t } = useTranslation()
  return (
    <Tooltip delay={300}>
      <ToggleButton id={type} className="sn-subject" data-tone={SUBJECT_TONE[type]} data-testid={`sn-subject-${type}`}>
        {t(`common.subjectType.${type}`)}
      </ToggleButton>
      <Tooltip.Content placement="top">{t(`common.subjectTypeGloss.${type}`)}</Tooltip.Content>
    </Tooltip>
  )
}

/** Readiness glance: primitive statuses only (R1), re-rendering when one changes. */
function selectReadiness(s: Parameters<typeof evaluatePrecheck>[0]): PrecheckEvaluation['status'][] {
  return PRECHECK_ORDER.map((id) => evaluatePrecheck(s, id).status)
}

/**
 * Step 1 side column: the session as typed so far, and the live state of the eight gate checks
 * (`evaluatePrecheck`, exported by the sim for live previews, 13_sim_engine §2.3).
 */
function InfoAside({ control, investigators }: { control: Control<SessionCreateFormValues>; investigators: SimOperator[] }) {
  const { t } = useTranslation()
  const values = useWatch({ control })
  const stated = useSim(selectReadiness)
  // Fix wave J (JW-04; truth rule 3c): "Security PASS" here, "Security: Not reported" on the Dashboard and "SECURE" in the
  // header were three answers to one question. A Core that states `security.platformNotReported` computed no posture:
  // its SECURITY row reads "Not reported" (a row that names a fault keeps it) and is not counted as ready.
  const platformNotReported = usePlatformNotReported()
  // The TIME row of a Core on its host clock is a NOTE (the gate counts it as no warning): it read "WARN" here.
  const hostClock = useOwnCaptureCore()
  const readiness: (PrecheckEvaluation['status'] | 'NOT_REPORTED' | 'NOTE')[] = stated.map((status, index) =>
    PRECHECK_ORDER[index] === 'SECURITY' && status !== 'BLOCK' && platformNotReported ? 'NOT_REPORTED' : PRECHECK_ORDER[index] === 'TIME' && status === 'WARN' && hostClock ? 'NOTE' : status,
  )
  const reported = readiness.filter((status) => status !== 'NOT_REPORTED' && status !== 'NOTE')
  const ready = reported.filter((status) => status === 'PASS').length
  const investigator = investigators.find((operator) => operator.id === values.investigatorId)
  const empty = <span className="sn-muted">{t('sessionNew.preview.empty')}</span>
  const subjectTone = values.subjectType ? toneChipProps(SUBJECT_TONE[values.subjectType]) : null

  return (
    <aside className="sn-aside" aria-label={t('sessionNew.preview.title')}>
      <Card className="sn-card sn-preview-card" data-testid="sn-preview">
        <header className="sn-card-header">
          <h2 className="sn-card-title">{t('sessionNew.preview.title')}</h2>
        </header>
        <dl className="sn-kv">
          <div>
            <dt>{t('sessionNew.ready.summary.caseNumber')}</dt>
            <dd className="sn-mono">{values.caseNumber?.trim() ? values.caseNumber.trim() : empty}</dd>
          </div>
          <div>
            <dt>{t('sessionNew.ready.summary.subject')}</dt>
            <dd className="sn-subject-line">
              {values.subjectName?.trim() ? <span className="sn-ellipsis">{values.subjectName.trim()}</span> : empty}
              {values.subjectType && subjectTone ? (
                <span className={cn('sn-subject-tag', subjectTone.className)} data-tone={SUBJECT_TONE[values.subjectType]}>
                  {t(`common.subjectType.${values.subjectType}`)}
                </span>
              ) : null}
            </dd>
          </div>
          <div>
            <dt>{t('sessionNew.ready.summary.investigator')}</dt>
            <dd>{investigator ? investigator.displayName : empty}</dd>
          </div>
          <div>
            <dt>{t('sessionNew.ready.summary.room')}</dt>
            <dd>{values.room || empty}</dd>
          </div>
          <div>
            <dt>{t('sessionNew.ready.summary.profile')}</dt>
            <dd>{values.profileId ? t('sessionNew.info.profile.standard') : empty}</dd>
          </div>
        </dl>
      </Card>
      <Card className="sn-card sn-readiness-card" data-testid="sn-readiness">
        <header className="sn-card-header">
          <h2 className="sn-card-title">{t('sessionNew.preview.readiness')}</h2>
          <DemoMark block="precheck-readiness" />
          <span className="sn-card-meta" data-testid="sn-readiness-count">
            {t('sessionNew.preview.readyCount', { ready, total: reported.length })}
          </span>
        </header>
        <ul className="sn-readiness">
          {PRECHECK_ORDER.map((id, index) => (
            <li key={id} data-status={readiness[index]}>
              <span className="sn-dot" aria-hidden="true" />
              <span className="sn-readiness-label">{t(`sessionNew.devices.checks.${id}`)}</span>
              {readiness[index] === 'NOTE' ? (
                <span className="sn-readiness-note" data-testid="sn-readiness-host-clock">{t('web.ownCore.time.value')}</span>
              ) : readiness[index] === 'NOT_REPORTED' ? (
                <span className="sn-readiness-note" data-testid="sn-readiness-not-reported">{t('common.platformNotReported.value')}</span>
              ) : (
                <span className="sr-only">{t(`common.precheckStatus.${readiness[index] ?? 'PASS'}`)}</span>
              )}
            </li>
          ))}
        </ul>
        <p className="sn-caption">{t('sessionNew.preview.readinessHint')}</p>
      </Card>
    </aside>
  )
}
