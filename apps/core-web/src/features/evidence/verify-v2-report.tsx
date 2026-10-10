import { Alert, Chip } from '@heroui/react'
import { CircleCheck, CircleMinus, CircleX, FileText, FlaskConical, ShieldQuestion } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { V2_SIGNING_KEY_LINE, V2_SOURCES_LINE, v2CheckName, v2FragmentLine, v2Rows, type V2Check, type V2Notice, type V2Row, type V2SigningKey, type V2Sources, type VerifyV2Answer } from './verify-v2'

export interface VerifyV2ReportProps {
  answer: VerifyV2Answer
}

/**
 * The schema-v2 result of one Verify run, as the Core server answered it (blueprint row 87;
 * evidence package spec §D, §F.3; UX spec flow 5 step 6).
 *
 * Top to bottom: FIRST the source line (row 92; R-11, spec §D.1: "DEVELOPMENT SOURCES — this
 * package was not recorded from production devices." with one entry per source, or the declared
 * production line, or "not trustworthy"; never collapsed, and nothing at all when the answer carries
 * no `sources` block); the transcript state of the package (row 119's fixed lines) and the
 * interrupted mark, when the answer carries them; one row per camera file (stored bytes, decrypted
 * bytes, fragment chain), the transcript hash, the manifest, the signature; on a failure the
 * fragment the answer names ("VIDEO-02 fragment 3 tampered (…)"); then the per-check list V-01 to
 * V-15, when the answer carries the report. The source line never changes the verdict. Every value drawn is the answer's: a part the answer does not carry is
 * not drawn, and nothing here is animated, paced or counted (the result appears whole).
 */
export function VerifyV2Report({ answer }: VerifyV2ReportProps) {
  const { t } = useTranslation()
  const rows = v2Rows(answer)
  const failed = answer.verdict === 'FAIL'
  const namesPlace = answer.failedFragments.length > 0 || answer.chainBreaks.length > 0
  const fileFailed = answer.files.some((file) => !file.ok)

  return (
    <div className="flex flex-col gap-3" data-testid="evidence-verify-v2" data-verdict={answer.verdict} data-overall={answer.overall ?? undefined}>
      {answer.sources !== null ? <SourcesLine sources={answer.sources} /> : null}
      {answer.signingKey === 'DEVELOPMENT' || answer.signingKey === 'NOT_ESTABLISHED' ? <SigningKeyLine state={answer.signingKey} /> : null}
      {answer.transcriptState !== null ? (
        <p className="evi-caption inline-flex items-center gap-2" data-testid="evidence-v2-transcript-state" data-code={answer.transcriptState}>
          <FileText className="size-4 shrink-0" aria-hidden="true" />
          <span className="evi-strong">{t(`evidence.verifyV2.transcriptState.${answer.transcriptState}`)}</span>
        </p>
      ) : null}
      {answer.interrupted === true ? (
        <p className="evi-caption" data-testid="evidence-v2-interrupted">
          {t('evidence.verifyV2.interrupted')}
        </p>
      ) : null}

      <ol className="evi-checks evi-checks-full" data-testid="evidence-v2-rows" aria-label={t('evidence.verifyV2.resultTitle')}>
        {rows.map((row) => (
          <ResultRow key={row.id} row={row} />
        ))}
      </ol>

      {failed && namesPlace ? (
        <Alert status="danger" data-testid="evidence-v2-fragments">
          <Alert.Indicator />
          <Alert.Content>
            <Alert.Title>{t('evidence.verifyV2.fragment.title')}</Alert.Title>
            <Alert.Description>
              <ul className="m-0 list-none p-0">
                {answer.failedFragments.map((fragment) => (
                  <li key={`${fragment.trackId}#${fragment.seq}`} data-fragment={`${fragment.trackId}#${fragment.seq}`} data-reason={fragment.reason ?? undefined}>
                    {v2FragmentLine(fragment, t)}
                  </li>
                ))}
                {answer.chainBreaks.map((chain) => (
                  <li key={chain.trackId} data-chain={`${chain.trackId}#${chain.fromSeq}`}>
                    {t('evidence.verifyV2.fragment.chainOnly', { track: chain.trackId, from: chain.fromSeq })}
                  </li>
                ))}
                {answer.failedFragmentCount !== null && answer.failedFragmentCount > answer.failedFragments.length ? (
                  <li data-testid="evidence-v2-fragments-more">{t('evidence.verifyV2.fragment.more', { count: answer.failedFragmentCount - answer.failedFragments.length })}</li>
                ) : null}
              </ul>
            </Alert.Description>
          </Alert.Content>
        </Alert>
      ) : null}
      {failed && !namesPlace && fileFailed ? (
        <p className="evi-caption" data-testid="evidence-v2-fragment-not-named">
          {t('evidence.verifyV2.fragment.notNamed')}
        </p>
      ) : null}

      {answer.checks !== null ? <CheckReport checks={answer.checks} /> : null}
      {answer.notices.length > 0 ? <Notices notices={answer.notices} /> : null}
    </div>
  )
}

