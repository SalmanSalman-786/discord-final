import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

const proxyConfig = {
  '/api': {
    target: 'https://discord-final-70xj.onrender.com',
    changeOrigin: true,
  },
  '/socket.io': {
    target: 'https://discord-final-70xj.onrender.com',
    ws: true,
    changeOrigin: true,
    configure: (proxy) => {
      proxy.on('error', (err) => {
        if (err.code === 'ECONNRESET') return;
        console.error('Proxy error:', err.message);
      });
    },
  },
};

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    host: '0.0.0.0',
    port: 5173,
    allowedHosts: true,
    proxy: proxyConfig,
  },
  preview: {
    host: '0.0.0.0',
    port: 5173,
    allowedHosts: true,
    proxy: proxyConfig,
  },
});
