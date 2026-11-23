import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { visualizer } from 'rollup-plugin-visualizer';

export default defineConfig({
  plugins: [
    react(),
    visualizer({
      open: false,
      gzipSize: true,
      brotliSize: true,
      filename: 'stats.html',
    }),
  ],
  server: {
    port: Number(process.env.WEB_PORT ?? 5173),
    host: process.env.WEB_HOST ?? '0.0.0.0',
    proxy: {
      '/api': {
        target: process.env.API_URL ?? 'http://localhost:3001',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ''),
      },
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: (id) => {
          // Vendor chunk: libs pesadas de terceiros
          if (id.includes('node_modules')) {
            if (
              id.includes('react') ||
              id.includes('react-dom') ||
              id.includes('react-router-dom')
            ) {
              return 'vendor-react';
            }
            if (
              id.includes('@tanstack') ||
              id.includes('axios') ||
              id.includes('zod') ||
              id.includes('clsx') ||
              id.includes('class-variance-authority')
            ) {
              return 'vendor-tanstack';
            }
            if (
              id.includes('@radix-ui') ||
              id.includes('@dnd-kit') ||
              id.includes('lucide-react')
            ) {
              return 'vendor-ui';
            }
            if (id.includes('recharts')) {
              return 'vendor-charts';
            }
            if (id.includes('dompurify') || id.includes('jspdf') || id.includes('html-to-image')) {
              return 'vendor-editor';
            }
          }
        },
      },
    },
  },
});
