import { defineConfig } from 'vite';
export default defineConfig({
  root: 'tests/browser',
  build: { outDir: '../../artifacts/local/input-browser', emptyOutDir: true, rolldownOptions: { input: { input: 'tests/browser/index.html', scene: 'tests/browser/scene.html' } } },
  preview: { host: '127.0.0.1', port: 4174, strictPort: true },
});
