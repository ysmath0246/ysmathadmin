// vite.config.js
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  base: '/ysmathadmin/',  // ✅ 저장소 이름으로 설정
  build: {
    outDir: 'docs'         // ✅ GitHub Pages에서 읽을 폴더
  },
  plugins: [react()],
  resolve: {
    alias: {
      '@': '/src'
    }
  }
});
