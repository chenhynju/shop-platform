// Redis 客户端与库存原子操作（防超卖核心）
// 设计：Redis 保存「可售库存」= DB 库存的快照，下单先经 Lua 原子预扣，
// DB 事务成功后再由 DB 权威确认；失败/超时则 INCR 回补。
// 这样并发扣减发生在 Redis 单线程原子上下文，DB 只承担最终一致与持久化。
import Redis from 'ioredis';

export const redis = new Redis(process.env.REDIS_URL ?? 'redis://localhost:6379', {
  maxRetriesPerRequest: 2,
  retryStrategy: (times) => Math.min(times * 200, 3000)
});

export const stockKey = (sku: string) => `stock:${sku}`;
export const cartKey = (userId: number) => `cart:${userId}`;

// Lua：原子检查并扣减。返回 1=成功 0=库存不足 -1=未初始化
const DEDUCT_LUA = `
local key = KEYS[1]
local qty = tonumber(ARGV[1])
local stock = redis.call('GET', key)
if not stock then return -1 end
stock = tonumber(stock)
if stock < qty then return 0 end
redis.call('DECRBY', key, qty)
return 1
`;

// Lua：原子回补（上限保护，避免回补溢出）
const RELEASE_LUA = `
local key = KEYS[1]
local qty = tonumber(ARGV[1])
local cap = tonumber(ARGV[2] or 0)
local stock = redis.call('GET', key)
if not stock then stock = '0' end
stock = tonumber(stock)
if cap > 0 and stock + qty > cap then
  redis.call('SET', key, cap)
else
  redis.call('INCRBY', key, qty)
end
return 1
`;

export type DeductResult = 'OK' | 'NO_STOCK' | 'NOT_INIT';

export async function deductStock(sku: string, qty: number): Promise<DeductResult> {
  const result = (await redis.eval(DEDUCT_LUA, 1, stockKey(sku), String(qty))) as number;
  if (result === 1) return 'OK';
  if (result === 0) return 'NO_STOCK';
  return 'NOT_INIT';
}

export async function releaseStock(sku: string, qty: number, cap = 0): Promise<void> {
  await redis.eval(RELEASE_LUA, 1, stockKey(sku), String(qty), String(cap));
}

export async function initStock(sku: string, stock: number): Promise<void> {
  await redis.set(stockKey(sku), String(stock));
}

export async function getRedisStock(sku: string): Promise<number | null> {
  const value = await redis.get(stockKey(sku));
  return value === null ? null : Number(value);
}

// ── 购物车（Redis hash：field=sku, value=数量）──
export async function cartAdd(userId: number, sku: string, quantity: number): Promise<number> {
  return redis.hincrby(cartKey(userId), sku, quantity);
}

export async function cartSet(userId: number, sku: string, quantity: number): Promise<void> {
  if (quantity <= 0) await redis.hdel(cartKey(userId), sku);
  else await redis.hset(cartKey(userId), sku, String(quantity));
}

export async function cartGet(userId: number): Promise<Record<string, number>> {
  const raw = await redis.hgetall(cartKey(userId));
  const result: Record<string, number> = {};
  for (const [sku, qty] of Object.entries(raw)) result[sku] = Number(qty);
  return result;
}

export async function cartClear(userId: number): Promise<void> {
  await redis.del(cartKey(userId));
}
