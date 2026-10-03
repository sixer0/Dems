import { useState, type ReactNode } from 'react'
import { Button, Label, Meter, NumberField, Slider } from '@heroui/react'
import { Calculator, RotateCcw } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { GB, selectStorage, TB, useSim } from '@dems/shared/sim'
import { AnimatedNumber } from '@/components/ui/animated-number'
import { useMotionPolicy } from '@/motion'
import { METER_FILL_MS, PANEL_BEAT_MS, useDataReady } from './choreography'
import {
  AUDIO_MBPS,
  BOOK_VIDEO_MBPS,
  CALCULATOR_LIMITS,
  clampInput,
  DEFAULT_HOURS_PER_DAY,
  DEFAULT_OVERHEAD,
  fixed,
  retentionMath,
  type RetentionInputs,
} from './model'
import { StoragePanel } from './panel'

type InputKey = keyof RetentionInputs

/**
 * Retention calculator (01_specs §14.5.5 / S15: `NumberField` × 2 plus `Meter`, MP AnimatedNumber;
 * design book §10.2 formula, §10.3 example). Each input is a kit NumberField paired with a kit
 * Slider. The outputs tween as the inputs move (AnimatedNumber, `counter` spring) and the Meter's
 * fill follows with a 400 ms `scaleX` (M-PG-STOR). Retention days follow the simulator's policy
 * until the operator moves them; "Reset" returns to the book example.
 */
