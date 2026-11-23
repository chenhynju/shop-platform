import { z } from 'zod';

// Deliberately sandbox-only until the order ledger and commercial gates are verified.
const endpoint = 'https://api-m.sandbox.paypal.com';
const identifier = z.string().regex(/^[A-Za-z0-9_-]{1,127}$/);
const requestId = z.string().regex(/^[A-Za-z0-9_-]{1,38}$/);
const money = z.object({
  amountMinor: z.number().int().positive().max(100_000_000),
  currency: z.enum(['USD', 'CAD'])
});
const configSchema = z
  .object({
    clientId: z.string().min(1),
    clientSecret: z.string().min(1),
    merchantId: identifier,
    webhookId: identifier,
    returnUrl: z.string().url().startsWith('https://'),
    cancelUrl: z.string().url().startsWith('https://')
  })
  .strict();
type Config = z.infer<typeof configSchema>;
export class PaymentProviderError extends Error {
  constructor(public readonly code: string) {
    super(code);
    this.name = 'PaymentProviderError';
  }
}
const expectedSchema = money.extend({ purchaseId: identifier });
export type PayPalExpectedPayment = z.infer<typeof expectedSchema>;
const createSchema = expectedSchema
  .extend({
    requestId,
    shipping: z
      .object({
        name: z.object({ full_name: z.string().min(1).max(300) }).strict(),
        address: z
          .object({
            address_line_1: z.string().min(1).max(300),
            address_line_2: z.string().max(300).optional(),
            admin_area_2: z.string().min(1).max(120),
            admin_area_1: z.string().min(1).max(120),
            postal_code: z.string().min(1).max(60),
            country_code: z.enum(['US', 'CA'])
          })
          .strict()
      })
      .strict()
  })
  .strict();
