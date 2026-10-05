// T-TI-1, second of two files: its own clone, the same token hash as the other file, one row.
// The body is shared with `isolation-a.db.test.ts` (see `../testing/isolation-suite.ts`).
import { defineIsolationSuite } from '../testing/isolation-suite';

defineIsolationSuite('isolation_b');