export function RetentionCalculator() {
  const { t } = useTranslation()
  const m = useMotionPolicy()
  const policyDays = useSim((s) => s.storagePolicy.retentionDays)
  const capacityBytes = useSim((s) => selectStorage(s).totalBytes)
  // Free space in 0.1 GB steps: the outputs move about every 44 s while recording, not every tick.
  const freeDeciGb = useSim((s) => Math.round(selectStorage(s).freeBytes / (GB / 10)))
  const ready = useDataReady(PANEL_BEAT_MS.calculator)

  const bookInputs = (days: number): RetentionInputs => ({
    videoMbps: BOOK_VIDEO_MBPS,
    hoursPerDay: DEFAULT_HOURS_PER_DAY,
    retentionDays: clampInput(days, 1, CALCULATOR_LIMITS.retentionDays.fieldMax),
    overhead: DEFAULT_OVERHEAD,
  })
  const [inputs, setInputs] = useState<RetentionInputs>(() => bookInputs(policyDays))
  const [seenPolicyDays, setSeenPolicyDays] = useState(policyDays)
  if (seenPolicyDays !== policyDays) {
    // The policy changed (Manage Storage): the calculator follows it, derived during render.
    setSeenPolicyDays(policyDays)
    setInputs((current) => ({ ...current, retentionDays: policyDays }))
  }

  const result = retentionMath(inputs, capacityBytes, (freeDeciGb * GB) / 10)
  const set = (key: InputKey, max?: number) => (value: number | number[]) => {
    const raw = Array.isArray(value) ? (value[0] ?? 0) : value
    const limits = CALCULATOR_LIMITS[key]
    const upper = max ?? limits.max
    setInputs((current) => ({ ...current, [key]: clampInput(raw, limits.min, upper) }))
  }
  const n = (value: number) => (ready ? value : 0)
  const capacityTb = `${fixed(capacityBytes / TB, 1)} ${t('storage.units.tb')}`
  const meterValue = Math.min(100, result.requiredPercent)
  const meterScale = m.flags.animateNumbers ? (ready ? meterValue / 100 : 0) : meterValue / 100
  const meterTransition = m.flags.animateNumbers
    ? `transform ${METER_FILL_MS * m.timeScale}ms cubic-bezier(0.2, 0, 0, 1)`
    : 'none'

  return (
    <StoragePanel
      id="calculator"
      icon={Calculator}
      title={t('storage.calculator.title')}
      action={
        <Button size="sm" variant="ghost" onPress={() => setInputs(bookInputs(policyDays))} data-testid="storage-calc-reset">
          <RotateCcw aria-hidden="true" strokeWidth={1.75} />
          {t('storage.calculator.reset')}
        </Button>
      }
      bodyClassName="stor-calc"
    >
      <p className="stor-calc-subtitle">{t('storage.calculator.subtitle')}</p>
      <div className="stor-calc-grid">
        <fieldset className="stor-calc-inputs" aria-label={t('storage.calculator.inputsLabel')}>
          <CalcInput
            id="videoMbps"
            label={t('storage.calculator.videoBitrate')}
            value={inputs.videoMbps}
            limits={CALCULATOR_LIMITS.videoMbps}
            digits={1}
            onChange={set('videoMbps')}
          />
          <div className="stor-calc-fixed">
            <span className="stor-calc-label">{t('storage.calculator.audio')}</span>
            <span className="stor-calc-fixed-value">{t('storage.calculator.audioValue', { value: fixed(AUDIO_MBPS, 1) })}</span>
          </div>
          <CalcInput
            id="hoursPerDay"
            label={t('storage.calculator.hoursPerDay')}
            value={inputs.hoursPerDay}
            limits={CALCULATOR_LIMITS.hoursPerDay}
            digits={1}
            onChange={set('hoursPerDay')}
          />
          <CalcInput
            id="retentionDays"
            label={t('storage.calculator.retentionDays')}
            value={inputs.retentionDays}
            limits={CALCULATOR_LIMITS.retentionDays}
            fieldMax={CALCULATOR_LIMITS.retentionDays.fieldMax}
            digits={0}
            onChange={set('retentionDays', CALCULATOR_LIMITS.retentionDays.fieldMax)}
          />
          <CalcInput
            id="overhead"
            label={t('storage.calculator.overhead')}
            value={inputs.overhead}
            limits={CALCULATOR_LIMITS.overhead}
            digits={2}
            onChange={set('overhead')}
          />
          <p className="stor-calc-assumption">
            {t('storage.calculator.assumption', { hours: DEFAULT_HOURS_PER_DAY, overhead: fixed(DEFAULT_OVERHEAD, 2) })}
          </p>
        </fieldset>

        <section className="stor-calc-results" aria-label={t('storage.calculator.resultsLabel')} aria-live="polite">
          <div className="stor-formula" data-testid="storage-formula">
            <span className="stor-formula-label">{t('storage.calculator.formulaLabel')}</span>
            <code>
              ((<b>{fixed(inputs.videoMbps, 1)}</b> + <b>{fixed(inputs.videoMbps, 1)}</b> + {fixed(AUDIO_MBPS, 1)}) ÷ 8) × 3600 ÷ 1000 ={' '}
              <em>{fixed(result.gbPerHour, 2)} {t('storage.units.gbPerHour')}</em>
            </code>
            <code>
              {fixed(result.gbPerHour, 2)} × <b>{fixed(inputs.hoursPerDay, 1)}</b> {t('storage.units.hours')} × <b>{inputs.retentionDays}</b>{' '}
              {t('storage.units.days')} × <b>{fixed(inputs.overhead, 2)}</b> = <em>{fixed(result.requiredGb / 1_000, 2)} {t('storage.units.tb')}</em>
            </code>
          </div>
          <div className="stor-calc-tiles">
            <ResultTile id="totalBitrate" label={t('storage.calculator.totalBitrate')} unit={t('storage.units.mbps')}>
              <AnimatedNumber value={n(result.totalMbps)} format={(v) => fixed(v, 1)} />
            </ResultTile>
            <ResultTile id="gbPerHour" label={t('storage.calculator.gbPerHour')} unit={t('storage.units.gbPerHour')}>
              <AnimatedNumber value={n(result.gbPerHour)} format={(v) => fixed(v, 2)} />
            </ResultTile>
            <ResultTile id="gbPerDay" label={t('storage.calculator.gbPerDay')} unit={t('storage.units.gb')}>
              <AnimatedNumber value={n(result.dailyGb)} format={(v) => fixed(v, 1)} />
            </ResultTile>
            <ResultTile id="hoursLeft" label={t('storage.calculator.hoursLeft')} unit={t('storage.units.hours')}>
              <AnimatedNumber value={n(Math.floor(result.hoursLeft))} format={(v) => Math.round(v).toLocaleString('en-US')} />
            </ResultTile>
            <ResultTile id="daysUntilFull" label={t('storage.calculator.daysUntilFull')} unit={t('storage.units.days')}>
              <AnimatedNumber value={n(Math.floor(result.daysUntilFull))} format={(v) => Math.round(v).toLocaleString('en-US')} />
            </ResultTile>
          </div>
          <Meter
            value={meterValue}
            valueLabel={t('storage.calculator.requiredOf', { percent: Math.round(result.requiredPercent), capacity: capacityTb })}
            className="stor-meter"
            data-tone={result.tone}
            data-testid="storage-calc-meter"
            style={{ ['--stor-fill' as string]: String(meterScale), ['--stor-fill-transition' as string]: meterTransition }}
          >
            <Label className="stor-meter-label">
              {t('storage.calculator.required', { days: inputs.retentionDays })}{' '}
              <span className="stor-meter-required">
                <AnimatedNumber value={n(result.requiredGb / 1_000)} format={(v) => fixed(v, 2)} /> {t('storage.units.tb')}
              </span>
            </Label>
            <Meter.Output className="stor-meter-output" />
            <Meter.Track className="stor-meter-track">
              <Meter.Fill className="stor-meter-fill" />
            </Meter.Track>
          </Meter>
          <p className="stor-meter-caption" data-tone={result.tone} data-testid="storage-calc-verdict">
            {result.excessTb > 0
              ? t('storage.calculator.exceeds', { value: fixed(result.excessTb, 2) })
              : t('storage.calculator.coverage', { count: Math.floor(result.coverageDays) })}
          </p>
        </section>
      </div>
    </StoragePanel>
  )
}

