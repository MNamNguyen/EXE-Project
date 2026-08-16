// Chạy trước mọi test file (--require): khởi tạo env tối thiểu để PrismaClient
// và các service khởi tạo được. Test chỉ mock query — KHÔNG connect DB thật.
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret-jwt-key-32-chars-min';
process.env.QR_SECRET = process.env.QR_SECRET || 'test-secret-qr-key-32-chars-min';
process.env.DATABASE_URL = process.env.DATABASE_URL || 'postgresql://test:test@localhost:5432/test?pgbouncer=true';
process.env.DIRECT_URL = process.env.DIRECT_URL || 'postgresql://test:test@localhost:5432/test';
