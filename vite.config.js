import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        teacher: resolve(__dirname, 'teacher.html'),
        parent: resolve(__dirname, 'parent.html'),
        admin: resolve(__dirname, 'admin.html'),
        certificate: resolve(__dirname, 'certificate.html'),
        leaderboard: resolve(__dirname, 'leaderboard.html')
      }
    }
  }
});
