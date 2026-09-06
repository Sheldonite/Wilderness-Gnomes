import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  server: {
    watch: { ignored: ['**/artifacts/**'] },
    port: 5187,
    strictPort: true
  }
});
