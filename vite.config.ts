import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  // Relative paths so the build works on GitHub Pages (/oryx-estimation/) and at a root domain.
  base: './',
  plugins: [react()],
  test: { environment: 'node' },
} as never)
