import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  // Relative base so the build works under any path (e.g. GitHub Pages project
  // sites served at https://<user>.github.io/<repo>/) without hardcoding a name.
  base: './',
  plugins: [react()],
  server: { port: 5173 },
});
