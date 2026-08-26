import { defineConfig } from 'vite';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('.', import.meta.url));

// 멀티 페이지 — 학습 일지(/)와 일기장(/diary/)을 한 번에 빌드한다.
export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        main:  resolve(root, 'index.html'),
        diary: resolve(root, 'diary/index.html'),
      },
    },
  },
});
