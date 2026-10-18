import { createTranslator, type Locale } from '@toolkit/i18n';
import { RequestError } from './api';
import { chinese, english, type MessageKey } from './messages';
const codes: Record<string, MessageKey> = {
  NO_STOCK: 'Check the information you entered.',
  BAD_REQUEST: 'Check the information you entered.',
  UNAUTHORIZED: 'Please sign in to continue.',
  ORDER_FAILED: 'The request failed.',
  UNAUTHENTICATED: 'Please sign in to continue.',
  FORBIDDEN: 'You do not have permission for this action.',
  INVALID_CREDENTIALS: 'Email or password is incorrect.',
  INVALID_INPUT: 'Check the information you entered.',
  INVALID_REQUEST: 'Check the information you entered.',
  CONFLICT: 'This record already exists.',
  NOT_FOUND: 'The requested record was not found.',
  RATE_LIMITED: 'Too many requests. Please try again later.',
  CSRF_REJECTED: 'Refresh the page and try again.',
  NETWORK_ERROR: 'Unable to reach the server. Please try again.',
  REQUEST_FAILED: 'The request failed.',
  INTERNAL_ERROR: 'Something went wrong. Please try again.'
};
export function localizeError(
  error: unknown,
  locale: Locale,
  shopTranslate?: (key: string, values?: Record<string, string | number>) => string
): string {
  const t = shopTranslate ?? createTranslator(english, chinese, locale);
  if (error instanceof RequestError) {
    const key = Object.hasOwn(codes, error.code) ? codes[error.code]! : 'The request failed.';
    const message = shopTranslate ? t(key) : locale === 'en' ? error.message : t(key);
    return message + (error.requestId ? ' · ' + t('Request {id}', { id: error.requestId }) : '');
  }
  return t('Something went wrong. Please try again.');
}
