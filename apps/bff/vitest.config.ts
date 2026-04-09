import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.test.ts'],
    env: {
      PEGASUS_AUTH_DISABLED: 'true',
      CORS_ORIGINS: 'http://localhost:5173',
    },
  },
});
