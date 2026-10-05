/**
 * Global setup of the self-check project `convention`: the real setup of `test:db`, looking for
 * hook modules in the fixture workspace instead of `apps/core-server`. Everything else is the
 * real thing: the real server, the real roles, the real templates.
 */
import type { TestProject } from 'vitest/node';
import { setupDbTestProject } from '../global-setup';
import { conventionResolver } from '../hooks';
import { CONVENTION_WORKSPACE } from './convention-workspace';

export default function setup(project: TestProject): Promise<() => Promise<void>> {
  return setupDbTestProject(project, { resolveDefinition: conventionResolver(CONVENTION_WORKSPACE) });
}
