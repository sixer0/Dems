// T-TI-1, first of two files: its own clone, the same token hash as the other file, one row.
// The body is shared with `isolation-b.db.test.ts` (see `../testing/isolation-suite.ts`).
import { defineIsolationSuite } from '../testing/isolation-suite';

defineIsolationSuite('isolation_a');
