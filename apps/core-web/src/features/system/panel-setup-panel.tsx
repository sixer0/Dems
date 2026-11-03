/**
 * The pre-delivery panel setup module (decision D57, principal, 03-11-2026): the two words the LCD
 * front panel shows and its logo, changed FROM THIS CONSOLE by the two vendor accounts only.
 *
 * The page is cosmetic on the client's side exactly like the RB-9 trio: `live.ts`
 * `usePanelSetupVisible()` hides it from every other session, and the Core checks the same identity
 * rule again on every request — a caller who reaches the operation without being a vendor account
 * gets 403 `NOT_PERMITTED` and this page words the refusal, it does not pretend success.
 *
 * What leaves the browser: the two words (bounded by the contract) and, when one was picked, the
 * whole PNG file base64-encoded inside the same request body. The Core forwards to the panel
 * backend carrying THIS session's credential unchanged — the backend proves it back to the Core —
 * so no password, token or secret is ever assembled here beyond the session the console already holds.
 *
 * Failure words follow the contract's answers: 503 says nothing was changed, 422 carries the
 * backend's own reason, 401 says the session behind the click died on the way.
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { Button, Input, Label, TextField, toast } from '@heroui/react'
import { MonitorSmartphone } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { PANEL_CLIENT_MAX_LENGTH, PANEL_LOGO_PNG_MAX_BYTES, PANEL_SATKER_MAX_LENGTH, type PanelLogoTarget, type PanelSetupResponse, type SetPanelSetupRequest } from '@dems/shared/api'
import { useWebLive } from '@/runtime'
import { SystemPanel } from './panel'

/** A File read as base64 without the data-URL prefix. */
async function readFileAsBase64(file: File): Promise<string> {
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(reader.error ?? new Error('read failed'))
    reader.readAsDataURL(file)
  })
  return dataUrl.slice(dataUrl.indexOf(',') + 1)
}

/** The failure half of an answer: the typed client's envelope (`CoreCallFailure`), narrowed to
 * what this page words. `details` rides under `error`, exactly as `stt-config-model.ts` reads it. */
type AnswerFailure = {
  status?: number | null
  error?: { code?: string; message?: string; details?: { reason?: unknown } }
}

