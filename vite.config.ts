import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import {fileURLToPath, URL} from 'node:url';
import {defineConfig, loadEnv} from 'vite';

export default defineConfig(({mode}) => {
  const env = loadEnv(mode, process.cwd(), '');
  const disableHmr = env.DISABLE_HMR === 'true';

  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url)),
      },
    },
    server: {
      // Proxy API calls to the Laravel application server during development.
      proxy: {
        '/api': {
          target: env.VITE_API_BASE_URL || 'http://localhost:8000',
          changeOrigin: true,
          secure: false,
        },
      },
      // This switch is useful in constrained or containerized development environments.
      hmr: !disableHmr,
      // Disable file watching with HMR to reduce unnecessary filesystem polling.
      watch: disableHmr ? {ignored: ['**/*']} : undefined,
    },
  };
});
