import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent, type RefObject } from 'react'
import {
  Button,
  Card,
  Chip,
  Description,
  Disclosure,
  FieldError,
  Form,
  InputGroup,
  Label,
  Separator,
  Spinner,
  TextField,
  Tooltip,
} from '@heroui/react'
import { animate, AnimatePresence, motion, type Variants } from 'motion/react'
import { Eye, EyeOff, KeyRound, Lock, ShieldAlert, ShieldCheck, User, Users } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { CoreMode } from '@dems/shared/live'
import { DEMO_OPERATOR_PASSWORD, useSim, type SimOperator, type SimState } from '@dems/shared/sim'
import { palette } from '@dems/shared/tokens'
import type { ModeSwitch } from '@/components/shell/mode-switch'
import { BorderBeam } from '@/components/ui/border-beam'
import { GlowLayer, springTransition, tween, useAmbientLoop, useMotionPolicy } from '@/motion'
import { cn } from '@/lib/utils'
import { BORDER_BEAM, HANDOFF, LOGIN_ACCENT_LOOP_GROUP, SHEEN_LOOP_MS, type LoginChoreography } from './login-choreography'
import { LoginAlert } from './login-alert'
import type { CoreLinkView } from './login-model'
import { ModeSelector } from './mode-selector'
import type { LoginController } from './use-login-controller'

export interface AuthCardProps {
  controller: LoginController
  choreography: LoginChoreography
  /** The hand-off started (M-APP-01): the card plays its exit, then `onExitComplete` navigates. */
  leaving: boolean
  onExitComplete: () => void
  /** Presentation mode hides the "Demo operators" Disclosure (§14.8, D28/Q14; ruling M8). */
  presentation: boolean
  /** The data mode of this page load and its confirmed change; no control unless the build offers the choice (MD-4). */
  modeSwitch: ModeSwitch
  /** The M-C-22 shake target (the page owns the shake so the controller can trigger it). */
  shakeRef: RefObject<HTMLDivElement | null>
  usernameRef: RefObject<HTMLInputElement | null>
  passwordRef: RefObject<HTMLInputElement | null>
}

const selectDeviceId = (s: SimState) => s.device.id

/**
 * The Login auth card (01_specs §14.8 "Auth card"; research/04 §5.8; mobile Login fields per
 * DEMS-Mobile.png screen 1: Username with a user icon, Password with a lock icon and an eye
 * toggle, a gold Sign In with dark text per D28/Q5, and the simulated alternative sign-in).
 *
 * Kit only (D6): `Card`, `Form`, `TextField` + `InputGroup`, `FieldError`, `Description`,
 * `Button` (+ `Spinner`), `Separator`, `Disclosure`, `Chip`, `Tooltip`, `Alert` (in LoginAlert),
 * plus MU BorderBeam (one lap) and the motion kit's GlowLayer.
 *
 * Credentials: inputs have no `name` and the form posts nowhere (submission is intercepted), so a
 * password can never reach a URL even if a native submit fired (AC-50).
 *
 * Live mode (backend task 04_client_integration_spec §5.5; plan row W55), the same card on the
 * Core server:
 * - no security-key button and no "or" divider: the server has no such operation (WS-8, Q11);
 * - the demo operators are the three seeded ones of the shared constant, without a role chip or
 *   any other server data, under one plain sentence that says what the disclosure is (WS-9, C1,
 *   C2); hidden in presentation mode as before (C3);
 * - the trust line says what is true: the console signs in to the Core server and does not pair
 *   (WS-7, Q13);
 * - the offline Alert offers "Use Simulated mode" in a build that offers the choice (§3.5).
 * In a dev build the card also carries the mode selector (§3.2), in both modes.
 */
