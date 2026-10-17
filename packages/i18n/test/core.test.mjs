import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createTranslator, resolveLocale, formatDate, formatNumber } from '../dist/index.js';
test('English default ignores browser locale and unsupported cookie values', () => {
  for (const value of [undefined, null, 'zh', 'zh-TW', 'fr', '<script>'])
    assert.equal(resolveLocale(value), 'en');
  assert.equal(resolveLocale('zh-CN'), 'zh-CN');
});
test('typed catalogs, explicit locale, English fallback and named values', () => {
  const en = { title: 'Invoice {number}', empty: 'English fallback', zero: '{amount}' };
  const zh = { title: '发票 {number}', empty: '', zero: '{amount}' };
  assert.equal(createTranslator(en, zh, 'en')('title', { number: 'A-01' }), 'Invoice A-01');
  const t = createTranslator(en, zh, 'zh-CN');
  assert.equal(t('title', { number: 'A-01' }), '发票 A-01');
  assert.equal(t('empty'), 'English fallback');
  assert.equal(t('zero', { amount: 0 }), '0');
  assert.equal(t('title'), '发票 {number}');
});
test('render plain text without interpreting interpolation as HTML', () => {
  assert.equal(
    createTranslator(
      { message: '{value}' },
      { message: '{value}' },
      'en'
    )('message', { value: '<script>' }),
    '<script>'
  );
});
test('date and number formatting handles locale and invalid values', () => {
  assert.equal(formatDate('not a date', 'en'), '—');
  assert.equal(formatNumber(NaN, 'zh-CN'), '—');
  assert.match(formatDate('2026-10-17T12:00:00Z', 'zh-CN'), /2026/);
  assert.match(formatNumber(1234.5, 'en'), /1,234.5/);
});