/** The most audio intervals listed under the line; the rest are counted (a long session switches often). */
const SOURCE_INTERVALS_SHOWN = 8

/**
 * The source line and its entries. A development line is a warning Alert with an icon and the
 * words (never colour alone); "not trustworthy" is a danger Alert; the declared production line is
 * plain text. `role="status"`: it is a statement about the package, not an error of this run.
 */
/**
 * THE SIGNING-KEY LINE (fix pass F-M7, R88-07; D178), directly after the source line and never
 * collapsed. A development key is a warning on a result that passed as on one that failed; a key
 * that is not established is said in the danger tone. A key without the mark draws nothing.
 */
function SigningKeyLine({ state }: { state: Exclude<V2SigningKey, 'NOT_DEVELOPMENT'> }) {
  const { t } = useTranslation()
  const development = state === 'DEVELOPMENT'
  const Icon = development ? FlaskConical : ShieldQuestion
  return (
    <Alert status={development ? 'warning' : 'danger'} role="status" data-testid="evidence-v2-signing-key" data-signing-key={state}>
      <Alert.Indicator>
        <Icon className="size-4" aria-hidden="true" />
      </Alert.Indicator>
      <Alert.Content>
        <Alert.Title>{t(V2_SIGNING_KEY_LINE[state])}</Alert.Title>
      </Alert.Content>
    </Alert>
  )
}

/** WHAT THE PACKAGE SIGNATURE DOES NOT COVER (R88-06): each statement of the verifier, with the Core's own line. */
function Notices({ notices }: { notices: readonly V2Notice[] }) {
  const { t } = useTranslation()
  return (
    <section className="flex flex-col gap-1" data-testid="evidence-v2-notices" aria-label={t('evidence.verifyV2Key.noticesTitle')}>
      <p className="evi-caption evi-strong">{t('evidence.verifyV2Key.noticesTitle')}</p>
      {notices.map((notice) => (
        <p key={notice.code} className="evi-caption" role="note" data-testid={`evidence-v2-notice-${notice.code}`}>
          {notice.report}
        </p>
      ))}
    </section>
  )
}

function SourcesLine({ sources }: { sources: V2Sources }) {
  const { t } = useTranslation()
  const line = t(V2_SOURCES_LINE[sources.state])
  if (sources.state === 'DECLARED_PRODUCTION') {
    return (
      <p className="evi-caption evi-strong" role="status" data-testid="evidence-v2-sources" data-sources={sources.state}>
        {line}
      </p>
    )
  }
  const development = sources.state === 'DEVELOPMENT'
  const Icon = development ? FlaskConical : ShieldQuestion
  const shown = sources.audioIntervals.slice(0, SOURCE_INTERVALS_SHOWN)
  const more = sources.audioIntervals.length - shown.length
  return (
    <Alert status={development ? 'warning' : 'danger'} role="status" data-testid="evidence-v2-sources" data-sources={sources.state}>
      <Alert.Indicator>
        <Icon className="size-4" aria-hidden="true" />
      </Alert.Indicator>
      <Alert.Content>
        <Alert.Title>{line}</Alert.Title>
        {development ? (
          <Alert.Description>
            <ul className="m-0 list-none p-0" aria-label={t('evidence.sources.entriesTitle')} data-testid="evidence-v2-source-entries">
              {sources.tracks.map((track) => (
                <li key={track.trackId} data-source-track={track.trackId} data-source-class={track.sourceClass}>
                  {t('evidence.sources.track', { track: track.trackId, device: track.deviceId, kind: t(`evidence.sources.kind.${track.sourceClass}`) })}
                </li>
              ))}
              {shown.map((interval) => (
                <li key={interval.seq} data-source-interval={interval.seq} data-source-class={interval.sourceClass}>
                  {t('evidence.sources.interval', { seq: interval.seq, device: interval.micDeviceId, kind: t(`evidence.sources.kind.${interval.sourceClass}`) })}
                </li>
              ))}
              {more > 0 ? <li>{t('evidence.sources.moreIntervals', { count: more })}</li> : null}
            </ul>
          </Alert.Description>
        ) : null}
      </Alert.Content>
    </Alert>
  )
}

