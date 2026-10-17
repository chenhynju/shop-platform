import { describe, expect, it } from 'vitest';
import { hashPassword, verifyPassword } from '../src/lib/password';
import { readConfig } from '../src/lib/config';
describe('password hashing', () => {
  it('salts hashes and verifies only the correct password', async () => {
    const a = await hashPassword('correct-password-1234');
    const b = await hashPassword('correct-password-1234');
    expect(a).not.toBe(b);
    expect(await verifyPassword('correct-password-1234', a)).toBe(true);
    expect(await verifyPassword('wrong-password-1234', a)).toBe(false);
    for (const invalid of ['bad', 'scrypt$salt$nope', 'other$salt$' + 'a'.repeat(128)])
      expect(await verifyPassword('x', invalid)).toBe(false);
  });
});
describe('fail-closed configuration', () => {
  it('requires database config and valid bounded ports', () => {
    for (const env of [
      {},
      { DATABASE_URL: 'postgresql://postgres:postgres@localhost:5432/shop', PORT: '0' },
      { DATABASE_URL: 'postgresql://postgres:postgres@localhost:5432/shop', PORT: '70000' },
      { DATABASE_URL: 'postgresql://localhost' },
      { DATABASE_URL: 'file:test.db' },
      { DATABASE_URL: 'postgresql://postgres:postgres@localhost:5432/shop', NODE_ENV: 'oops' }
    ])
      expect(() => readConfig(env)).toThrow();
  });
  it('requires an exact HTTPS production origin', () => {
    for (const APP_ORIGIN of [
      undefined,
      'http://example.com',
      'https://example.com/path',
      'https://user:secret@example.com'
    ])
      expect(() =>
        readConfig({
          NODE_ENV: 'production',
          DATABASE_URL: 'postgresql://postgres:postgres@localhost:5432/shop',
          APP_ORIGIN
        })
      ).toThrow();
    expect(
      readConfig({
        NODE_ENV: 'production',
        DATABASE_URL: 'postgresql://postgres:postgres@localhost:5432/shop',
        APP_ORIGIN: 'https://example.com'
      }).APP_ORIGIN
    ).toBe('https://example.com');
    expect(
      readConfig({ DATABASE_URL: 'postgresql://postgres:postgres@localhost:5432/shop' }).PORT
    ).toBe(3001);
  });
});

it('accepts the postgres URL alias', () => {
  expect(readConfig({ DATABASE_URL: 'postgres://localhost/shop' }).PORT).toBe(3001);
});
