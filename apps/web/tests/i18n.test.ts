import { describe, expect, it } from 'vitest';
import { createTranslator, resolveLocale } from '@toolkit/i18n';
import { chinese, english } from '../lib/messages';
import { localizeError } from '../lib/localize-error';
import { RequestError } from '../lib/api';
import manual from '../content/manual.json';
describe('English-first catalogs and error contract', () => {
  it('covers every English message, preserves interpolation placeholders and has no empty translations', () => {
    const en = createTranslator(english, chinese, 'en');
    const zh = createTranslator(english, chinese, 'zh-CN');
    for (const key of Object.keys(english) as (keyof typeof english)[]) {
      expect(en(key)).toBe(key);
      expect(zh(key).trim().length).toBeGreaterThan(0);
      expect(chinese[key].match(/\{[a-zA-Z]+\}/g) ?? []).toEqual(key.match(/\{[a-zA-Z]+\}/g) ?? []);
    }
    expect(zh('Delete {title}', { title: 'Invoice-01' })).toBe('删除 Invoice-01');
  });
  it('defaults to English and provides matching manual section IDs in both languages', () => {
    expect(resolveLocale(undefined)).toBe('en');
    expect(manual.en.sections.map((section) => section.id)).toEqual(
      manual['zh-CN'].sections.map((section) => section.id)
    );
    for (const locale of ['en', 'zh-CN'] as const)
      expect(manual[locale].sections.every((section) => section.steps.length >= 3)).toBe(true);
  });
  it('keeps safe English API messages and request IDs while localizing Chinese by stable code', () => {
    const error = new RequestError(
      'Email or password is incorrect.',
      'INVALID_CREDENTIALS',
      'trace-123'
    );
    expect(localizeError(error, 'en')).toBe('Email or password is incorrect. · Request trace-123');
    expect(localizeError(error, 'zh-CN')).toBe('邮箱或密码不正确。 · 请求编号 trace-123');
    for (const code of [
      'UNAUTHENTICATED',
      'FORBIDDEN',
      'INVALID_INPUT',
      'INVALID_REQUEST',
      'CONFLICT',
      'NOT_FOUND',
      'RATE_LIMITED',
      'CSRF_REJECTED',
      'NETWORK_ERROR',
      'REQUEST_FAILED',
      'INTERNAL_ERROR'
    ]) {
      expect(localizeError(new RequestError('English safe message', code), 'zh-CN')).not.toContain(
        'English safe message'
      );
    }
  });
  it('handles unknown codes and non-request errors without displaying unexpected internals', () => {
    for (const code of ['NEW_CODE', 'toString', '__proto__'])
      expect(localizeError(new RequestError('Safe English fallback', code), 'zh-CN')).toBe(
        '请求失败，请稍后重试。'
      );
    expect(localizeError(new Error('private details'), 'en')).toBe(
      'Something went wrong. Please try again.'
    );
    expect(localizeError(null, 'zh-CN')).toBe('发生错误，请重试。');
  });
});
