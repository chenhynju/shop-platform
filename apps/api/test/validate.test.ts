import { describe, expect, it } from 'vitest';
import { validateEmail } from '../src/lib/validate';

describe('validateEmail', () => {
  it('accepts valid emails', () => {
    expect(validateEmail('alice@example.com')).toBe(true);
    expect(validateEmail('a.b+c@sub.domain.co')).toBe(true);
  });

  it('rejects invalid emails', () => {
    expect(validateEmail('not-an-email')).toBe(false);
    expect(validateEmail('a@b')).toBe(false);
    expect(validateEmail('a b@c.com')).toBe(false);
    expect(validateEmail('')).toBe(false);
  });
});
