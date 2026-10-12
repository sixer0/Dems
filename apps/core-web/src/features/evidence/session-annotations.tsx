import { useTranslation } from 'react-i18next'
import { formatUtcOffset } from '@dems/shared/realtime'
import { SESSION_FORM_NOTE_ORIGIN, type EvidenceItem } from '@dems/shared/sim'
import { formatWibClockSeconds } from './model'
import { requestPlaybackSeek } from './playback-link'

/**
 * WHAT THE OPERATOR ADDED TO THE SESSION, ON THE ITEM (fix wave J, driver J-W, and round three, driver
 * J3-W; findings JT-11 / JW-13; `contract_wave_j.md` J2-S 1): the markers and the notes the item
 * carries, read BY NAME (`EvidenceItem.markers` / `notes`).
 *
 * | The item states | The block draws |
 * |-----------------|-----------------|
 * | A marker | its time (pressable: it takes the playback there, `playback-link.ts`), its number and its label |
 * | A note written during the recording | its time and its text |
 * | The note of the session form (`origin: 'SESSION_FORM'`, the first note at most) | "Note from the session form" and its text - NO time: its `at` is the creation of the session, not a moment of the recording |
 * | Two empty lists | "No markers or notes were recorded in this session." - said plainly, not an empty block |
 * | Neither member (a record of an older Core) | nothing: the console does not say "none" about what it was not told |
 *
 * A snapshot has no member and no picture (it is a mark on the open session's timeline and an audit
 * row): the block offers none.
 */
export function SessionAnnotations({ item }: { item: EvidenceItem }) {
  const { t } = useTranslation()
  const stated = Array.isArray(item.markers) || Array.isArray(item.notes)
  if (!stated) return null
  const markers = Array.isArray(item.markers) ? item.markers : []
  const notes = Array.isArray(item.notes) ? item.notes : []
  const zone = `UTC${formatUtcOffset()}`
  return (
    <section className="flex flex-col gap-2" data-testid="evidence-annotations" aria-label={t('web.waveJ.annotations.title')}>
      <span className="evi-strong">{t('web.waveJ.annotations.title')}</span>
      {markers.length === 0 && notes.length === 0 ? (
        <p className="evi-caption m-0" data-testid="evidence-annotations-none">
          {t('web.waveJ3.annotations.none')}
        </p>
      ) : null}
      {markers.length > 0 ? (
        <ol className="m-0 list-none p-0" data-testid="evidence-annotation-markers">
          {markers.map((marker) => (
            <li key={marker.id} className="evi-caption">
              <button type="button" className="evi-mono evi-transcript-seek" onClick={() => void requestPlaybackSeek(item.id, Math.max(0, marker.at - item.recordedAt))} data-testid={`evidence-marker-${marker.index}`}>
                {formatWibClockSeconds(marker.at)} {zone}
              </button>{' '}
              · {t('web.waveJ.annotations.marker', { index: marker.index })}: <span className="evi-transcript-text">{marker.label === '' ? t('web.waveJ.annotations.noLabel') : marker.label}</span>
            </li>
          ))}
        </ol>
      ) : null}
      {notes.length > 0 ? (
        <ol className="m-0 list-none p-0" data-testid="evidence-annotation-notes">
          {notes.map((note) =>
            note.origin === SESSION_FORM_NOTE_ORIGIN ? (
              <li key={note.id} className="evi-caption" data-testid="evidence-note-form" data-origin={SESSION_FORM_NOTE_ORIGIN}>
                {t('web.waveJ3.annotations.formNote')}: <span className="evi-transcript-text">{note.text}</span>
              </li>
            ) : (
              <li key={note.id} className="evi-caption" data-testid="evidence-note">
                <span className="evi-mono">
                  {formatWibClockSeconds(note.at)} {zone}
                </span>{' '}
                · {t('web.waveJ.annotations.note')}: <span className="evi-transcript-text">{note.text}</span>
              </li>
            ),
          )}
        </ol>
      ) : null}
    </section>
  )
}
