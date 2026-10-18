import { describe, expect, it, vi } from 'vitest';
import {
  paymentCapability,
  paymentMethods,
  type PaymentReadiness
} from '../src/lib/payments/capabilities';
import { PayPalSandbox } from '../src/lib/payments/paypal-sandbox';

const config = {
  clientId: 'test-client',
  clientSecret: 'fixture-not-a-real-secret',
  merchantId: 'TEST-MERCHANT',
  webhookId: 'TEST-WEBHOOK',
  returnUrl: 'https://shop.example.test/payment-return',
  cancelUrl: 'https://shop.example.test/payment-cancel'
};
const expected = { purchaseId: 'PURCHASE-1', amountMinor: 12345, currency: 'USD' as const };
const shipping = {
  name: { full_name: 'Fixture Buyer' },
  address: {
    address_line_1: '123 Test Street',
    admin_area_2: 'Test City',
    admin_area_1: 'CA',
    postal_code: '90001',
    country_code: 'US' as const
  }
};
const order = (value = '123.45', currency = 'USD') => ({
  id: 'PROVIDER-ORDER',
  status: 'CREATED',
  purchase_units: [
    {
      reference_id: expected.purchaseId,
      custom_id: expected.purchaseId,
      payee: { merchant_id: config.merchantId },
      amount: { currency_code: currency, value }
    }
  ],
  links: [
    { rel: 'approve', href: 'https://www.sandbox.paypal.com/checkoutnow?token=PROVIDER-ORDER' }
  ]
});
function transport(...responses: (unknown | Response)[]) {
  return vi.fn<typeof fetch>().mockImplementation(async () => {
    const response = responses.shift();
    if (response === undefined) throw new Error('Unexpected network request');
    return response instanceof Response
      ? response
      : new Response(JSON.stringify(response), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        });
  });
}
const token = { access_token: 'test-token', expires_in: 300 };

