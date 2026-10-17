import { PrismaClient } from '@prisma/client';
export { PrismaClient } from '@prisma/client';

// 全局单例，避免开发热重载时反复实例化
export const prisma = new PrismaClient();

export type * from '@prisma/client';
