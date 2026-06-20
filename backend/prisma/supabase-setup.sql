-- ============================================================
-- Attendance Management System - Supabase SQL Setup
-- Chạy toàn bộ file này trong Supabase SQL Editor
-- Project: https://supabase.com/dashboard
-- ============================================================

-- ============================================================
-- BƯỚC 1: Enable extensions cần thiết
-- ============================================================
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- BƯỚC 2: Tạo ENUM types
-- ============================================================
DO $$ BEGIN
  CREATE TYPE "Role" AS ENUM ('ADMIN', 'BTC', 'LECTURER', 'STUDENT');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "AttendanceStatus" AS ENUM ('REGISTERED', 'CHECKED_IN', 'CHECKED_OUT', 'ABSENT');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- ============================================================
-- BƯỚC 3: Tạo các bảng
-- ============================================================

-- Bảng người dùng
CREATE TABLE IF NOT EXISTS "attendance_users" (
  "id"           TEXT        NOT NULL,
  "mssv"         TEXT,
  "email"        TEXT        NOT NULL,
  "name"         TEXT        NOT NULL,
  "role"         "Role"      NOT NULL DEFAULT 'STUDENT',
  "passwordHash" TEXT        NOT NULL,
  "class"        TEXT,
  "faculty"      TEXT,
  "phone"        TEXT,
  "isFirstLogin" BOOLEAN     NOT NULL DEFAULT TRUE,
  "isActive"     BOOLEAN     NOT NULL DEFAULT TRUE,
  "createdAt"    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt"    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "attendance_users_pkey" PRIMARY KEY ("id")
);

-- Bảng sự kiện
CREATE TABLE IF NOT EXISTS "attendance_events" (
  "id"            TEXT             NOT NULL,
  "name"          TEXT             NOT NULL,
  "description"   TEXT,
  "location"      TEXT             NOT NULL,
  "lat"           DOUBLE PRECISION,
  "lng"           DOUBLE PRECISION,
  "radius"        DOUBLE PRECISION NOT NULL DEFAULT 100,
  "gpsEnabled"    BOOLEAN          NOT NULL DEFAULT TRUE,
  "checkinOpen"   TIMESTAMPTZ      NOT NULL,
  "checkinClose"  TIMESTAMPTZ      NOT NULL,
  "checkoutOpen"  TIMESTAMPTZ      NOT NULL,
  "checkoutClose" TIMESTAMPTZ      NOT NULL,
  "bannerUrl"     TEXT,
  "isWhitelisted" BOOLEAN          NOT NULL DEFAULT FALSE,
  "isActive"      BOOLEAN          NOT NULL DEFAULT TRUE,
  "createdById"   TEXT             NOT NULL,
  "createdAt"     TIMESTAMPTZ      NOT NULL DEFAULT NOW(),
  "updatedAt"     TIMESTAMPTZ      NOT NULL DEFAULT NOW(),
  CONSTRAINT "attendance_events_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "attendance_events_createdById_fkey"
    FOREIGN KEY ("createdById")
    REFERENCES "attendance_users"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE
);

-- Bảng whitelist thành viên sự kiện
CREATE TABLE IF NOT EXISTS "attendance_event_members" (
  "id"      TEXT NOT NULL,
  "eventId" TEXT NOT NULL,
  "userId"  TEXT NOT NULL,
  CONSTRAINT "attendance_event_members_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "attendance_event_members_eventId_fkey"
    FOREIGN KEY ("eventId")
    REFERENCES "attendance_events"("id")
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "attendance_event_members_userId_fkey"
    FOREIGN KEY ("userId")
    REFERENCES "attendance_users"("id")
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "attendance_event_members_eventId_userId_key"
    UNIQUE ("eventId", "userId")
);

-- Bảng điểm danh
CREATE TABLE IF NOT EXISTS "attendance_records" (
  "id"           TEXT               NOT NULL,
  "userId"       TEXT               NOT NULL,
  "eventId"      TEXT               NOT NULL,
  "checkinTime"  TIMESTAMPTZ,
  "checkoutTime" TIMESTAMPTZ,
  "checkinGps"   JSONB,
  "checkoutGps"  JSONB,
  "deviceId"     TEXT,
  "ip"           TEXT,
  "status"       "AttendanceStatus" NOT NULL DEFAULT 'REGISTERED',
  "createdAt"    TIMESTAMPTZ        NOT NULL DEFAULT NOW(),
  "updatedAt"    TIMESTAMPTZ        NOT NULL DEFAULT NOW(),
  CONSTRAINT "attendance_records_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "attendance_records_userId_fkey"
    FOREIGN KEY ("userId")
    REFERENCES "attendance_users"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "attendance_records_eventId_fkey"
    FOREIGN KEY ("eventId")
    REFERENCES "attendance_events"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "attendance_records_userId_eventId_key"
    UNIQUE ("userId", "eventId")
);

