// Self-check fixture: a hook module at the place row W25 will use for the real bulk fixture
// (`<workspace>/src/db/fixtures/__tests__/template-hook.bulk.ts`). It uses the default export,
// which the helper accepts as well.
import type { TemplateHook } from '../../../../../../hooks';
import { probeBulkHook } from '../../../../../../testing/probe-hooks';

const hook: TemplateHook = async (context) => {
  await probeBulkHook(context);
};

export default hook;
