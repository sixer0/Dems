// Self-check fixture: a hook module at the place and with the export that row W17 will use for
// the real migrations (`<workspace>/test/db/template-hook.schema.ts`). Here the "workspace" is
// this fixture folder, and the "migration" is the helper's one-table stand-in.
import type { TemplateHook } from '../../../../hooks';
import { probeSchemaHook } from '../../../../testing/probe-hooks';

export const templateHook: TemplateHook = async (context) => {
  await probeSchemaHook(context);
};
