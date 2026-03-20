import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },
  server: {
    port: 3000,
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
        configure: (proxy) => {
          proxy.on('error', (err, _req, res) => {
            // API server not running locally — SaveService will fall back to localStorage
            console.warn(
              `[dev proxy] /api unavailable (${(err as NodeJS.ErrnoException).code ?? err.message}). ` +
              'SaveService will use localStorage fallback. Run `vercel dev` to enable the API.'
            );
            if ('writeHead' in res && typeof (res as { writeHead: unknown }).writeHead === 'function') {
              (res as { writeHead: (s: number, h: Record<string, string>) => void; end: (b: string) => void })
                .writeHead(503, { 'Content-Type': 'application/json' });
              (res as { end: (b: string) => void }).end(JSON.stringify({ error: 'API server offline' }));
            }
          });
        },
      },
    },
  },
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    rollupOptions: {
      output: {
        manualChunks: {
          phaser: ['phaser'],
        },
      },
    },
  },
  // Ensure /public/content/ is served as-is (not bundled)
  publicDir: 'public',
});
