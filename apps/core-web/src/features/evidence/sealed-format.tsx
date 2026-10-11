import { Alert, Card } from '@heroui/react'
import { Film } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { DetailFacts } from './item-facts'

/**
 * Fix wave L (G89c-04, ruling D229 (3); `contract_wave_l.md` section 4): THE SEALED FORMAT OF AN ITEM.
 * The per-track profile is what the SIGNED manifest states (field 36), repeated from operation 40
 * (`evidence.files[].profile`) - never the label of the session's `profileId`. Where the Core still
 * holds the notice that the recorded stream was not the configured profile
 * (`evidence.streamProfileNotice`), the page says so, per track, in the Core's own values.
 * Nothing is drawn for an item that states neither (a demonstration item, an older Core).
 */
export function SealedFormat({ facts }: { facts: DetailFacts | null }) {
  const { t } = useTranslation()
  const profiles = facts?.sealedProfiles ?? null
  const notice = facts?.streamProfileNotice ?? null
  if (profiles === null && notice === null) return null
  return (
    <Card className="evi-tabs-card" data-testid="evidence-sealed-format">
      <h3 className="evi-section-title">
        <Film className="size-4 text-accent" aria-hidden="true" />
        {t('web.waveL.profile.sealedLabel')}
      </h3>
      {profiles !== null ? (
        <dl className="m-0 flex flex-wrap gap-x-6 gap-y-1" data-testid="evidence-sealed-profiles">
          {profiles.map((entry) => (
            <div key={entry.trackId} className="flex items-baseline gap-2" data-testid={`evidence-sealed-profile-${entry.trackId}`}>
              <dt className="evi-caption">{entry.trackId}</dt>
              <dd className="evi-mono m-0">{entry.profile}</dd>
            </div>
          ))}
        </dl>
      ) : null}
      {notice !== null ? (
        <Alert status="warning" role="status" data-testid="evidence-stream-profile-notice">
          <Alert.Indicator />
          <Alert.Content>
            <Alert.Title>
              {t('web.waveL.profile.notice', {
                parts: notice.map((entry) => t('web.waveL.profile.noticePart', { track: entry.trackId, stream: entry.stream, configured: entry.configured })).join('; '),
              })}
            </Alert.Title>
          </Alert.Content>
        </Alert>
      ) : null}
    </Card>
  )
}
