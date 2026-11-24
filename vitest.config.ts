import { defineConfig } from 'vitest/config';
import { versioning } from './tools/versioning.ts';

export default defineConfig({
  plugins: [versioning()],
  oxc: { jsx: { runtime: 'automatic', importSource: 'preact' } },
  define: {
    __APP_VERSION__: JSON.stringify('test'),
    __APP_COMMIT__: JSON.stringify('test'),
    __TURN__: JSON.stringify(''),
  },
  test: {
    include: ['tests/unit/**/*.test.ts'],
    environment: 'node',
  },
});