-- Bảng ghi nhận gian lận
CREATE TABLE IF NOT EXISTS "attendance_fraud_logs" (
  "id"        TEXT        NOT NULL,
  "userId"    TEXT,
  "eventId"   TEXT,
  "reason"    TEXT        NOT NULL,
  "ip"        TEXT,
  "deviceId"  TEXT,
  "gps"       JSONB,
  "token"     TEXT,
  "metadata"  JSONB,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "attendance_fraud_logs_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "attendance_fraud_logs_userId_fkey"
    FOREIGN KEY ("userId")
    REFERENCES "attendance_users"("id")
    ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "attendance_fraud_logs_eventId_fkey"
    FOREIGN KEY ("eventId")
    REFERENCES "attendance_events"("id")
    ON DELETE SET NULL ON UPDATE CASCADE
);

-- Bảng binding thiết bị
CREATE TABLE IF NOT EXISTS "attendance_device_bindings" (
  "id"         TEXT        NOT NULL,
  "userId"     TEXT        NOT NULL,
  "deviceId"   TEXT        NOT NULL,
  "deviceInfo" TEXT,
  "isTrusted"  BOOLEAN     NOT NULL DEFAULT TRUE,
  "createdAt"  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "attendance_device_bindings_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "attendance_device_bindings_userId_fkey"
    FOREIGN KEY ("userId")
    REFERENCES "attendance_users"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "attendance_device_bindings_userId_deviceId_key"
    UNIQUE ("userId", "deviceId")
);

-- Bảng OTP tokens
CREATE TABLE IF NOT EXISTS "attendance_otp_tokens" (
  "id"        TEXT        NOT NULL,
  "userId"    TEXT        NOT NULL,
  "token"     TEXT        NOT NULL,
  "deviceId"  TEXT        NOT NULL,
  "purpose"   TEXT        NOT NULL DEFAULT 'DEVICE_BIND',
  "expiresAt" TIMESTAMPTZ NOT NULL,
  "used"      BOOLEAN     NOT NULL DEFAULT FALSE,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "attendance_otp_tokens_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "attendance_otp_tokens_userId_fkey"
    FOREIGN KEY ("userId")
    REFERENCES "attendance_users"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE
);

-- ============================================================
-- BƯỚC 4: UNIQUE constraints bổ sung
-- ============================================================

-- attendance_users: email unique
DO $$ BEGIN
  ALTER TABLE "attendance_users"
    ADD CONSTRAINT "attendance_users_email_key" UNIQUE ("email");
EXCEPTION
  WHEN duplicate_table THEN NULL;
END $$;

-- attendance_users: mssv unique (chỉ khi không NULL)
CREATE UNIQUE INDEX IF NOT EXISTS "attendance_users_mssv_key"
  ON "attendance_users"("mssv")
  WHERE "mssv" IS NOT NULL;

-- ============================================================
-- BƯỚC 5: INDEXES - Tối ưu hiệu năng truy vấn
-- ============================================================

-- ----- attendance_users -----
-- Lọc theo vai trò (admin list users by role)
CREATE INDEX IF NOT EXISTS "idx_users_role"
  ON "attendance_users"("role");

-- Lọc tài khoản active
CREATE INDEX IF NOT EXISTS "idx_users_isActive"
  ON "attendance_users"("isActive");

-- Tìm active users theo role (query phổ biến nhất)
CREATE INDEX IF NOT EXISTS "idx_users_role_isActive"
  ON "attendance_users"("role", "isActive");

-- ----- attendance_events -----
-- FK lookup khi join với users
CREATE INDEX IF NOT EXISTS "idx_events_createdById"
  ON "attendance_events"("createdById");

-- Lọc sự kiện đang hoạt động
CREATE INDEX IF NOT EXISTS "idx_events_isActive"
  ON "attendance_events"("isActive");

-- Lọc sự kiện whitelist
CREATE INDEX IF NOT EXISTS "idx_events_isWhitelisted"
  ON "attendance_events"("isWhitelisted");

-- Sort/filter theo thời gian check-in mở
CREATE INDEX IF NOT EXISTS "idx_events_checkinOpen"
  ON "attendance_events"("checkinOpen");

-- Query trang student dashboard: active + sắp xếp thời gian
CREATE INDEX IF NOT EXISTS "idx_events_isActive_checkinOpen"
  ON "attendance_events"("isActive", "checkinOpen" DESC);

-- Query BTC event list: active + whitelist filter
CREATE INDEX IF NOT EXISTS "idx_events_isActive_isWhitelisted"
  ON "attendance_events"("isActive", "isWhitelisted");

-- ----- attendance_event_members -----
-- FK lookup eventId (kiểm tra whitelist theo event)
CREATE INDEX IF NOT EXISTS "idx_event_members_eventId"
  ON "attendance_event_members"("eventId");

-- FK lookup userId (danh sách event của user)
CREATE INDEX IF NOT EXISTS "idx_event_members_userId"
  ON "attendance_event_members"("userId");

-- ----- attendance_records -----
-- FK lookup userId (lịch sử điểm danh của sinh viên)
CREATE INDEX IF NOT EXISTS "idx_records_userId"
  ON "attendance_records"("userId");

-- FK lookup eventId (danh sách điểm danh của sự kiện)
CREATE INDEX IF NOT EXISTS "idx_records_eventId"
  ON "attendance_records"("eventId");

