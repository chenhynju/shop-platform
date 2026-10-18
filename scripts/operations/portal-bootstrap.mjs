import { prisma } from '@repo/db';
import { randomBytes, scryptSync } from 'node:crypto';
const mode = process.env.PROVISION_MODE;
if (!['stage', 'production'].includes(mode)) throw new Error('Explicit provisioning mode required');
const prefix = mode === 'stage' ? 'stage-' : '';
const records = Array.from({ length: 8 }, (_, i) => ({
  audience: 'seller',
  email: `${prefix}merchant${String(i + 1).padStart(2, '0')}@example.test`,
  name: `Demo merchant ${String(i + 1).padStart(2, '0')}`,
  password: randomBytes(18).toString('base64url')
}));
records.push({
  audience: 'admin',
  email: `${prefix}platform01@example.test`,
  name: 'Platform operations viewer',
  password: randomBytes(18).toString('base64url')
});
try {
  await prisma.$transaction(
    async (tx) => {
      if (await tx.user.count({ where: { email: { in: records.map((r) => r.email) } } }))
        throw new Error('Account collision; refusing overwrite');
      for (const r of records) {
        const salt = randomBytes(16).toString('hex');
        const u = await tx.user.create({
          data: {
            email: r.email,
            name: r.name,
            role: 'USER',
            passwordHash: `scrypt$${salt}$${scryptSync(r.password, salt, 64).toString('hex')}`
          }
        });
        r.userId = u.id;
        if (r.audience === 'seller') {
          const merchant = await tx.merchant.create({
            data: {
              name: r.name,
              stores: { create: { name: `${r.name} store` } },
              members: { create: { userId: u.id, role: 'OWNER' } }
            }
          });
          r.merchantId = merchant.id;
          r.role = 'OWNER';
        } else {
          await tx.platformMembership.create({ data: { userId: u.id, role: 'VIEWER' } });
          r.role = 'VIEWER';
        }
        await tx.commerceAudit.create({
          data: {
            actorId: 0,
            audience: 'system',
            merchantId: r.merchantId,
            action: 'BOOTSTRAP_ACCOUNT',
            target: r.email
          }
        });
      }
    },
    { timeout: 30000 }
  );
  console.log(JSON.stringify(records));
} finally {
  await prisma.$disconnect();
}
