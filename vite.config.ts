import { sites } from '@openai/sites-vite-plugin';
import tailwindcss from '@tailwindcss/postcss';
import vinext from 'vinext';
import { defineConfig } from 'vite';

// This application runs entirely in the browser and publishes a static export.
// Local development does not need a Cloudflare emulator or runtime bindings.
export default defineConfig({
  css: { postcss: { plugins: [tailwindcss()] } },
  plugins: [vinext(), sites()],
  server: { host: '127.0.0.1', port: 3000, strictPort: true },
});
