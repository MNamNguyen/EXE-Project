require('dotenv').config();
const express = require('express');
const prisma = require('./lib/prisma');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

const app = express();

// Security
app.use(helmet());
app.set('trust proxy', 1);
app.use(
  cors({
    origin: process.env.FRONTEND_URL || 'http://localhost:5173',
    credentials: true,
  })
);

// Rate limiting
app.use(
  '/api',
  rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 500,
    standardHeaders: true,
    legacyHeaders: false,
  })
);

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Routes
app.use('/api/auth', require('./routes/auth.routes'));
app.use('/api/events', require('./routes/event.routes'));
app.use('/api/checkin', require('./routes/checkin.routes'));
app.use('/api/admin', require('./routes/admin.routes'));
app.use('/api/reports', require('./routes/report.routes'));

// Health check — dùng cho UptimeRobot để giữ server khỏi ngủ (free tier).
// Ping nhẹ vào DB (SELECT 1) nên cũng giữ luôn DB connection sống.
app.get('/health', async (req, res) => {
  const start = Date.now();
  try {
    await prisma.$queryRaw`SELECT 1`;
    return res.json({
      status: 'ok',
      db: 'connected',
      latency_ms: Date.now() - start,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    return res.status(503).json({
      status: 'error',
      db: 'disconnected',
      message: err.message,
      timestamp: new Date().toISOString(),
    });
  }
});

// 404
app.use((req, res) => res.status(404).json({ success: false, message: 'Endpoint không tồn tại' }));

// Error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ success: false, message: 'Lỗi server' });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`[OK] Server running on port ${PORT}`);
  // Pre-warm the DB connection so the first real request doesn't pay the cost.
  prisma.$connect()
    .then(() => console.log('[OK] DB connected'))
    .catch((err) => console.error('[WARN] DB pre-connect failed (will retry on first request):', err.message));
});