interface CalcInputProps {
  id: InputKey
  label: string
  value: number
  limits: { min: number; max: number; step: number }
  /** The NumberField may go beyond the slider range (retention up to 3,650 days). */
  fieldMax?: number
  digits: number
  onChange: (value: number | number[]) => void
}

function CalcInput({ id, label, value, limits, fieldMax, digits, onChange }: CalcInputProps) {
  const format = { minimumFractionDigits: digits, maximumFractionDigits: digits }
  return (
    <div className="stor-calc-input" data-testid={`storage-calc-${id}`}>
      <NumberField
        value={value}
        onChange={onChange}
        minValue={limits.min}
        maxValue={fieldMax ?? limits.max}
        step={limits.step}
        formatOptions={format}
        className="stor-calc-field"
      >
        <Label className="stor-calc-label">{label}</Label>
        <NumberField.Group className="stor-calc-group">
          <NumberField.DecrementButton />
          <NumberField.Input className="stor-calc-number" />
          <NumberField.IncrementButton />
        </NumberField.Group>
      </NumberField>
      <Slider
        value={Math.min(value, limits.max)}
        onChange={onChange}
        minValue={limits.min}
        maxValue={limits.max}
        step={limits.step}
        aria-label={label}
        className="stor-calc-slider"
      >
        <Slider.Track className="stor-slider-track">
          <Slider.Fill className="stor-slider-fill" />
          <Slider.Thumb className="stor-slider-thumb" />
        </Slider.Track>
      </Slider>
    </div>
  )
}

function ResultTile({ id, label, unit, caption, children }: { id: string; label: string; unit: string; caption?: string; children: ReactNode }) {
  return (
    <div className="stor-calc-tile" data-testid={`storage-calc-out-${id}`}>
      <span className="stor-calc-tile-label">{label}</span>
      <span className="stor-calc-tile-value">
        {children}
        <span className="stor-calc-tile-unit">{unit}</span>
      </span>
      {caption ? <span className="stor-calc-tile-caption">{caption}</span> : null}
    </div>
  )
}
