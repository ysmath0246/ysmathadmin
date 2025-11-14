// vite.config.js
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  base: '/ysmathadmin/',  // ✅ GitHub 저장소 이름 (앞뒤 슬래시 필수!)
  build: {
    outDir: 'docs',        // ✅ Pages가 읽는 폴더
    emptyOutDir: true      // ✅ 이전 빌드 잔여 파일 자동 삭제 (추천!)
  },
  server: {
    hmr: {
      overlay: false       // ⛔️ 로컬 개발 시 에러창 덮지 않게
    }
  },
  plugins: [react()],
  resolve: {
    alias: {
      '@': '/src'          // ✅ 경로 별칭 (정상)
    }
  }
});
