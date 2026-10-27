import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import fs from 'node:fs';
import path from 'node:path';

// Mô hình nhận diện khuôn mặt (@vladmandic/human) phục vụ từ chính site tại /models/human/
// thay vì CDN: kiosk ở hội trường mạng chập chờn vẫn chạy khi trang đã tải, và phiên bản
// mô hình luôn khớp phiên bản thư viện đã ghim. Lấy thẳng từ node_modules để khỏi commit
// ~10MB file nhị phân. Chỉ những mô hình faceEngine.js bật — thêm mô hình thì thêm ở đây.
const HUMAN_MODELS = ['blazeface', 'facemesh', 'faceres', 'antispoof', 'liveness']
  .flatMap((name) => [`${name}.json`, `${name}.bin`]);
const HUMAN_MODEL_DIR = path.resolve('node_modules/@vladmandic/human/models');

function humanModels() {
  return {
    name: 'human-models',
    configureServer(server) {
      server.middlewares.use('/models/human', (req, res, next) => {
        const file = decodeURIComponent((req.url || '').split('?')[0]).replace(/^\//, '');
        if (!HUMAN_MODELS.includes(file)) return next();
        res.setHeader('Content-Type', file.endsWith('.json') ? 'application/json' : 'application/octet-stream');
        fs.createReadStream(path.join(HUMAN_MODEL_DIR, file)).pipe(res);
      });
    },
    generateBundle() {
      for (const file of HUMAN_MODELS) {
        this.emitFile({ type: 'asset', fileName: `models/human/${file}`, source: fs.readFileSync(path.join(HUMAN_MODEL_DIR, file)) });
      }
    },
  };
}

export default defineConfig({
  plugins: [react(), humanModels()],
  // faceWorker.js mở bằng { type: 'module' }; mặc định 'iife' của Vite không khớp kiểu đó.
  worker: { format: 'es' },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true,
      },
    },
  },
});
