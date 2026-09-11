import { defineConfig } from 'vite';

export default defineConfig({
  server: { strictPort: true, watch: { ignored: ['**/artifacts/**', '**/test-results/**', '**/playwright-report/**'] } },
  preview: { strictPort: true },
});
