// Self-check fixture: a hook module at the place row W20 will use for the real seed
// (`<workspace>/src/db/seed/__tests__/template-hook.seed.ts`).
import type { TemplateHook } from '../../../../../../hooks';
import { probeSeedHook } from '../../../../../../testing/probe-hooks';

export const templateHook: TemplateHook = async (context) => {
  await probeSeedHook(context);
};