-- Lọc theo trạng thái điểm danh
CREATE INDEX IF NOT EXISTS "idx_records_status"
  ON "attendance_records"("status");

-- Sort lịch sử theo thời gian check-in
CREATE INDEX IF NOT EXISTS "idx_records_checkinTime"
  ON "attendance_records"("checkinTime" DESC);

-- Query báo cáo: event + status (thống kê theo event)
CREATE INDEX IF NOT EXISTS "idx_records_eventId_status"
  ON "attendance_records"("eventId", "status");

-- Query student: userId + status (lịch sử filtered)
CREATE INDEX IF NOT EXISTS "idx_records_userId_status"
  ON "attendance_records"("userId", "status");

-- ----- attendance_fraud_logs -----
-- FK lookup userId
CREATE INDEX IF NOT EXISTS "idx_fraud_logs_userId"
  ON "attendance_fraud_logs"("userId");

-- FK lookup eventId
CREATE INDEX IF NOT EXISTS "idx_fraud_logs_eventId"
  ON "attendance_fraud_logs"("eventId");

-- Sort theo thời gian (gần nhất lên đầu)
CREATE INDEX IF NOT EXISTS "idx_fraud_logs_createdAt"
  ON "attendance_fraud_logs"("createdAt" DESC);

-- Query filter theo event + sort (trang FraudLogs)
CREATE INDEX IF NOT EXISTS "idx_fraud_logs_eventId_createdAt"
  ON "attendance_fraud_logs"("eventId", "createdAt" DESC);

-- ----- attendance_device_bindings -----
-- FK lookup userId (kiểm tra thiết bị đã bind)
CREATE INDEX IF NOT EXISTS "idx_device_bindings_userId"
  ON "attendance_device_bindings"("userId");

-- ----- attendance_otp_tokens -----
-- FK lookup userId
CREATE INDEX IF NOT EXISTS "idx_otp_tokens_userId"
  ON "attendance_otp_tokens"("userId");

-- Cleanup expired tokens
CREATE INDEX IF NOT EXISTS "idx_otp_tokens_expiresAt"
  ON "attendance_otp_tokens"("expiresAt");

-- Tìm OTP hợp lệ: userId + purpose (thường dùng nhất)
CREATE INDEX IF NOT EXISTS "idx_otp_tokens_userId_purpose"
  ON "attendance_otp_tokens"("userId", "purpose");

-- Cleanup: tokens chưa dùng + đã hết hạn
CREATE INDEX IF NOT EXISTS "idx_otp_tokens_used_expiresAt"
  ON "attendance_otp_tokens"("used", "expiresAt");

-- ============================================================
-- BƯỚC 6: Trigger tự động cập nhật updatedAt
-- ============================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW."updatedAt" = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS "attendance_users_updated_at" ON "attendance_users";
CREATE TRIGGER "attendance_users_updated_at"
  BEFORE UPDATE ON "attendance_users"
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS "attendance_events_updated_at" ON "attendance_events";
CREATE TRIGGER "attendance_events_updated_at"
  BEFORE UPDATE ON "attendance_events"
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS "attendance_records_updated_at" ON "attendance_records";
CREATE TRIGGER "attendance_records_updated_at"
  BEFORE UPDATE ON "attendance_records"
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- BƯỚC 7: Seed data - Tài khoản demo
-- Mật khẩu được hash bằng bcrypt (pgcrypto)
-- ============================================================
INSERT INTO "attendance_users"
  ("id", "mssv", "email", "name", "role", "passwordHash", "isFirstLogin", "isActive", "createdAt", "updatedAt")
VALUES
  (
    'seed_admin_001',
    NULL,
    'admin@fpt.edu.vn',
    'System Admin',
    'ADMIN',
    crypt('Admin@123', gen_salt('bf', 10)),
    FALSE,
    TRUE,
    NOW(),
    NOW()
  ),
  (
    'seed_btc_001',
    NULL,
    'btc@fpt.edu.vn',
    'Ban Tổ Chức',
    'BTC',
    crypt('Btc@123456', gen_salt('bf', 10)),
    FALSE,
    TRUE,
    NOW(),
    NOW()
  ),
  (
    'seed_student_001',
    'SE123456',
    'se123456@fpt.edu.vn',
    'Nguyễn Văn An',
    'STUDENT',
    crypt('Student@123', gen_salt('bf', 10)),
    FALSE,
    TRUE,
    NOW(),
    NOW()
  )
ON CONFLICT ("email") DO NOTHING;

-- ============================================================
-- BƯỚC 8: Kiểm tra kết quả
-- ============================================================
SELECT
  tablename,
  (SELECT COUNT(*) FROM information_schema.columns
   WHERE table_name = tablename AND table_schema = 'public') AS col_count
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename LIKE 'attendance_%'
ORDER BY tablename;

SELECT
  indexname,
  tablename
FROM pg_indexes
WHERE schemaname = 'public'
  AND tablename LIKE 'attendance_%'
ORDER BY tablename, indexname;
