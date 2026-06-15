import { defineConfig } from 'vite';
import { fileURLToPath, URL } from 'node:url';

// Vite-Konfiguration für Cup Crusaders.
// - Pfad-Alias '@' → src/ (deckt sich mit tsconfig paths)
// - Phaser wird in einen eigenen Vendor-Chunk gesplittet (großes Bundle)
export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  build: {
    target: 'es2020',
    rollupOptions: {
      output: {
        manualChunks: {
          phaser: ['phaser'],
        },
      },
    },
  },
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.test.ts'],
  },
});