describe('payment channel gates', () => {
  it('all requested methods remain disabled without commercial and operational evidence', () => {
    for (const method of paymentMethods) {
      const result = paymentCapability(method, undefined, {
        currency: 'USD',
        market: 'US',
        multiMerchant: true
      });
      expect(result.enabled).toBe(false);
      expect(result.blockers).toContain('PLATFORM_SETTLEMENT_APPROVAL_REQUIRED');
      expect(result.blockers).toContain('ORDER_LEDGER_NOT_VERIFIED');
    }
  });
  it('never treats a normal merchant approval as multi-merchant settlement approval', () => {
    const ready: PaymentReadiness = {
      providerApproved: true,
      credentialsConfigured: true,
      providerSandboxVerified: true,
      orderLedgerVerified: true,
      platformSettlementApproved: false,
      liveAcceptanceVerified: true,
      currencies: ['USD'],
      markets: ['US']
    };
    expect(
      paymentCapability('paypal', ready, { currency: 'USD', market: 'US', multiMerchant: false })
        .enabled
    ).toBe(true);
    expect(
      paymentCapability('paypal', ready, { currency: 'USD', market: 'US', multiMerchant: true })
        .enabled
    ).toBe(false);
    expect(
      paymentCapability('paypal', ready, { currency: 'CNY', market: 'CA', multiMerchant: false })
        .blockers
    ).toEqual(['CURRENCY_UNSUPPORTED', 'MARKET_UNSUPPORTED']);
  });
});
describe('PayPal sandbox protocol (mock HTTP transport, not provider sandbox acceptance)', () => {
  it('uses OAuth, a stable idempotency key, server amount, merchant and approved sandbox origin', async () => {
    const http = transport(token, order(), order());
    const client = new PayPalSandbox(config, http);
    const result = await client.create({ ...expected, requestId: 'create-purchase-1', shipping });
    expect(result.providerOrderId).toBe('PROVIDER-ORDER');
    await client.query(result.providerOrderId, expected);
    expect(http).toHaveBeenCalledTimes(3);
    expect(
      http.mock.calls.every(([url]) => String(url).startsWith('https://api-m.sandbox.paypal.com/'))
    ).toBe(true);
    const request = http.mock.calls[1]![1]!;
    expect(request.redirect).toBe('error');
    expect(request.headers).toMatchObject({ 'PayPal-Request-Id': 'create-purchase-1' });
    const body = JSON.parse(request.body as string);
    expect(body.purchase_units[0].amount).toEqual({ currency_code: 'USD', value: '123.45' });
    expect(body.purchase_units[0].payee.merchant_id).toBe(config.merchantId);
    expect(body.purchase_units[0].shipping).toEqual(shipping);
  });
  it.each([
    ['0.01', 'USD'],
    ['123.45', 'CAD']
  ])('rejects response amount/currency mismatch %s %s', async (value, currency) => {
    const client = new PayPalSandbox(config, transport(token, order(value, currency)));
    await expect(
      client.create({ ...expected, requestId: 'create-1', shipping })
    ).rejects.toMatchObject({ code: 'PAYPAL_AMOUNT_MISMATCH' });
  });
  it('rejects foreign merchant, purchase and malicious approval URLs', async () => {
    for (const mutate of [
      (x: ReturnType<typeof order>) => {
        x.purchase_units[0]!.payee.merchant_id = 'OTHER';
      },
      (x: ReturnType<typeof order>) => {
        x.purchase_units[0]!.reference_id = 'OTHER';
      },
      (x: ReturnType<typeof order>) => {
        x.links[0]!.href = 'https://www.sandbox.paypal.com.attacker.example/';
      }
    ]) {
      const response = order();
      mutate(response);
      const client = new PayPalSandbox(config, transport(token, response));
      await expect(
        client.create({ ...expected, requestId: 'create-1', shipping })
      ).rejects.toThrow();
    }
  });
  it('refuses unsupported currency, nonpositive money and invalid keys before any HTTP call', async () => {
    const http = transport();
    const client = new PayPalSandbox(config, http);
    await expect(
      client.create({ ...expected, currency: 'CNY' as 'USD', requestId: 'create-1', shipping })
    ).rejects.toThrow();
    await expect(
      client.capture('PROVIDER-ORDER', { ...expected, amountMinor: 0 }, 'capture-1')
    ).rejects.toThrow();
    await expect(client.capture('../other', expected, 'capture-1')).rejects.toThrow();
    expect(http).not.toHaveBeenCalled();
  });
  it('requires completed capture, exact amount and the same order before exposing settlement evidence', async () => {
    const completed = {
      ...order(),
      status: 'COMPLETED',
      purchase_units: [
        {
          ...order().purchase_units[0]!,
          payments: {
            captures: [
              {
                id: 'CAPTURE-1',
                status: 'COMPLETED',
                amount: { currency_code: 'USD', value: '123.45' }
              }
            ]
          }
        }
      ]
    };
    const client = new PayPalSandbox(config, transport(token, completed));
    expect(await client.capture('PROVIDER-ORDER', expected, 'capture-1')).toMatchObject({
      captureId: 'CAPTURE-1',
      amountMinor: 12345
    });
    const pending = structuredClone(completed);
    pending.purchase_units[0]!.payments.captures[0]!.status = 'PENDING';
    await expect(
      new PayPalSandbox(config, transport(token, pending)).capture(
        'PROVIDER-ORDER',
        expected,
        'capture-1'
      )
    ).rejects.toMatchObject({ code: 'PAYPAL_CAPTURE_NOT_COMPLETED' });
    const wrong = structuredClone(completed);
    wrong.purchase_units[0]!.payments.captures[0]!.amount.value = '1.00';
    await expect(
      new PayPalSandbox(config, transport(token, wrong)).capture(
        'PROVIDER-ORDER',
        expected,
        'capture-1'
      )
    ).rejects.toMatchObject({ code: 'PAYPAL_AMOUNT_MISMATCH' });
  });
  it('keeps refunds pending until the provider completes them and checks refund amounts', async () => {
    const http = transport(token, {
      id: 'REFUND-1',
      status: 'PENDING',
      amount: { currency_code: 'USD', value: '23.45' }
    });
    expect(
      await new PayPalSandbox(config, http).refund(
        'CAPTURE-1',
        { amountMinor: 2345, currency: 'USD' },
        'refund-1'
      )
    ).toEqual({ refundId: 'REFUND-1', status: 'PENDING' });
    expect(JSON.parse(http.mock.calls[1]![1]!.body as string).amount.value).toBe('23.45');
    await expect(
      new PayPalSandbox(
        config,
        transport(token, {
          id: 'REFUND-1',
          status: 'COMPLETED',
          amount: { currency_code: 'CAD', value: '23.45' }
        })
      ).refund('CAPTURE-1', { amountMinor: 2345, currency: 'USD' }, 'refund-1')
    ).rejects.toMatchObject({ code: 'PAYPAL_AMOUNT_MISMATCH' });
  });
  it('verifies signatures through the fixed provider endpoint, rejects missing headers and hostile certificate URLs', async () => {
    const headers = {
      'paypal-auth-algo': 'SHA256withRSA',
      'paypal-cert-url': 'https://api.sandbox.paypal.com/v1/notifications/certs/TEST',
      'paypal-transmission-id': 'DELIVERY-1',
      'paypal-transmission-sig': 'fixture-signature',
      'paypal-transmission-time': '2026-10-18T00:00:00Z'
    };
    const event = { id: 'EVENT-1', event_type: 'PAYMENT.CAPTURE.COMPLETED' };
    const http = transport(
      token,
      { verification_status: 'SUCCESS' },
      { verification_status: 'FAILURE' }
    );
    const client = new PayPalSandbox(config, http);
    expect(await client.verifyWebhook({}, event)).toBe(false);
    expect(
      await client.verifyWebhook(
        { ...headers, 'paypal-cert-url': 'http://127.0.0.1/internal' },
        event
      )
    ).toBe(false);
    expect(await client.verifyWebhook({ ...headers, 'paypal-cert-url': 'not-a-url' }, event)).toBe(
      false
    );
    expect(http).not.toHaveBeenCalled();
    expect(await client.verifyWebhook(headers, event)).toBe(true);
    expect(await client.verifyWebhook(headers, event)).toBe(false);
    expect(JSON.parse(http.mock.calls[1]![1]!.body as string)).toMatchObject({
      webhook_id: config.webhookId,
      webhook_event: event
    });
  });
  it('fails closed on configuration, authorization and malformed provider responses without leaking secrets', async () => {
    expect(() => new PayPalSandbox({ ...config, clientSecret: '' })).toThrow(
      'PAYPAL_CONFIGURATION_REQUIRED'
    );
    expect(
      () => new PayPalSandbox({ ...config, cancelUrl: 'https://other.example.test/cancel' })
    ).toThrow('INVALID_RETURN_ORIGIN');
    await expect(
      new PayPalSandbox(
        config,
        transport(new Response('secret-provider-detail', { status: 401 }))
      ).query('ORDER-1', expected)
    ).rejects.toMatchObject({ message: 'PAYPAL_AUTH_FAILED' });
    await expect(
      new PayPalSandbox(config, transport(new Response('bad-json', { status: 200 }))).query(
        'ORDER-1',
        expected
      )
    ).rejects.toMatchObject({ code: 'PAYPAL_INVALID_RESPONSE' });
  });
});
