// Task 4 row 89 (caution C-8 of review 086): THE START OF THE ENTRY FILE BY A TEST. Loaded with `--import` AFTER
// `--import tsx`, so that its resolve hook runs first (hooks run last-registered first). Test support: no production
// source imports it (rule CPB1-12). What the hook does is in `hooks.mjs`.
import { register } from 'node:module';

register('./hooks.mjs', import.meta.url);
