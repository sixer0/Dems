// THE ONE MAP FROM A CODE TO AN OPERATOR'S WORDS (`lib/event-words.ts`; fix wave Q, driver Q-W: JW-13 in its
// custody part, CW-03). Two halves:
//
// 1. A KNOWN code has words. The known codes are not a list of this test: they are read from where they are
//    DEFINED - the shared vocabulary objects (`AuditType`, `SimEventType`, `FaultKind`), the shared list of
//    session-key causes, and the custody actions the shared simulator and its examples WRITE (a scan of their
//    sources). A code added there without words fails here.
// 2. A code NO vocabulary holds reads in its readable form - never as the raw code, never as a translation key,
//    and without a missing-key record (`t()` with a `defaultValue` still records one: CW-03).
import { readdirSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { beforeEach, describe, expect, it } from 'vitest'
import { AuditType, FaultKind, SEAL_BLOCKED_DETAILS, SEAL_BLOCKED_DETAIL_SENTENCE, SimEventType } from '@dems/shared/sim'
import { en } from '@dems/shared/i18n'
import { getMissingI18nKeys, i18n, resetMissingI18nKeys } from '@/i18n'
import {
  auditTypeWords,
  causeCodeWords,
  codeWords,
  CUSTODY_ACTION_KEY,
  custodyActionWords,
  custodyDetailWords,
  enumValueWords,
  eventTitle,
  eventTypeWords,
  faultKindWords,
  faultClearedStillInFault,
  isKnownCause,
  isKnownCode,
  readableCode,
  selectFaultSessionId,
  sealCauseLine,
  severityWords,
} from '../event-words'

const t = i18n.t.bind(i18n)
const RAW_CODE = /^[A-Z][A-Z0-9]*(?:_[A-Z0-9]+)+$/

/** The custody actions the shared package writes: `{ at, action: 'X', actorId ... }` and `action: ok ? 'A' : 'B'`. */
function writtenCustodyActions(): string[] {
  const shared = join(dirname(fileURLToPath(import.meta.url)), '../../../../../packages/shared/src')
  const found = new Set<string>()
  for (const folder of ['sim', 'api']) {
    for (const name of readdirSync(join(shared, folder))) {
      if (!name.endsWith('.ts')) continue
      const source = readFileSync(join(shared, folder, name), 'utf8')
      for (const match of source.matchAll(/action: '([A-Z][A-Z0-9_]+)', actorId/g)) found.add(match[1]!)
      for (const match of source.matchAll(/action: [A-Za-z.]+ \? '([A-Z][A-Z0-9_]+)' : '([A-Z][A-Z0-9_]+)'/g)) {
        found.add(match[1]!)
        found.add(match[2]!)
      }
    }
  }
  return [...found].sort()
}

beforeEach(() => {
  resetMissingI18nKeys()
})

describe('a KNOWN code has words (a new code without words fails here)', () => {
  it('every audit type, event type and fault kind of the shared vocabulary reads its own words, not the readable form of its code', () => {
    const kinds = [
      ['auditType', Object.values(AuditType)],
      ['eventType', Object.values(SimEventType)],
      ['faultKind', Object.values(FaultKind)],
    ] as const
    for (const [kind, codes] of kinds) {
      expect(codes.length, kind).toBeGreaterThan(10)
      const unmapped = codes.filter((code) => !isKnownCode(kind, code))
      expect(unmapped, `${kind} codes without words`).toEqual([])
      for (const code of codes) {
        const words = codeWords(t, kind, code)
        expect(words, `${kind} ${code}`).not.toMatch(RAW_CODE)
        expect(words, `${kind} ${code}`).not.toContain('common.')
      }
    }
    expect(getMissingI18nKeys()).toEqual([])
  })

  it('every custody action the shared simulator and its examples write is in the map and reads words', () => {
    const written = writtenCustodyActions()
    // The scan itself can fail: these are the three the confirmation found printed raw, and the scan must see them.
    expect(written).toEqual(expect.arrayContaining(['SEALED', 'VERIFIED', 'VERIFY_FAILED', 'RECORDING_STARTED', 'RECORDING_STOPPED', 'RECORDING_INTERRUPTED', 'SESSION_INCOMPLETE', 'EXPORTED', 'EXPORT_DOWNLOADED', 'REVIEW_OPENED', 'ARCHIVED']))
    const unmapped = written.filter((action) => !Object.prototype.hasOwnProperty.call(CUSTODY_ACTION_KEY, action))
    expect(unmapped, 'custody actions without words').toEqual([])
    for (const action of written) {
      const words = custodyActionWords(t, action)
      expect(words, action).not.toMatch(RAW_CODE)
      expect(words, action).not.toContain('.')
    }
    expect(custodyActionWords(t, 'VERIFY_FAILED')).toBe('Evidence verification failed')
    expect(custodyActionWords(t, 'VERIFIED')).toBe('Evidence verified')
    expect(custodyActionWords(t, 'SEALED')).toBe('Evidence sealed')
    expect(custodyActionWords(t, 'RECORDING_INTERRUPTED')).toBe('Recording interrupted')
    expect(custodyActionWords(t, 'EXPORT_DOWNLOADED')).toBe('Export downloaded')
    expect(getMissingI18nKeys()).toEqual([])
  })

  it('every session-key cause of the shared list reads the shared sentence', () => {
    expect(SEAL_BLOCKED_DETAILS.length).toBeGreaterThanOrEqual(6)
    for (const cause of SEAL_BLOCKED_DETAILS) {
      expect(isKnownCause(cause), cause).toBe(true)
      expect(causeCodeWords(t, cause)).toBe(SEAL_BLOCKED_DETAIL_SENTENCE[cause])
    }
    expect(sealCauseLine(t, 'SESSION_KEY_STORE_UNAVAILABLE')).toBe("Cause: The Core's key store cannot be used. (code SESSION_KEY_STORE_UNAVAILABLE)")
  })
})

describe('a code no vocabulary holds reads in its readable form', () => {
  it('readableCode: words with a capital first letter; a sentence stays as it is', () => {
    expect(readableCode('VERIFY_FAILED')).toBe('Verify failed')
    expect(readableCode('NOTHING_SEALABLE')).toBe('Nothing sealable')
    expect(readableCode('H264_720P30')).toBe('H264 720p30')
    expect(readableCode('capture-worker')).toBe('Capture worker')
    expect(readableCode('Storage full; recovered')).toBe('Storage full; recovered')
    expect(readableCode('')).toBe('')
  })

  it('an additive code of a newer Core: readable words, no raw code, no key, no missing-key record', () => {
    expect(auditTypeWords(t, 'EVIDENCE_QUARANTINE_RELEASED')).toBe('Evidence quarantine released')
    expect(eventTypeWords(t, 'CAPTURE_WORKER_RESTARTED')).toBe('Capture worker restarted')
    expect(faultKindWords(t, 'LENS_OBSTRUCTED')).toBe('Lens obstructed')
    expect(severityWords(t, 'NOTICE')).toBe('Notice')
    expect(custodyActionWords(t, 'TRANSFERRED_TO_COURT')).toBe('Transferred to court')
    expect(causeCodeWords(t, 'NOTHING_SEALABLE')).toBe('Nothing sealable')
    expect(isKnownCause('NOTHING_SEALABLE')).toBe(false)
    expect(sealCauseLine(t, 'NOTHING_SEALABLE')).toBe('Cause: Nothing sealable (code NOTHING_SEALABLE)')
    expect(eventTitle(t, { type: 'CAPTURE_WORKER_RESTARTED' as never, params: {} })).toBe('Capture worker restarted')
    expect(getMissingI18nKeys()).toEqual([])
  })

  it('a custody action that is an audit type reads the audit vocabulary', () => {
    expect(custodyActionWords(t, 'EVIDENCE_MEDIA_SERVED')).toBe('Evidence media served')
  })

  it('custody detail: every code inside it by its name, the other words kept', () => {
    expect(custodyDetailWords(t, 'STORAGE_FULL; recovered')).toBe('Storage full; recovered')
    expect(custodyDetailWords(t, 'Cause: CAPTURE_FAULT')).toBe('Cause: Capture fault')
    expect(custodyDetailWords(t, 'Mismatch: VIDEO-02')).toBe('Mismatch: VIDEO-02')
  })

  it('CW-03: the value of a pre-check row whose source did not answer reads "Not reachable" and records NO missing key', () => {
    expect(enumValueWords(t, 'lensState', 'UNREACHABLE')).toBe('Not reachable')
    expect(enumValueWords(t, 'micState', 'UNREACHABLE')).toBe('Not reachable')
    expect(enumValueWords(t, 'lensState', 'READY')).toBe('READY')
    expect(enumValueWords(t, 'timeSource', 'HOST_SYSTEM_CLOCK')).toBe('Host system clock')
    expect(getMissingI18nKeys()).toEqual([])
    // CONTROL: the lookup the row made before records the key - this is the warning the confirmation saw once.
    t('common.enums.lensState.UNREACHABLE' as never, { defaultValue: 'UNREACHABLE' })
    expect(getMissingI18nKeys()).toEqual(['translation:common.enums.lensState.UNREACHABLE'])
  })
})

// Audit fix row 110b (DF-19 web half, R110-1; D60): a FAULT_CLEARED whose session is the open session and
// still in FAULT is titled by common.faultCleared.sessionStillInFault in every activity list.
describe('row 110b (DF-19): a FAULT_CLEARED whose session is still in FAULT', () => {
  beforeEach(() => resetMissingI18nKeys())
  const cleared = { type: 'FAULT_CLEARED' as const, params: { kind: 'CAPTURE_FAULT', target: null }, sessionId: 'SES-110B' }
  const still = (kind: string) => en.common.faultCleared.sessionStillInFault.replace('{{kind}}', kind)

  it('the rule: only FAULT_CLEARED, only the open session while it is in FAULT, never the Core-not-running clear', () => {
    expect(faultClearedStillInFault(cleared, 'SES-110B')).toBe(true)
    expect(faultClearedStillInFault(cleared, null)).toBe(false)
    expect(faultClearedStillInFault(cleared, 'SES-OTHER')).toBe(false)
    expect(faultClearedStillInFault({ ...cleared, sessionId: null }, 'SES-110B')).toBe(false)
    expect(faultClearedStillInFault({ ...cleared, type: 'FAULT_RAISED' }, 'SES-110B')).toBe(false)
    expect(faultClearedStillInFault({ ...cleared, params: { ...cleared.params, coreNotRunning: true } }, 'SES-110B')).toBe(false)
  })

  it('the selector: the open session id only while that session is in FAULT', () => {
    const session = { id: 'SES-110B', state: 'FAULT' }
    expect(selectFaultSessionId({ session } as never)).toBe('SES-110B')
    expect(selectFaultSessionId({ session: { ...session, state: 'RECOVERY' } } as never)).toBeNull()
    expect(selectFaultSessionId({ session: { ...session, state: 'RECORDING' } } as never)).toBeNull()
    expect(selectFaultSessionId({ session: null } as never)).toBeNull()
  })

  it("the title: the label with the fault kind's words (no raw code, no missing key); without a FAULT session, the type's own title", () => {
    expect(eventTitle(t, cleared, 'SES-110B')).toBe(still(en.common.faultKind.CAPTURE_FAULT))
    expect(eventTitle(t, cleared, 'SES-110B')).not.toMatch(/CAPTURE_FAULT/)
    expect(eventTitle(t, cleared, null)).toBe(en.common.eventType.FAULT_CLEARED)
    expect(eventTitle(t, cleared)).toBe(en.common.eventType.FAULT_CLEARED)
    expect(getMissingI18nKeys()).toEqual([])
  })
})