const amountSchema = z.object({ currency_code: z.string(), value: z.string() });
const captureSchema = z.object({ id: identifier, status: z.string(), amount: amountSchema });
const orderSchema = z.object({
  id: identifier,
  status: z.string(),
  purchase_units: z
    .array(
      z.object({
        reference_id: z.string(),
        custom_id: z.string().optional(),
        payee: z.object({ merchant_id: z.string() }),
        amount: amountSchema.optional(),
        payments: z.object({ captures: z.array(captureSchema).optional() }).optional()
      })
    )
    .length(1),
  links: z.array(z.object({ rel: z.string(), href: z.string().url() })).optional()
});
export class PayPalSandbox {
  private readonly config: Config;
  private token?: { value: string; expiresAt: number };
  constructor(
    config: Config,
    private readonly transport: typeof fetch = fetch
  ) {
    const parsed = configSchema.safeParse(config);
    if (!parsed.success) throw new PaymentProviderError('PAYPAL_CONFIGURATION_REQUIRED');
    const goodUrl = (value: string) => {
      const url = new URL(value);
      return !url.username && !url.password && !url.hash;
    };
    if (
      !goodUrl(config.returnUrl) ||
      !goodUrl(config.cancelUrl) ||
      new URL(config.returnUrl).origin !== new URL(config.cancelUrl).origin
    )
      throw new PaymentProviderError('INVALID_RETURN_ORIGIN');
    this.config = parsed.data;
  }
  private async exchange(path: string, init: RequestInit): Promise<unknown> {
    let response: Response;
    try {
      response = await this.transport(endpoint + path, {
        ...init,
        redirect: 'error',
        signal: AbortSignal.timeout(10_000)
      });
    } catch {
      throw new PaymentProviderError('PAYPAL_TRANSPORT_FAILED');
    }
    if (!response.ok)
      throw new PaymentProviderError(
        response.status === 401 ? 'PAYPAL_AUTH_FAILED' : 'PAYPAL_REQUEST_FAILED'
      );
    try {
      return await response.json();
    } catch {
      throw new PaymentProviderError('PAYPAL_INVALID_RESPONSE');
    }
  }
  private async accessToken() {
    if (this.token && this.token.expiresAt > Date.now()) return this.token.value;
    const result = await this.exchange('/v1/oauth2/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization:
          'Basic ' +
          Buffer.from(this.config.clientId + ':' + this.config.clientSecret).toString('base64')
      },
      body: 'grant_type=client_credentials'
    });
    const parsed = z
      .object({ access_token: z.string().min(1), expires_in: z.number().positive() })
      .safeParse(result);
    if (!parsed.success) throw new PaymentProviderError('PAYPAL_INVALID_RESPONSE');
    this.token = {
      value: parsed.data.access_token,
      expiresAt: Date.now() + Math.max(0, parsed.data.expires_in - 30) * 1000
    };
    return this.token.value;
  }
  private async request(
    path: string,
    method: 'GET' | 'POST',
    body?: unknown,
    idempotencyKey?: string
  ) {
    if (idempotencyKey) requestId.parse(idempotencyKey);
    return this.exchange(path, {
      method,
      headers: {
        Authorization: 'Bearer ' + (await this.accessToken()),
        'Content-Type': 'application/json',
        Prefer: 'return=representation',
        ...(idempotencyKey ? { 'PayPal-Request-Id': idempotencyKey } : {})
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) })
    });
  }
  private validateOrder(value: unknown, expected: PayPalExpectedPayment) {
    const parsed = orderSchema.safeParse(value);
    if (!parsed.success) throw new PaymentProviderError('PAYPAL_INVALID_RESPONSE');
    const order = parsed.data,
      unit = order.purchase_units[0]!;
    if (
      unit.reference_id !== expected.purchaseId ||
      (unit.custom_id !== undefined && unit.custom_id !== expected.purchaseId) ||
      unit.payee.merchant_id !== this.config.merchantId
    )
      throw new PaymentProviderError('PAYPAL_ORDER_MISMATCH');
    if (
      unit.amount &&
      (unit.amount.currency_code !== expected.currency ||
        unit.amount.value !== (expected.amountMinor / 100).toFixed(2))
    )
      throw new PaymentProviderError('PAYPAL_AMOUNT_MISMATCH');
    return order;
  }
  async create(input: z.infer<typeof createSchema>) {
    const data = createSchema.parse(input);
    const result = this.validateOrder(
      await this.request(
        '/v2/checkout/orders',
        'POST',
        {
          intent: 'CAPTURE',
          purchase_units: [
            {
              reference_id: data.purchaseId,
              custom_id: data.purchaseId,
              amount: { currency_code: data.currency, value: (data.amountMinor / 100).toFixed(2) },
              payee: { merchant_id: this.config.merchantId },
              shipping: data.shipping
            }
          ],
          application_context: {
            return_url: this.config.returnUrl,
            cancel_url: this.config.cancelUrl,
            user_action: 'PAY_NOW',
            shipping_preference: 'SET_PROVIDED_ADDRESS'
          }
        },
        data.requestId
      ),
      data
    );
    if (!result.purchase_units[0]!.amount)
      throw new PaymentProviderError('PAYPAL_INVALID_RESPONSE');
    const link = result.links?.find((l) => l.rel === 'approve' || l.rel === 'payer-action');
    if (!link) throw new PaymentProviderError('PAYPAL_APPROVAL_LINK_MISSING');
    const url = new URL(link.href);
    if (
      url.protocol !== 'https:' ||
      !['www.sandbox.paypal.com', 'sandbox.paypal.com'].includes(url.hostname) ||
      url.username ||
      url.password
    )
      throw new PaymentProviderError('PAYPAL_APPROVAL_ORIGIN_INVALID');
    return { providerOrderId: result.id, approvalUrl: url.href, status: result.status };
  }
  async query(providerOrderId: string, expected: PayPalExpectedPayment) {
    identifier.parse(providerOrderId);
    expectedSchema.parse(expected);
    const order = this.validateOrder(
      await this.request('/v2/checkout/orders/' + providerOrderId, 'GET'),
      expected
    );
    if (order.id !== providerOrderId) throw new PaymentProviderError('PAYPAL_ORDER_MISMATCH');
    return order;
  }
  async capture(providerOrderId: string, expected: PayPalExpectedPayment, idempotencyKey: string) {
    identifier.parse(providerOrderId);
    expectedSchema.parse(expected);
    const order = this.validateOrder(
      await this.request(
        '/v2/checkout/orders/' + providerOrderId + '/capture',
        'POST',
        {},
        idempotencyKey
      ),
      expected
    );
    const captures = order.purchase_units[0]!.payments?.captures;
    if (
      order.id !== providerOrderId ||
      order.status !== 'COMPLETED' ||
      captures?.length !== 1 ||
      captures[0]!.status !== 'COMPLETED'
    )
      throw new PaymentProviderError('PAYPAL_CAPTURE_NOT_COMPLETED');
    const capture = captures[0]!;
    if (
      capture.amount.currency_code !== expected.currency ||
      capture.amount.value !== (expected.amountMinor / 100).toFixed(2)
    )
      throw new PaymentProviderError('PAYPAL_AMOUNT_MISMATCH');
    return {
      providerOrderId: order.id,
      captureId: capture.id,
      amountMinor: expected.amountMinor,
      currency: expected.currency
    };
  }
  async refund(captureId: string, input: z.infer<typeof money>, idempotencyKey: string) {
    identifier.parse(captureId);
    const amount = money.parse(input);
    const result = await this.request(
      '/v2/payments/captures/' + captureId + '/refund',
      'POST',
      { amount: { currency_code: amount.currency, value: (amount.amountMinor / 100).toFixed(2) } },
      idempotencyKey
    );
    const parsed = z
      .object({ id: identifier, status: z.enum(['COMPLETED', 'PENDING']), amount: amountSchema })
      .safeParse(result);
    if (!parsed.success) throw new PaymentProviderError('PAYPAL_INVALID_RESPONSE');
    if (
      parsed.data.amount.currency_code !== amount.currency ||
      parsed.data.amount.value !== (amount.amountMinor / 100).toFixed(2)
    )
      throw new PaymentProviderError('PAYPAL_AMOUNT_MISMATCH');
    return { refundId: parsed.data.id, status: parsed.data.status };
  }
  async verifyWebhook(headers: Record<string, string | undefined>, event: unknown) {
    const required = [
      'paypal-auth-algo',
      'paypal-cert-url',
      'paypal-transmission-id',
      'paypal-transmission-sig',
      'paypal-transmission-time'
    ] as const;
    if (required.some((k) => !headers[k] || headers[k]!.length > 4096)) return false;
    if (!z.object({ id: identifier, event_type: z.string().min(1) }).safeParse(event).success)
      return false;
    let url: URL;
    try {
      url = new URL(headers['paypal-cert-url']!);
    } catch {
      return false;
    }
    if (
      url.protocol !== 'https:' ||
      !['api.sandbox.paypal.com', 'api-m.sandbox.paypal.com'].includes(url.hostname) ||
      url.username ||
      url.password ||
      url.port ||
      !url.pathname.startsWith('/v1/notifications/certs/')
    )
      return false;
    const result = await this.request('/v1/notifications/verify-webhook-signature', 'POST', {
      auth_algo: headers['paypal-auth-algo'],
      cert_url: headers['paypal-cert-url'],
      transmission_id: headers['paypal-transmission-id'],
      transmission_sig: headers['paypal-transmission-sig'],
      transmission_time: headers['paypal-transmission-time'],
      webhook_id: this.config.webhookId,
      webhook_event: event
    });
    return z.object({ verification_status: z.literal('SUCCESS') }).safeParse(result).success;
  }
}