export function AuthCard({
  controller,
  choreography,
  leaving,
  onExitComplete,
  presentation,
  modeSwitch,
  shakeRef,
  usernameRef,
  passwordRef,
}: AuthCardProps) {
  const { t } = useTranslation()
  const m = useMotionPolicy()
  const frameRef = useRef<HTMLDivElement>(null)
  const [showPassword, setShowPassword] = useState(false)
  const [capsLock, setCapsLock] = useState(false)
  const [beamDone, setBeamDone] = useState(false)
  const {
    username,
    password,
    change,
    blur,
    submit,
    signInWithSecurityKey,
    fill,
    pending,
    accepted,
    notice,
    fieldErrors,
    credentialsFlagged,
    lockout,
    unlockPulse,
    lockKey,
    coreRetry,
    submitDisabled,
    operators,
    paired,
  } = controller
  const formDisabled = pending !== null || accepted !== null || lockout.locked
  const isLive = controller.mode === CoreMode.LIVE

  // R1 enter at t = 1,200 (`gentle`, rise 12); M-APP-01 exit at t = 150 (300, `exit`). The exit's
  // completion is the commit point: the page navigates and the emblem flight starts.
  const cardVariants: Variants = m.reduced
    ? {
        hidden: { opacity: 0 },
        visible: { opacity: 1, transition: tween('fast', 'standard', m.timeScale) },
        exit: { opacity: 0, transition: tween(HANDOFF.reducedFadeMs, 'exit', m.timeScale) },
      }
    : {
        hidden: { opacity: 0, y: 12, scale: 1 },
        visible: {
          opacity: 1,
          y: 0,
          scale: 1,
          transition: { ...springTransition('gentle', m.timeScale), delay: m.seconds(choreography.cardMs) },
        },
        exit: {
          opacity: 0,
          y: HANDOFF.cardDropPx,
          scale: HANDOFF.cardScale,
          transition: { ...tween(HANDOFF.cardMs, 'exit', m.timeScale), delay: m.seconds(HANDOFF.cardDelayMs) },
        },
      }

  // M-C-23: BorderBeam runs ONE lap on entry (review 40 R7 / m10): mounted only while its ambient
  // slot is granted (the accent slot it shares with Particles and the offline dot, so the page stays
  // at ≤ 4 loops), with `repeat: 0`; it unmounts once the lap is done. Off under reduced motion.
  const beam = useAmbientLoop('border-beam-lap', {
    ref: frameRef,
    group: LOGIN_ACCENT_LOOP_GROUP,
    enabled: !beamDone && !leaving,
  })
  useEffect(() => {
    if (!beam.running) return undefined
    const id = setTimeout(() => setBeamDone(true), m.seconds(choreography.beamDelayMs + BORDER_BEAM.durationS * 1000) * 1000)
    return () => clearTimeout(id)
  }, [beam.running, m, choreography.beamDelayMs])

  // Username takes focus once the card has settled (M-PG-LOGIN t = 1,200 + spring), unless the
  // operator already moved focus somewhere.
  useEffect(() => {
    const id = setTimeout(() => {
      const active = document.activeElement
      if (!active || active === document.body) usernameRef.current?.focus()
    }, m.seconds(choreography.focusAtMs) * 1000)
    return () => clearTimeout(id)
  }, [m, choreography.focusAtMs, usernameRef])

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    submit()
  }

  const onPasswordKey = (event: KeyboardEvent<HTMLInputElement>) => {
    const state = event.getModifierState?.('CapsLock') ?? false
    if (state !== capsLock) setCapsLock(state)
  }

  return (
    <motion.div
      className="dems-login-card-wrap"
      variants={cardVariants}
      initial="hidden"
      animate={leaving ? 'exit' : 'visible'}
      onAnimationComplete={(definition) => {
        if (definition === 'exit') onExitComplete()
      }}
      data-testid="login-card"
    >
      <div ref={shakeRef} className="dems-login-card-shake">
        <div ref={frameRef} className="dems-login-card-frame" {...beam.attrs}>
          <GlowLayer level={2} pulseKey={unlockPulse} />
          <Card className="dems-login-card" aria-labelledby="login-title">
            <Card.Header className="dems-login-card-header">
              <h1 id="login-title" className="text-foreground">
                <span className="text-h1">{t('login.title')}</span>
              </h1>
              <p className="text-foreground-2">
                <span className="text-body">{t('login.subtitle')}</span>
              </p>
            </Card.Header>
            <Card.Content className="dems-login-card-content">
              <LoginAlert
                notice={notice}
                lockKey={lockKey}
                coreRetry={coreRetry}
                reconnecting={controller.heartbeatState === 'CONNECTING'}
                arrivalDelayMs={choreography.noticeMs}
                onUseSimulated={isLive && modeSwitch.selectable ? () => modeSwitch.request(CoreMode.SIMULATED) : null}
              />
              <Form className="dems-login-form" validationBehavior="aria" method="post" onSubmit={onSubmit} aria-labelledby="login-title">
                <TextField
                  className="dems-login-field"
                  value={username}
                  onChange={(value) => change('username', value)}
                  onBlur={() => blur('username')}
                  isRequired
                  isInvalid={Boolean(fieldErrors.username) || credentialsFlagged}
                  isDisabled={formDisabled}
                  autoComplete="username"
                  data-testid="login-username-field"
                >
                  <Label>{t('login.username.label')}</Label>
                  <InputGroup fullWidth>
                    <InputGroup.Prefix>
                      <User size={18} aria-hidden="true" className="dems-login-field-icon" />
                    </InputGroup.Prefix>
                    <InputGroup.Input
                      ref={usernameRef}
                      placeholder={t('login.username.placeholder')}
                      spellCheck={false}
                      autoCapitalize="none"
                      autoCorrect="off"
                    />
                  </InputGroup>
                  {fieldErrors.username ? <FieldError>{t(fieldErrors.username)}</FieldError> : null}
                </TextField>

                <TextField
                  className="dems-login-field"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(value) => change('password', value)}
                  onBlur={() => blur('password')}
                  isRequired
                  isInvalid={Boolean(fieldErrors.password) || credentialsFlagged}
                  isDisabled={formDisabled}
                  autoComplete="current-password"
                  data-testid="login-password-field"
                >
                  <Label>{t('login.password.label')}</Label>
                  <InputGroup fullWidth>
                    <InputGroup.Prefix>
                      <Lock size={18} aria-hidden="true" className="dems-login-field-icon" />
                    </InputGroup.Prefix>
                    <InputGroup.Input
                      ref={passwordRef}
                      placeholder={t('login.password.placeholder')}
                      spellCheck={false}
                      autoCapitalize="none"
                      autoCorrect="off"
                      onKeyDown={onPasswordKey}
                      onKeyUp={onPasswordKey}
                    />
                    <InputGroup.Suffix>
                      <PasswordToggle shown={showPassword} disabled={formDisabled} onToggle={() => setShowPassword((on) => !on)} />
                    </InputGroup.Suffix>
                  </InputGroup>
                  <AnimatePresence initial={false}>
                    {capsLock ? (
                      <Description className="dems-login-caps">
                        <motion.span
                          className="inline-block"
                          initial={m.reduced ? { opacity: 0 } : { opacity: 0, y: 4 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0 }}
                          transition={tween('fast', 'standard', m.timeScale)}
                        >
                          {t('login.password.capsLock')}
                        </motion.span>
                      </Description>
                    ) : null}
                  </AnimatePresence>
                  {fieldErrors.password ? <FieldError>{t(fieldErrors.password)}</FieldError> : null}
                </TextField>

                <SubmitButton pending={pending === 'password'} disabled={submitDisabled} />

                {/* WS-8: the security key is a simulated alternative; the Core server has no such operation. */}
                {isLive ? null : (
                  <>
                    <div className="dems-login-divider" aria-hidden="true">
                      <Separator className="flex-1" />
                      <span className="text-muted">
                        <span className="text-caption">{t('login.divider')}</span>
                      </span>
                      <Separator className="flex-1" />
                    </div>

                    <Button
                      variant="outline"
                      fullWidth
                      className="dems-login-key"
                      onPress={signInWithSecurityKey}
                      isDisabled={submitDisabled}
                      isPending={pending === 'security-key'}
                      data-testid="login-security-key"
                    >
                      {pending === 'security-key' ? <Spinner size="sm" color="current" /> : <KeyRound size={18} aria-hidden="true" />}
                      {pending === 'security-key' ? t('login.securityKey.prompt') : t('login.securityKey.button')}
                    </Button>
                  </>
                )}
              </Form>

              {presentation ? null : (
                <DemoOperators operators={operators} disabled={formDisabled} onPick={fill} live={isLive} />
              )}

              <ModeSelector modeSwitch={modeSwitch} disabled={pending !== null || accepted !== null} />

              {isLive ? <LiveTrustLine coreLink={controller.coreLink} /> : <SimulatedTrustLine paired={paired} />}
            </Card.Content>
          </Card>
          {beam.running && !beamDone ? (
            <BorderBeam
              size={BORDER_BEAM.size}
              duration={m.seconds(BORDER_BEAM.durationS * 1000)}
              colorFrom={palette.gold}
              colorTo={palette.bronze}
              borderWidth={1.5}
              transition={{ repeat: 0, delay: m.seconds(choreography.beamDelayMs) }}
            />
          ) : null}
        </div>
      </div>
    </motion.div>
  )
}

