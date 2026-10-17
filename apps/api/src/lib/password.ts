import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
const derive = promisify(scrypt);
export async function hashPassword(password: string) {
  const salt = randomBytes(16).toString('hex');
  const hash = (await derive(password, salt, 64)) as Buffer;
  return `scrypt$${salt}$${hash.toString('hex')}`;
}
export async function verifyPassword(password: string, encoded: string) {
  const [algorithm, salt, value] = encoded.split('$');
  if (algorithm !== 'scrypt' || !salt || !value || !/^[a-f0-9]{128}$/.test(value)) return false;
  const hash = (await derive(password, salt, 64)) as Buffer;
  return timingSafeEqual(hash, Buffer.from(value, 'hex'));
}
