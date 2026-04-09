import { join } from 'node:path';
import { getMonorepoRoot } from './repoRoot.js';

/** Resolved absolute path to the canonical bitácora fixture (same rules as `loadCanonicalFixture`). */
export function getCanonicalFixturePath(): string {
  return process.env.FIXTURE_PATH?.trim() || join(getMonorepoRoot(), 'fixtures', 'bitacora-canonical.json');
}
