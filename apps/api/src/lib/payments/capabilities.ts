/** Commercial approval, provider integration and order accounting are separate gates. */
export const paymentMethods = [
  'card',
  'paypal',
  'apple_pay',
  'google_pay',
  'wechat_pay',
  'alipay'
] as const;
export type PaymentMethod = (typeof paymentMethods)[number];
export type PaymentReadiness = {
  providerApproved: boolean;
  credentialsConfigured: boolean;
  providerSandboxVerified: boolean;
  orderLedgerVerified: boolean;
  platformSettlementApproved: boolean;
  liveAcceptanceVerified: boolean;
  currencies: readonly string[];
  markets: readonly string[];
};
export function paymentCapability(
  method: PaymentMethod,
  readiness: PaymentReadiness | undefined,
  transaction: { currency: string; market: string; multiMerchant: boolean }
) {
  const blockers: string[] = [];
  if (!readiness?.providerApproved) blockers.push('PROVIDER_APPROVAL_REQUIRED');
  if (!readiness?.credentialsConfigured) blockers.push('CREDENTIALS_REQUIRED');
  if (!readiness?.providerSandboxVerified) blockers.push('PROVIDER_SANDBOX_NOT_VERIFIED');
  if (!readiness?.orderLedgerVerified) blockers.push('ORDER_LEDGER_NOT_VERIFIED');
  if (transaction.multiMerchant && !readiness?.platformSettlementApproved)
    blockers.push('PLATFORM_SETTLEMENT_APPROVAL_REQUIRED');
  if (!readiness?.liveAcceptanceVerified) blockers.push('LIVE_ACCEPTANCE_NOT_VERIFIED');
  if (!readiness?.currencies.includes(transaction.currency)) blockers.push('CURRENCY_UNSUPPORTED');
  if (!readiness?.markets.includes(transaction.market)) blockers.push('MARKET_UNSUPPORTED');
  return { method, enabled: blockers.length === 0, blockers };
}