export function PanelSetupPanel() {
  const { t } = useTranslation()
  const live = useWebLive()
  const [setup, setSetup] = useState<PanelSetupResponse | null>(null)
  const [loadNote, setLoadNote] = useState<string | null>(null)
  const [satker, setSatker] = useState('')
  const [clientWord, setClientWord] = useState('')
  const [logoFile, setLogoFile] = useState<File | null>(null)
  const [logoTarget, setLogoTarget] = useState<PanelLogoTarget>('client')
  const [saving, setSaving] = useState(false)
  const [saveNote, setSaveNote] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement | null>(null)
  // D57c: the one read of the page's life. StrictMode runs effects twice; the second run must not
  // ask again, and the answer of the first run is applied even though its cleanup already fired
  // (React 18 makes a set after a real unmount a no-op — the guard is what keeps the ask at one).
  const askedRef = useRef(false)

  const wordFailure = useCallback((failure: AnswerFailure): string => {
    if (failure.status === 503) return t('system.panelSetup.backendDown')
    if (failure.status === 401) return t('system.panelSetup.noSession')
    if (failure.status === 403) return t('system.panelSetup.noPermission')
    if (failure.status === 413) return t('system.panelSetup.tooLarge')
    if (failure.status === 422)
      return t('system.panelSetup.refused', {
        reason: typeof failure.error?.details?.reason === 'string' ? failure.error.details.reason : (failure.error?.message ?? 'the panel'),
      })
    return t('system.panelSetup.notStored')
  }, [t])

  useEffect(() => {
    if (live === null || askedRef.current) return
    askedRef.current = true
    void (async () => {
      const answer = await live.client.call('getPanelSetup', {})
      if (answer.ok) {
        const data = answer.data as PanelSetupResponse
        setSetup(data)
        setSatker(data.satker)
        setClientWord(data.client)
      } else {
        setLoadNote(wordFailure(answer as AnswerFailure))
      }
    })()
  }, [live, wordFailure])

  const dirty =
    setup !== null &&
    (logoFile !== null || satker.trim() !== setup.satker || clientWord.trim() !== setup.client)

  const save = async (): Promise<void> => {
    if (live === null || setup === null) return
    if (!dirty) {
      setSaveNote(t('system.panelSetup.empty'))
      return
    }
    setSaving(true)
    setSaveNote(null)
    try {
      const body: SetPanelSetupRequest = {
        ...(satker.trim() !== setup.satker ? { satker: satker.trim() } : {}),
        ...(clientWord.trim() !== setup.client ? { client: clientWord.trim() } : {}),
        ...(logoFile !== null ? { logoBase64: await readFileAsBase64(logoFile), logoTarget } : {}),
      }
      const answer = await live.client.call('setPanelSetup', { body })
      if (answer.ok) {
        const data = answer.data as PanelSetupResponse
        setSetup(data)
        setSatker(data.satker)
        setClientWord(data.client)
        setLogoFile(null)
        if (fileRef.current !== null) fileRef.current.value = ''
        setSaveNote(t('system.panelSetup.saved'))
        toast.success(t('system.panelSetup.saved'))
      } else {
        setSaveNote(wordFailure(answer as AnswerFailure))
      }
    } catch {
      setSaveNote(t('system.panelSetup.notStored'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <SystemPanel id="panelSetup" icon={MonitorSmartphone} title={t('system.panelSetup.title')} className="col-span-12">
      <div className="flex flex-col gap-3" data-testid="panel-pre-delivery-setup">
        <p className="sys-muted sys-small">{t('system.panelSetup.subtitle')}</p>
        {loadNote !== null ? <p className="text-sm text-danger" role="alert">{loadNote}</p> : null}
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <TextField value={satker} onChange={(value) => setSatker(value.slice(0, PANEL_SATKER_MAX_LENGTH))} isDisabled={setup === null || saving} validationBehavior="aria" className="sys-setting" data-testid="panel-setup-satker">
            <Label>{t('system.panelSetup.satkerLabel')}</Label>
            <Input autoComplete="off" spellCheck={false} />
          </TextField>
          <TextField value={clientWord} onChange={(value) => setClientWord(value.slice(0, PANEL_CLIENT_MAX_LENGTH))} isDisabled={setup === null || saving} validationBehavior="aria" className="sys-setting" data-testid="panel-setup-client">
            <Label>{t('system.panelSetup.clientLabel')}</Label>
            <Input autoComplete="off" spellCheck={false} />
          </TextField>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <label className="text-sm">
            {t('system.panelSetup.logoLabel')}{' '}
            <input
              ref={fileRef}
              type="file"
              accept="image/png"
              data-testid="panel-setup-logo-file"
              onChange={(event) => {
                const picked = event.target.files?.[0] ?? null
                // D57c (the principal's upload): a PNG over the console path bound can only die
                // at the API-4 pipeline with a 413 that never reaches the panel; say it here,
                // where the file still lies in the operator's hand, and take the pick back.
                if (picked !== null && picked.size > PANEL_LOGO_PNG_MAX_BYTES) {
                  event.target.value = ''
                  setSaveNote(t('system.panelSetup.tooLarge'))
                  return
                }
                setLogoFile(picked)
              }}
            />
          </label>
          <label className="text-sm">
            {t('system.panelSetup.logoTargetLabel')}{' '}
            <select value={logoTarget} onChange={(event) => setLogoTarget(event.target.value as PanelLogoTarget)} disabled={saving}>
              <option value="client">{t('system.panelSetup.logoTargetClient')}</option>
              <option value="splash">{t('system.panelSetup.logoTargetSplash')}</option>
            </select>
          </label>
        </div>
        <p className="sys-muted sys-small">{t('system.panelSetup.logoSizes')}</p>
        <p className="sys-muted sys-small">
          {t('system.panelSetup.hint')} · client: {setup?.clientLogoSaved ? t('system.panelSetup.logoSaved') : t('system.panelSetup.logoEmpty')} · splash:{' '}
          {setup?.splashLogoSaved ? t('system.panelSetup.logoSaved') : t('system.panelSetup.logoEmpty')}
        </p>
        <div className="flex items-center gap-3">
          <Button variant="primary" size="sm" onPress={() => void save()} isPending={saving} isDisabled={!dirty || setup === null} data-testid="panel-setup-save">
            {saving ? t('system.panelSetup.saving') : t('system.panelSetup.save')}
          </Button>
          {saveNote !== null ? <span className="text-sm">{saveNote}</span> : null}
        </div>
      </div>
    </SystemPanel>
  )
}
