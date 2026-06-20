const { PrismaClient } = require('@prisma/client');

// Supabase's pgBouncer Transaction Mode (port 6543) does not persist prepared
// statements across connections. Prisma uses prepared statements by default,
// which causes error 26000 ("prepared statement does not exist") when pgBouncer
// routes a query to a different PostgreSQL backend.
//
// ?pgbouncer=true tells Prisma to set statement_cache_size=0 (no prepared stmts).
// This function ensures the flag is present regardless of what was set in .env.
function withPgBouncer(url) {
  if (!url) return url;
  try {
    const u = new URL(url);
    u.searchParams.set('pgbouncer', 'true');
    // Limit Prisma's internal pool to 1 — pgBouncer already manages the real pool.
    if (!u.searchParams.has('connection_limit')) {
      u.searchParams.set('connection_limit', '1');
    }
    // Give enough headroom for cold-start reconnects (backend may sleep on free tier).
    if (!u.searchParams.has('pool_timeout')) {
      u.searchParams.set('pool_timeout', '30');
    }
    // Fail fast if the DB host itself is unreachable (e.g. Supabase paused).
    if (!u.searchParams.has('connect_timeout')) {
      u.searchParams.set('connect_timeout', '10');
    }
    return u.toString();
  } catch {
    return url;
  }
}

// Reuse singleton across hot-reloads in dev so we don't exhaust connection slots.
const globalWithPrisma = global;

const prisma =
  globalWithPrisma._prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
    datasources: {
      db: { url: withPgBouncer(process.env.DATABASE_URL) },
    },
  });

if (process.env.NODE_ENV !== 'production') {
  globalWithPrisma._prisma = prisma;
}

module.exports = prisma;
