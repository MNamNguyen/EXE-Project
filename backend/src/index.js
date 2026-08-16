const app = require('./app');
const prisma = require('./lib/prisma');

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`[OK] Server running on port ${PORT}`);
  // Pre-warm the DB connection so the first real request doesn't pay the cost.
  prisma.$connect()
    .then(() => console.log('[OK] DB connected'))
    .catch((err) => console.error('[WARN] DB pre-connect failed (will retry on first request):', err.message));
});
