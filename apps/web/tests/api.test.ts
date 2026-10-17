import { afterEach, describe, expect, it, vi } from 'vitest';
import { api, RequestError } from '../lib/api';
afterEach(() => vi.unstubAllGlobals());
describe('API adapter', () => {
  it('sends same-origin credentials, CSRF header and no-store', async () => {
    const mock = vi
      .fn()
      .mockResolvedValue(new Response(JSON.stringify({ data: [] }), { status: 200 }));
    vi.stubGlobal('fetch', mock);
    expect(await api('/projects')).toEqual({ data: [] });
    expect(mock).toHaveBeenCalledWith(
      '/api/projects',
      expect.objectContaining({
        credentials: 'same-origin',
        cache: 'no-store',
        headers: expect.objectContaining({ 'X-CSRF-Protection': '1' })
      })
    );
  });
  it('sets JSON content type only when a body exists', async () => {
    const mock = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
    vi.stubGlobal('fetch', mock);
    await api('/auth/logout', { method: 'POST' });
    expect(mock.mock.calls[0]![1].headers).not.toHaveProperty('Content-Type');
    await api('/projects/example', { method: 'DELETE' });
    expect(mock.mock.calls[1]![1].headers).not.toHaveProperty('Content-Type');
    await api('/projects', { method: 'POST', body: JSON.stringify({ title: 'Example' }) });
    expect(mock.mock.calls[2]![1].headers).toHaveProperty('Content-Type', 'application/json');
  });
  it('handles 204 and network failures', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, { status: 204 })));
    expect(await api('/auth/logout', { method: 'POST' })).toBeUndefined();
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network')));
    await expect(api('/projects')).rejects.toMatchObject({ code: 'NETWORK_ERROR' });
  });
  it('keeps safe server errors and request IDs', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            error: { message: 'Please sign in', code: 'UNAUTHENTICATED', requestId: 'test-id' }
          }),
          { status: 401 }
        )
      )
    );
    await expect(api('/projects')).rejects.toMatchObject({
      message: 'Please sign in',
      code: 'UNAUTHENTICATED',
      requestId: 'test-id'
    });
  });
  it('handles non-JSON and empty errors without leaking HTML', async () => {
    for (const body of ['<html>internal proxy details</html>', '{}']) {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(body, { status: 502 })));
      await expect(api('/projects')).rejects.toBeInstanceOf(RequestError);
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(body, { status: 502 })));
      await expect(api('/projects')).rejects.toMatchObject({
        message: 'The request failed.',
        code: 'REQUEST_FAILED'
      });
    }
  });
});