function ResultRow({ row }: { row: V2Row }) {
  const { t } = useTranslation()
  const Icon = row.ok ? CircleCheck : CircleX
  const part = (ok: boolean) => t(`evidence.verifyV2.outcome.${ok ? 'PASS' : 'FAIL'}`)
  const label = row.file
    ? t('evidence.verifyV2.file', { track: row.file.trackId })
    : t(`evidence.verifyV2.rows.${row.id as 'transcript' | 'manifest' | 'signature'}`)
  return (
    <li className="evi-check" data-check={row.id} data-phase={row.ok ? 'pass' : 'fail'} data-source="core">
      <span className="evi-check-icon" aria-hidden="true">
        <Icon className="size-4" />
      </span>
      <span className="evi-check-label">{label}</span>
      <span className="evi-check-status">
        <span className="evi-caption evi-strong">{part(row.ok)}</span>
      </span>
      {row.file ? (
        <span className="evi-check-values">
          <span className="evi-caption" data-part="stored" data-ok={row.file.storedOk ? 'true' : 'false'}>
            {t('evidence.verifyV2.fileParts', { stored: part(row.file.storedOk), plain: part(row.file.plainOk), chain: part(row.file.chainOk) })}
          </span>
          {row.file.fragmentCount !== null ? <span className="evi-caption">{t('evidence.verifyV2.fragments', { count: row.file.fragmentCount })}</span> : null}
        </span>
      ) : null}
    </li>
  )
}

const CHECK_PHASE = { PASS: 'pass', FAIL: 'fail', SKIPPED: 'pending' } as const
const CHECK_ICON = { PASS: CircleCheck, FAIL: CircleX, SKIPPED: CircleMinus } as const

function CheckReport({ checks }: { checks: readonly V2Check[] }) {
  const { t } = useTranslation()
  const passed = checks.filter((check) => check.status === 'PASS').length
  return (
    <section className="flex flex-col gap-2" data-testid="evidence-v2-checks" aria-label={t('evidence.verifyV2.checksTitle')}>
      <span className="evi-caption">
        <span className="evi-strong">{t('evidence.verifyV2.checksTitle')}</span>
        {' · '}
        {t('evidence.verifyV2.checksSummary', { passed, total: checks.length })}
      </span>
      <ol className="evi-checks evi-checks-compact">
        {checks.map((check) => {
          const Icon = CHECK_ICON[check.status]
          return (
            <li key={check.id} className="evi-check" data-check={check.id} data-status={check.status} data-phase={CHECK_PHASE[check.status]}>
              <span className="evi-check-icon" aria-hidden="true">
                <Icon className="size-4" />
              </span>
              <span className="evi-check-label">{v2CheckName(check.id, t)}</span>
              <span className="evi-check-status">
                {check.status === 'FAIL' && check.failureClass !== null ? (
                  <Chip size="sm" variant="soft" color="danger">
                    <Chip.Label>{t(`evidence.verifyV2.failureClass.${check.failureClass}`)}</Chip.Label>
                  </Chip>
                ) : null}
                <span className="evi-caption evi-strong">
                  {check.status === 'SKIPPED' && check.skipped !== null ? t(`evidence.verifyV2.skipped.${check.skipped}`) : t(`evidence.verifyV2.outcome.${check.status}`)}
                </span>
              </span>
            </li>
          )
        })}
      </ol>
    </section>
  )
}
