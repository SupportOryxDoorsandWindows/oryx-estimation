import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  // Relative paths so the build works at any root domain, such as Slate.
  base: './',
  plugins: [react()],
  test: { environment: 'node' },
} as never)
