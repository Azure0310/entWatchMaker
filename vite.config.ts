/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// base './' so the built site works from any sub path (GitHub Pages project sites included).
export default defineConfig({
  base: './',
  plugins: [react()],
  build: {
    target: 'es2022',
    sourcemap: false,
  },
  worker: {
    format: 'iife',
  },
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
  },
});
