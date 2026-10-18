import { RequestError } from './api';
const messages: Record<string, string> = {
  UNAUTHENTICATED: 'Please sign in to continue.',
  UNAUTHORIZED: 'Please sign in to continue.',
  FORBIDDEN: 'You do not have permission for this action.',
  INVALID_CREDENTIALS: 'Email or password is incorrect.',
  INVALID_INPUT: 'Check the information you entered.',
  INVALID_REQUEST: 'Check the information you entered.',
  BAD_REQUEST: 'Check the information you entered.',
  CONFLICT: 'This record already exists.',
  NOT_FOUND: 'The requested record was not found.',
  RATE_LIMITED: 'Too many requests. Please try again later.',
  CSRF_REJECTED: 'Refresh the page and try again.',
  NETWORK_ERROR: 'Unable to reach the server. Please try again.',
  REQUEST_FAILED: 'The request failed.',
  ORDER_FAILED: 'The request failed.',
  INTERNAL_ERROR: 'Something went wrong. Please try again.',
  NO_STOCK: 'Some items ran out of stock. Review your cart below.'
};
// The shop receives only its selected dictionary from the server. Do not import the
// legacy workspace catalogs here: that duplicates their data in account/order chunks.
export function localizeShopError(
  error: unknown,
  t: (key: string, values?: Record<string, string | number>) => string
) {
  if (!(error instanceof RequestError)) return t('Something went wrong. Please try again.');
  const key = Object.hasOwn(messages, error.code) ? messages[error.code]! : 'The request failed.';
  return t(key) + (error.requestId ? ' · ' + t('Request {id}', { id: error.requestId }) : '');
}