/**
 * Gold Sign In with dark text (D28/Q5) and a Spinner while pending. M-C-16: a sheen crosses once
 * on hover (CSS, `sheen` 700 `luxe`); M-C-22: while pending the sheen loops every 1.4 s.
 */
function SubmitButton({ pending, disabled }: { pending: boolean; disabled: boolean }) {
  const { t } = useTranslation()
  const m = useMotionPolicy()
  const sheenRef = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    const sheen = sheenRef.current
    if (!pending || m.reduced || !sheen) return undefined
    const control = animate(
      sheen,
      { transform: ['translateX(-100%)', 'translateX(100%)'] },
      { duration: m.seconds(SHEEN_LOOP_MS), ease: 'linear', repeat: Infinity },
    )
    return () => {
      control.stop()
      sheen.style.transform = ''
    }
  }, [pending, m])

  return (
    <Button
      type="submit"
      variant="primary"
      fullWidth
      className="dems-login-submit"
      isDisabled={disabled && !pending}
      isPending={pending}
      data-testid="login-submit"
      data-pending={pending ? 'true' : 'false'}
    >
      <span ref={sheenRef} className={cn('dems-login-sheen', pending && 'dems-login-sheen-loop')} aria-hidden="true" />
      {pending ? <Spinner size="sm" color="current" /> : null}
      <span className="dems-login-submit-label">{pending ? t('login.submitting') : t('login.submit')}</span>
    </Button>
  )
}

