import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { randomUUID } from 'crypto';

import * as dotenv from 'dotenv';
import * as path from 'path';

// Carrega o .env localizado na raiz do diretório backend
dotenv.config({ path: path.join(__dirname, '..', '..', '.env') });

async function main() {
  const email = process.env.INITIAL_ADMIN_EMAIL;
  const password = process.env.INITIAL_ADMIN_PASSWORD;

  if (!email || !password) {
    console.error(
      'ERROR: INITIAL_ADMIN_EMAIL and INITIAL_ADMIN_PASSWORD must both be set in the environment.',
    );
    process.exit(1);
  }

  const prisma = new PrismaClient();
  const name = email.split('@')[0];

  console.log(`Checking for user: ${email}`);

  const existing = await (prisma.users as any).findUnique({
    where: { email },
  });

  if (existing) {
    console.log(`User exists, updating role to SUPER_ADMIN...`);
    await (prisma.users as any).update({
      where: { id: existing.id },
      data: { role: 'SUPER_ADMIN' },
    });
    console.log(`✅ User ${email} promoted successfully.`);
  } else {
    console.log(`User does not exist, creating as SUPER_ADMIN...`);
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    await (prisma.users as any).create({
      data: {
        id: randomUUID(),
        email,
        name,
        password: hashedPassword,
        role: 'SUPER_ADMIN',
        updatedAt: new Date(),
      },
    });
    console.log(`✅ User ${email} created as SUPER_ADMIN.`);
  }

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
