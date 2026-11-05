import { Button } from '@heroui/react'
import { Copy, MicOff } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { ItemV2 } from './item-v2'
import { shortHash } from './model'

export interface PairAudioProps {
  item: Pick<ItemV2, 'pairAudioFiles' | 'audioTracksMissing'>
  onCopy: (value: string) => void
}

/**
 * The audio of the camera-microphone pairs of ONE item, as the item states it (audit 2026-11-05
 * row 159; S5 §6, F-5-11; decisions D27, D30 K-3, D45).
 *
 * - **One row per sealed AUDIO-0N file**, in pair order: "AUDIO-02 · audio of Pair 2, in VIDEO-02"
 *   with the file's own stored-bytes hash. "in VIDEO-0N" is said only when that camera file is in the
 *   item (the manifest's `containsIn` rule); otherwise the row says the camera file is not in the
 *   package. The hash is the item's (the Core read it from the signed manifest) - never derived here.
 * - **The missing-microphone statement**: per stated pair the reason in words (no microphone
 *   assigned / microphone could not be opened), and that the camera file of the pair holds a SILENT
 *   track - so that silence is never read as a quiet room.
 * - A legacy item (no AUDIO-0N file, no statement) draws NOTHING: the card it sits in is unchanged.
 */
export function PairAudio({ item, onCopy }: PairAudioProps) {
  const { t } = useTranslation()
  if (item.pairAudioFiles.length === 0 && item.audioTracksMissing.length === 0) return null
  return (
    <div className="flex flex-col gap-2" data-testid="evidence-pair-audio">
      {item.pairAudioFiles.length > 0 ? (
        <>
          <p className="evi-caption evi-strong">{t('evidence.itemFacts.sealed.audioTitle')}</p>
          <ul className="evi-hash-list" aria-label={t('evidence.itemFacts.sealed.audioTitle')}>
            {item.pairAudioFiles.map((audio) => (
              <li key={audio.trackId} data-hash={audio.trackId} data-pair={audio.pair} data-in-camera={audio.inCamera ?? undefined}>
                <span className="evi-caption">
                  {audio.inCamera !== null
                    ? t('evidence.itemFacts.sealed.audioFile', { track: audio.trackId, pair: audio.pair, camera: audio.inCamera })
                    : t('evidence.itemFacts.sealed.audioFileNoCamera', { track: audio.trackId, pair: audio.pair, camera: audio.camera })}
                </span>
                <span className="evi-hash-row">
                  <span className="evi-mono evi-hash" title={audio.file.sha256}>
                    {shortHash(audio.file.sha256, 16)}
                  </span>
                  <Button isIconOnly size="sm" variant="ghost" aria-label={t('evidence.detail.integrity.copyHash')} onPress={() => onCopy(audio.file.sha256)}>
                    <Copy className="size-3.5" aria-hidden="true" />
                  </Button>
                </span>
              </li>
            ))}
          </ul>
        </>
      ) : null}
      {item.audioTracksMissing.length > 0 ? (
        <section className="flex flex-col gap-1" role="status" data-testid="evidence-audio-missing" aria-label={t('evidence.itemFacts.sealed.missingTitle')}>
          <p className="evi-caption evi-strong inline-flex items-center gap-2">
            <MicOff className="size-4 shrink-0" aria-hidden="true" />
            {t('evidence.itemFacts.sealed.missingTitle')}
          </p>
          {item.audioTracksMissing.map((missing) => {
            const channel = `MIC-0${String(missing.pair)}`
            return (
              <p key={missing.trackId} className="evi-caption" data-missing={missing.trackId} data-reason={missing.reason} data-silent-in={missing.silentIn ?? undefined}>
                {missing.reason === 'NOT_ASSIGNED'
                  ? t('evidence.itemFacts.sealed.missing.NOT_ASSIGNED', { track: missing.trackId, pair: missing.pair, channel })
                  : t('evidence.itemFacts.sealed.missing.NOT_OPENED', { track: missing.trackId, pair: missing.pair, channel, device: missing.micDeviceId ?? '' })}{' '}
                {missing.silentIn !== null
                  ? t('evidence.itemFacts.sealed.missingSilent', { camera: missing.silentIn })
                  : t('evidence.itemFacts.sealed.missingNoCamera', { camera: missing.camera })}
              </p>
            )
          })}
          <p className="evi-caption">{t('evidence.itemFacts.sealed.missingNote')}</p>
        </section>
      ) : null}
    </div>
  )
}
