// Chạy trước mọi test file (--require): khởi tạo env tối thiểu để PrismaClient
// và các service khởi tạo được. Test chỉ mock query — KHÔNG connect DB thật.
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret-jwt-key-32-chars-min';
process.env.QR_SECRET = process.env.QR_SECRET || 'test-secret-qr-key-32-chars-min';
process.env.DATABASE_URL = process.env.DATABASE_URL || 'postgresql://test:test@localhost:5432/test?pgbouncer=true';
process.env.DIRECT_URL = process.env.DIRECT_URL || 'postgresql://test:test@localhost:5432/test';

// Stub method cho Prisma delegate: node:test mock.method không chạy được với
// Prisma client (delegate dùng Proxy, own-property value là undefined).
// Gán trực tiếp và phục hồi bản gốc sau mỗi test.
const activeStubs = [];

function stubMethod(target, method, impl) {
  const original = target[method];
  const calls = [];
  const wrapped = function (...args) {
    calls.push(args);
    return impl.apply(this, args);
  };
  wrapped.calls = calls; // stub.calls.length = số lần gọi, stub.calls[i] = mảng args
  target[method] = wrapped;
  activeStubs.push(() => { target[method] = original; });
  return wrapped;
}

function restoreStubs() {
  while (activeStubs.length) activeStubs.pop()();
}

module.exports = { stubMethod, restoreStubs };
