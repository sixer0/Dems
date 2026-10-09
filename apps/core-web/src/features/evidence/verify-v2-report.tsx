import { Alert, Chip } from '@heroui/react'
import { CircleCheck, CircleMinus, CircleX, FileText } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { v2CheckName, v2FragmentLine, v2Rows, type V2Check, type V2Row, type VerifyV2Answer } from './verify-v2'

export interface VerifyV2ReportProps {
  answer: VerifyV2Answer
}

/**
 * The schema-v2 result of one Verify run, as the Core server answered it (blueprint row 87;
 * evidence package spec §D, §F.3; UX spec flow 5 step 6).
 *
 * Top to bottom: the transcript state of the package (row 119's fixed lines) and the interrupted
 * mark, when the answer carries them; one row per camera file (stored bytes, decrypted bytes,
 * fragment chain), the transcript hash, the manifest, the signature; on a failure the fragment the
 * answer names ("VIDEO-02 fragment 3 tampered (…)"); then the per-check list V-01 to V-14, when the
 * answer carries the report. Every value drawn is the answer's: a part the answer does not carry is
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
    </div>
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
