'use client';
import { useCallback, useEffect, useState } from 'react';
import type { ApiResponse, User } from '@repo/types';
import { api } from '@/lib/api';

type ShopAuthState =
  { status: 'checking' } | { status: 'guest' } | { status: 'authed'; user: User };

export function useShopAuth() {
  const [state, setState] = useState<ShopAuthState>({ status: 'checking' });
  const refresh = useCallback(() => {
    return api<ApiResponse<User>>('/auth/me')
      .then((result) => setState({ status: 'authed', user: result.data }))
      .catch(() => setState({ status: 'guest' }));
  }, []);
  useEffect(() => {
    void refresh();
  }, [refresh]);
  return { state, refresh };
}
