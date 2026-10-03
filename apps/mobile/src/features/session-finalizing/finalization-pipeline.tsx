/**
 * The finalization pipeline: C-4 Stepper, vertical `pipeline` variant (04_mobile_specs §1.4, §4.6;
 * 03_motion_spec M-C-09), over the six `FinalizationStep` labels of the shared i18n. A running step
 * shows the kit Spinner, a finished one draws its check (300 ms) and fills the connector below it
 * (420 ms `luxe`) with its duration as the description. Used by the Finalization screen while it
 * runs and by the Session Summary (step 80) as the finished record.
 */
import { useTranslation } from 'react-i18next';
import { Stepper, type StepDef, type StepStatus, type StepStatusWords } from '@/components/composed/stepper';
import { useMotionSettings } from '@/motion';
import { FINALIZATION_STEPS } from './finalizing.model';

export interface FinalizationPipelineProps {
  statuses: readonly StepStatus[];
  /** Seconds per finished step ("0.8"), pipeline order; null while a step runs or waits. */
  seconds: readonly (string | null)[];
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

export function FinalizationPipeline({ statuses, seconds, testID = 'finalizing-pipeline' }: FinalizationPipelineProps) {
  const { t } = useTranslation();
  const settings = useMotionSettings();
  const words = useFinalizingStepperWords();
  const steps: StepDef[] = FINALIZATION_STEPS.map((id, index) => {
    const took = seconds[index];
    return {
      key: id,
      label: t(`common.enums.finalizationStep.${id}`),
      ...(took ? { description: t('session.finalization.stepDuration', { seconds: took }) } : {}),
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
      statusWords={words}
    />
  );
}
