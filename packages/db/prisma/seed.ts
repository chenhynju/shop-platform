// Explicit operator bootstrap; no default accounts or passwords.
import { PrismaClient } from '@prisma/client';
import { randomBytes, scrypt } from 'node:crypto';
import { promisify } from 'node:util';
const prisma = new PrismaClient();
async function main() {
  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD;
  if (
    !email ||
    !password ||
    password.length < 16 ||
    password.length > 128 ||
    !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)
  )
    throw new Error('Set ADMIN_EMAIL and ADMIN_PASSWORD (16–128 characters) explicitly.');
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing)
    throw new Error(
      'Account already exists. Bootstrap refuses to overwrite its password or privileges.'
    );
  const salt = randomBytes(16).toString('hex');
  const hash = (await promisify(scrypt)(password, salt, 64)) as Buffer;
  await prisma.user.create({
    data: {
      email,
      name: 'Workspace administrator',
      role: 'ADMIN',
      passwordHash: `scrypt$${salt}$${hash.toString('hex')}`
    }
  });
  console.log('[db] administrator created; no credentials logged');
}
main()
  .catch(() => {
    console.error(
      '[db] bootstrap failed: check explicit credentials and ensure account does not exist'
    );
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
