import { memo, useMemo } from 'react'
import { Chip, Description, Label } from '@heroui/react'
import { Cpu, FileBadge, KeyRound, KeySquare, Lock, type LucideIcon } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { DATE_PATTERNS, formatDate } from '@dems/shared/realtime'
import { useSim } from '@dems/shared/sim'
import { toneChipProps } from '@dems/shared/tokens'
import { colonFingerprint, daysUntil, expiryTone, shortHash } from './model'
import { Panel } from './panel'
import { useReportedSigningKey, useSelfCaptureCore } from '@/lib/own-capture'
import { keyEntries, ownCoreKeyEntries, type KeyEntry, type KeyEntryId } from './sim-adapter'
import { EXPIRY_TONE } from './tones'
import { useSimMinuteMs } from './use-security-data'

const KEY_ICON: Record<KeyEntryId, LucideIcon> = {
  DEVICE_CERT: FileBadge,
  EVIDENCE_SIGNING_KEY: KeyRound,
  TLS_SERVER: Lock,
  HARDWARE_ROOT: Cpu,
}

const KEY_LABEL = {
  DEVICE_CERT: 'securityAudit.keys.deviceCertificate',
  EVIDENCE_SIGNING_KEY: 'securityAudit.keys.signingKey',
  TLS_SERVER: 'securityAudit.keys.tlsServer',
  HARDWARE_ROOT: 'securityAudit.keys.hardwareRoot',
} as const satisfies Record<KeyEntryId, string>

function KeyItem({ entry, now }: { entry: KeyEntry; now: number }) {
  const { t } = useTranslation()
  const Icon = KEY_ICON[entry.id]
  const lines: string[] = []
  if (entry.source === 'NOT_REPORTED') {
    // Fix wave K (C-2): a key or certificate this Core does not report - no algorithm, no fingerprint, no residence claim.
    lines.push(t(`web.realCore.keys.notReported.${entry.id}`))
  } else if (entry.source === 'CORE') {
    lines.push([entry.algorithm, entry.keyId].filter(Boolean).join(' • '))
    lines.push(t('web.realCore.keys.signedWith', { evidenceId: entry.namedBy ?? '' }))
  } else if (entry.id === 'HARDWARE_ROOT') {
    lines.push(entry.algorithm, t('securityAudit.keys.tpmResident'))
  } else {
    const first = [entry.algorithm]
    if (entry.subject) first.push(`CN=${entry.subject}`)
    if (entry.keyId) first.push(entry.keyId)
    lines.push(first.join(' • '))
    if (entry.fingerprint) {
      const fp = entry.fingerprint.includes(':') ? entry.fingerprint : colonFingerprint(entry.fingerprint)
      lines.push(`${t('securityAudit.keys.fingerprint')} ${fp}`)
    }
    if (entry.publicKeyHex) lines.push(`${t('securityAudit.keys.publicKey')} ${shortHash(entry.publicKeyHex, 16)}…`)
    if (entry.serial) lines.push(`${t('securityAudit.keys.serial')} ${entry.serial}`)
  }
  const expiry =
    entry.expiresAt === null
      ? null
      : {
          tone: EXPIRY_TONE[expiryTone(entry.expiresAt, now)],
          text:
            entry.expiresAt <= now
              ? t('securityAudit.keys.expired')
              : t('securityAudit.keys.expiresIn', { count: daysUntil(entry.expiresAt, now) }),
          title: t('securityAudit.keys.expires', { date: formatDate(entry.expiresAt, DATE_PATTERNS.date) }),
        }

  return (
    <div className="sa-key" data-key={entry.id} data-source={entry.source}>
      <Icon className="sa-key-icon" aria-hidden="true" strokeWidth={1.75} />
      <div className="sa-key-main">
        <div className="sa-key-top">
          <Label className="sa-key-label">{t(KEY_LABEL[entry.id])}</Label>
          {entry.source === 'DEMO_PACKAGE' ? (
            <Chip size="sm" variant="soft" color="warning">
              {t('securityAudit.keys.demo')}
            </Chip>
          ) : null}
          {entry.source === 'SIMULATED' ? (
            <Chip size="sm" variant="soft" color="default">
              {t('securityAudit.keys.simulated')}
            </Chip>
          ) : null}
          {entry.source === 'NOT_REPORTED' ? (
            <Chip size="sm" variant="soft" color="default" data-testid={`key-not-reported-${entry.id}`}>
              {t('common.platformNotReported.value')}
            </Chip>
          ) : null}
          {entry.source === 'CORE' && entry.developmentKey === true ? (
            <Chip size="sm" variant="soft" color="warning" data-testid="key-development">
              {t('web.realCore.keys.developmentChip')}
            </Chip>
          ) : null}
          {entry.source === 'HARDWARE' ? (
            <Chip size="sm" variant="soft" {...toneChipProps('success')}>
              {t('securityAudit.keys.hardwareBound')}
            </Chip>
          ) : null}
          {expiry ? (
            <Chip size="sm" variant="soft" {...toneChipProps(expiry.tone)} title={expiry.title} data-testid={`expiry-${entry.id}`}>
              {expiry.text}
            </Chip>
          ) : null}
        </div>
        {lines.map((line) => (
          <Description key={line} className="sa-key-line sa-mono">
            {line}
          </Description>
        ))}
      </div>
    </div>
  )
}

export interface KeysPanelProps {
  className?: string
}

/**
 * Keys & certificates (01_specs §14.5.7, C11; design book §12.1, §21.3 Certificate and
 * KeyReference). The device certificate and the evidence signing key are the DEMO packages'
 * Ed25519 certificate and key (D67 (c); the simulator lists the same since step 54), labelled DEMO (P13).
 * Expiry chips follow the simulator clock once a minute (R8): > 90 days green, ≤ 90 amber, expired red.
 */
export const KeysPanel = memo(function KeysPanel({ className }: KeysPanelProps) {
  const { t } = useTranslation()
  const simKeys = useSim((s) => s.security.keys)
  const hardwareRoot = useSim((s) => s.device.identity.tpmModelFirmware)
  const now = useSimMinuteMs()
  // Fix wave K (C-2): a Core in its own capture reports one key - the one its sealed items are signed with.
  const selfCapture = useSelfCaptureCore()
  const signingKey = useReportedSigningKey()
  const reportedId = signingKey?.keyId ?? null
  const reportedAlgorithm = signingKey?.algorithm ?? null
  const reportedDevelopment = signingKey?.developmentKey ?? null
  const reportedBy = signingKey?.evidenceId ?? null
  const entries = useMemo(
    () =>
      selfCapture
        ? ownCoreKeyEntries(reportedId === null || reportedAlgorithm === null || reportedBy === null ? null : { keyId: reportedId, algorithm: reportedAlgorithm, developmentKey: reportedDevelopment, evidenceId: reportedBy })
        : keyEntries(simKeys, hardwareRoot),
    [selfCapture, reportedId, reportedAlgorithm, reportedDevelopment, reportedBy, simKeys, hardwareRoot],
  )
  return (
    <Panel id="keys" icon={KeySquare} title={t('securityAudit.keys.title')} className={className}>
      <div className="sa-keys">
        {entries.map((entry) => (
          <KeyItem key={entry.id} entry={entry} now={now} />
        ))}
      </div>
      <p className="sa-demo-note" data-testid="sa-keys-note">
        {selfCapture ? t('web.realCore.keys.note') : t('securityAudit.keys.demoNote')}
      </p>
    </Panel>
  )
})
