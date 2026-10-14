import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    // jsdom porque o sanitize usa DOMPurify, que exige DOM de verdade. Em
    // `node` o DOMPurify fica sem janela e devolve a entrada intacta — ou seja,
    // o teste passaria com o sanitizador desligado.
    environment: 'jsdom',
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
  },
});
