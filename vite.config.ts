import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  server: {
    watch: {
      ignored: (filePath: string) => filePath.includes('/tools/rmbg-pipeline/.venv/'),
    },
  },
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
  },
});
