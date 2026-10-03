import type { ResourceTree } from '@/i18n/resources';

/**
 * Copy owned by the navigation shell (step 70), registered in `src/i18n/features.ts` under
 * `navigation`, so it resolves as `features.navigation.*`. Tab labels, the mini-bar and the
 * back-guard dialog copy already live in the mobile namespace (`mobile.nav.*`, `mobile.miniBar.*`,
 * `mobile.backGuard.*`, step 68); this tree holds only what the shell adds.
 */
export const navigationEn = {
  // Accessible name of the tab bar and the rail (04 §3.4).
  tabList: 'Main navigation',
  // `+not-found` (04 §3.1).
  notFound: {
    title: 'Page not found',
    description: 'This link does not open a screen in DEMS.',
    action: 'Back to DEMS',
  },
  // 04 §3.5: `/session/new` is refused while a session is active.
  sessionBusy: {
    title: 'A session is already active',
    description: 'Finish or recover the current session before starting a new one.',
  },
  // Route stubs until each screen step replaces its screen (05 M-03).
  stub: {
    label: 'Placeholder for screen-{{id}}',
  },
} as const satisfies ResourceTree;