/**
 * The eye toggle (M-C-16 "Password eye": icon cross-fade plus rotate 90°, `fast`). Its name is
 * visually hidden text rather than `aria-label`, so the password input stays the only element
 * labelled "Password" (label queries in the route tests, and screen readers' form mode).
 */
function PasswordToggle({ shown, disabled, onToggle }: { shown: boolean; disabled: boolean; onToggle: () => void }) {
  const { t } = useTranslation()
  const m = useMotionPolicy()
  const transition = tween('fast', 'standard', m.timeScale)
  return (
    <Button
      isIconOnly
      size="sm"
      variant="ghost"
      className="dems-login-eye"
      onPress={onToggle}
      isDisabled={disabled}
      data-testid="login-password-toggle"
      data-shown={shown ? 'true' : 'false'}
    >
      <AnimatePresence mode="wait" initial={false}>
        <motion.span
          key={shown ? 'hide' : 'show'}
          className="inline-flex"
          initial={m.reduced ? { opacity: 0 } : { opacity: 0, rotate: -90 }}
          animate={{ opacity: 1, rotate: 0 }}
          exit={m.reduced ? { opacity: 0 } : { opacity: 0, rotate: 90 }}
          transition={transition}
          aria-hidden="true"
        >
          {shown ? <EyeOff size={18} /> : <Eye size={18} />}
        </motion.span>
      </AnimatePresence>
      <span className="sr-only">{shown ? t('login.password.hide') : t('login.password.show')}</span>
    </Button>
  )
}

/** The §20.1 trust line of the simulator: the console's simulated pairing (the line as it always was). */
function SimulatedTrustLine({ paired }: { paired: boolean }) {
  const { t } = useTranslation()
  const deviceId = useSim(selectDeviceId)
  return (
    <Tooltip delay={300}>
      <Tooltip.Trigger className="dems-login-trust" data-testid="login-trust-line">
        <ShieldCheck size={16} aria-hidden="true" className="text-success" />
        <span className="text-caption">
          {paired ? t('login.trustLine', { deviceId }) : t('login.trustLineUnpaired', { deviceId })}
        </span>
      </Tooltip.Trigger>
      <Tooltip.Content placement="bottom" offset={8}>
        {t('login.trustTooltip')}
      </Tooltip.Content>
    </Tooltip>
  )
}

