import { defineConfig } from 'vite';
import path from 'path';

export default defineConfig({
  root: './',
  publicDir: 'public',
  server: {
    port: 3000,
    cors: {
      origin: '*'
    },
    proxy: {
      '/socket.io': {
        target: 'http://localhost:3001',
        ws: true
      }
    }
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src')
    }
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    minify: true
  }
}); 