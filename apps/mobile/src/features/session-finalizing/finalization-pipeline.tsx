/**
 * The finalization pipeline: C-4 Stepper, vertical `pipeline` variant (04_mobile_specs §1.4, §4.6;
 * 03_motion_spec M-C-09), over the six `FinalizationStep` labels of the shared i18n. A running step
 * shows the kit Spinner, a finished one draws its check (300 ms) and fills the connector below it
 * (420 ms `luxe`) with its duration as the description. Used by the Finalization screen while it
 * runs and by the Session Summary (step 80) as the finished record.
 *
 * Blueprint row 87 (B9 = FXR-DEV-2 with MB-04; E-13): `animate` false draws every step from React
 * alone (no overlay, no entering fade, a still Spinner). The screens pass it for every copy that is
 * part of a hand-over, the in-place copy AND the route's copy that follows it, so no Reanimated
 * update is sent at the Finalizing hand-over at all. A running step then shows the Core's own
 * percent as its description (`percents`), which is the sign of life there: it changes when the
 * Core reports, never by a timer of this screen.
 */
import { useTranslation } from 'react-i18next';
import { Stepper, type StepDef, type StepStatus, type StepStatusWords } from '@/components/composed/stepper';
import { useMotionSettings } from '@/motion';
import { FINALIZATION_STEPS } from './finalizing.model';

export interface FinalizationPipelineProps {
  statuses: readonly StepStatus[];
  /** Seconds per finished step ("0.8"), pipeline order; null while a step runs or waits. */
  seconds: readonly (string | null)[];
  /** False for a copy that is part of a hand-over (W93-7; row 87 B9): the Stepper starts no motion. Default true. */
  animate?: boolean;
  /**
   * The Core's percent of each step, pipeline order (row 87; forward-only, `sealing-progress.ts`);
   * null where the Core reports none. Shown as the description of a step that is running.
   */
  percents?: readonly (number | null)[];
  testID?: string;
}

/** The Stepper's screen-reader words from this feature's i18n ("Step 2 of 6, …, in progress"). */
export function useFinalizingStepperWords(): StepStatusWords {
  const { t } = useTranslation();
  return {
    step: t('features.session-finalizing.stepper.step'),
    of: t('features.session-finalizing.stepper.of'),
    pending: t('features.session-finalizing.stepper.pending'),
    active: t('features.session-finalizing.stepper.active'),
    running: t('features.session-finalizing.stepper.running'),
    done: t('features.session-finalizing.stepper.done'),
    warn: t('features.session-finalizing.stepper.warn'),
    error: t('features.session-finalizing.stepper.error'),
  };
}

export function FinalizationPipeline({ statuses, seconds, animate = true, percents, testID = 'finalizing-pipeline' }: FinalizationPipelineProps) {
  const { t } = useTranslation();
  const settings = useMotionSettings();
  const words = useFinalizingStepperWords();
  const steps: StepDef[] = FINALIZATION_STEPS.map((id, index) => {
    const took = seconds[index];
    const percent = percents?.[index] ?? null;
    const running = statuses[index] === 'running';
    return {
      key: id,
      label: t(`common.enums.finalizationStep.${id}`),
      ...(took && !running
        ? { description: t('session.finalization.stepDuration', { seconds: took }) }
        : running && percent !== null
          ? { description: t('session.finalization.stepProgress', { percent }) }
          : {}),
    };
  });
  return (
    <Stepper
      // Reduced motion: remount per status change so each badge mounts with its final glyph (step 78
      // S78-7: Fabric can drop the one synchronous reduced-motion update of a not-yet-mounted glyph).
      key={settings.policy === 'reduced' ? statuses.join('|') : 'pipeline'}
      testID={testID}
      steps={steps}
      statuses={statuses}
      orientation="vertical"
      motion={settings.policy}
      animate={animate}
      statusWords={words}
    />
  );
}
