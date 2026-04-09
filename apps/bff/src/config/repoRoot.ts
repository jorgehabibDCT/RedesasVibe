import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const thisFileDir = dirname(fileURLToPath(import.meta.url));

/**
 * Monorepo root (directory containing `fixtures/`, `apps/`, `packages/`).
 * Resolved from `apps/bff/src/config/repoRoot.ts`.
 */
export function getMonorepoRoot(): string {
  return join(thisFileDir, '..', '..', '..', '..');
}
