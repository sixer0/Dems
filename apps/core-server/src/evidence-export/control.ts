/**
 * The control of the export jobs of an app (`evidenceExport(app)`): where the composition hands the
 * jobs in and where the routes find them. In its own file so that `host.ts` (which provides) and
 * the index (which re-exports) both import it without a cycle.
 */
import type { EvidenceExportRuntime } from './jobs';

export interface EvidenceExportControl {
  /** Hands in the export jobs of real packages. Once per app. */
  provide(runtime: EvidenceExportRuntime): void;
  /** What was provided, or null. */
  current(): EvidenceExportRuntime | null;
}

// Keyed by the app's stage registry: one object per app, the same from every scope of it
// (the `sttConfigControl(app)` idiom).
const controls = new WeakMap<object, EvidenceExportControl>();

/** The control of an app. It exists from the first call. */
export function evidenceExport(app: { readonly stages: object }): EvidenceExportControl {
  const known = controls.get(app.stages);
  if (known !== undefined) return known;
  let provided: EvidenceExportRuntime | null = null;
  const control: EvidenceExportControl = {
    provide(runtime) {
      if (provided !== null) throw new Error('the export jobs of real evidence packages were provided twice');
      provided = runtime;
    },
    current: () => provided,
  };
  controls.set(app.stages, control);
  return control;
}
