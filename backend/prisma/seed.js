const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  const adminPassword = await bcrypt.hash('Admin@123', 10);
  const admin = await prisma.user.upsert({
    where: { email: 'admin@fpt.edu.vn' },
    update: {},
    create: {
      mssv: null,
      email: 'admin@fpt.edu.vn',
      name: 'System Admin',
      role: 'ADMIN',
      passwordHash: adminPassword,
      isFirstLogin: false,
    },
  });

  const btcPassword = await bcrypt.hash('Btc@123456', 10);
  const btc = await prisma.user.upsert({
    where: { email: 'btc@fpt.edu.vn' },
    update: {},
    create: {
      mssv: null,
      email: 'btc@fpt.edu.vn',
      name: 'Ban Tổ Chức',
      role: 'BTC',
      passwordHash: btcPassword,
      isFirstLogin: false,
    },
  });

  const studentPassword = await bcrypt.hash('Student@123', 10);
  await prisma.user.upsert({
    where: { email: 'se123456@fpt.edu.vn' },
    update: {},
    create: {
      mssv: 'SE123456',
      email: 'se123456@fpt.edu.vn',
      name: 'Nguyễn Văn An',
      role: 'STUDENT',
      class: 'SE1701',
      faculty: 'Software Engineering',
      passwordHash: studentPassword,
      isFirstLogin: false,
    },
  });

  console.log('[OK] Seed complete');
  console.log('Admin:   admin@fpt.edu.vn / Admin@123');
  console.log('BTC:     btc@fpt.edu.vn / Btc@123456');
  console.log('Student: SE123456 / Student@123');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
