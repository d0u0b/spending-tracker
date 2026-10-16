import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// 相對路徑 base + HashRouter：部署到 GitHub Pages 子路徑時不需要額外設定 repo 名稱
export default defineConfig({
  base: './',
  plugins: [react(), tailwindcss()],
});