/**
 * WS-7 (Q13): the trust line on the Core server. The web console signs in with a session cookie
 * and does not pair, so the line says so; it reads no pairing state. While the Core server cannot
 * be reached it says that instead, beside the offline Alert (§3.2).
 */
function LiveTrustLine({ coreLink }: { coreLink: CoreLinkView }) {
  const { t } = useTranslation()
  const reachable = coreLink !== 'offline'
  return (
    <Tooltip delay={300}>
      <Tooltip.Trigger className="dems-login-trust" data-testid="login-trust-line" data-reachable={reachable ? 'true' : 'false'}>
        {reachable ? (
          <ShieldCheck size={16} aria-hidden="true" className="text-success" />
        ) : (
          <ShieldAlert size={16} aria-hidden="true" className="text-warning" />
        )}
        <span className="text-caption">{reachable ? t('login.live.trustLine') : t('common.coreLink.lostTitle')}</span>
      </Tooltip.Trigger>
      <Tooltip.Content placement="bottom" offset={8}>
        {t('login.live.trustTooltip')}
      </Tooltip.Content>
    </Tooltip>
  )
}

/**
 * "Demo operators" (§14.8, D25, D28/Q14): collapsed by default; each row fills the form with the
 * operator's username and the published demo password. Roles are a demo assumption (book gap G1).
 *
 * `live` (WS-9; conditions C1 and C2 of SR-63): one plain sentence above everything says what the
 * disclosure is, and no row shows a role chip or anything else the Core server holds: a role is
 * server data and may have changed. The published password is accepted by the Core server only
 * while every listener is on loopback (C4).
 */
function DemoOperators({
  operators,
  disabled,
  onPick,
  live,
}: {
  operators: readonly SimOperator[]
  disabled: boolean
  onPick: (operator: SimOperator) => void
  live: boolean
}) {
  const { t } = useTranslation()
  return (
    <Disclosure className="dems-login-demo" data-testid="login-demo-operators">
      <Disclosure.Heading>
        <Disclosure.Trigger className="dems-login-demo-trigger">
          <Users size={16} aria-hidden="true" />
          <span className="text-body">{t('login.demoOperators.title')}</span>
          <Disclosure.Indicator className="ml-auto" />
        </Disclosure.Trigger>
      </Disclosure.Heading>
      <Disclosure.Content>
        <Disclosure.Body className="dems-login-demo-body">
          {live ? (
            <p className="dems-login-demo-notice" data-testid="login-demo-notice">
              <span className="text-caption">{t('login.live.demoNotice')}</span>
            </p>
          ) : null}
          <p className="text-foreground-2">
            <span className="text-caption">{t('login.demoOperators.hint')}</span>
          </p>
          <p className="text-muted">
            <span className="text-caption font-mono">{t('login.demoOperators.password', { password: DEMO_OPERATOR_PASSWORD })}</span>
          </p>
          <ul className="dems-login-demo-list">
            {operators.map((operator) => (
              <li key={operator.id}>
                <Button
                  variant="ghost"
                  fullWidth
                  className="dems-login-operator"
                  onPress={() => onPick(operator)}
                  isDisabled={disabled}
                  data-testid={`login-operator-${operator.username}`}
                >
                  <span className="dems-login-operator-initials" aria-hidden="true">
                    {operator.initials}
                  </span>
                  <span className="dems-login-operator-text">
                    <span className="text-foreground">
                      <span className="text-body">{operator.displayName}</span>
                    </span>
                    <span className="text-muted">
                      <span className="text-caption font-mono">{operator.username}</span>
                    </span>
                  </span>
                  {live ? null : (
                    <Chip size="sm" variant="soft" color={roleColor(operator.role)} className="ml-auto">
                      <Chip.Label>{t(`common.roles.${operator.role}`)}</Chip.Label>
                    </Chip>
                  )}
                </Button>
              </li>
            ))}
          </ul>
        </Disclosure.Body>
      </Disclosure.Content>
    </Disclosure>
  )
}

function roleColor(role: SimOperator['role']): 'accent' | 'success' | 'default' {
  if (role === 'SUPERVISOR') return 'accent'
  if (role === 'INVESTIGATOR') return 'success'
  return 'default'
}
