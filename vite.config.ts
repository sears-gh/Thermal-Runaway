import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { viteSingleFile } from 'vite-plugin-singlefile';

export default defineConfig({
  plugins: [react(), viteSingleFile()],
  build: {
    // Help singlefile inline everything
    assetsInlineLimit: 100 * 1024 * 1024,
    cssCodeSplit: false,
  },
});
