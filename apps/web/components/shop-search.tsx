'use client';
import { useRouter, useSearchParams } from 'next/navigation';
import type { FormEvent } from 'react';

export function ShopSearch() {
  const router = useRouter();
  const params = useSearchParams();
  function search(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const query = String(data.get('q') ?? '').trim();
    router.push('/shop' + (query ? '?q=' + encodeURIComponent(query) : ''));
  }
  return (
    <form className="market-search" role="search" action="/shop" onSubmit={search}>
      <label className="sr-only" htmlFor="market-search">
        Search products
      </label>
      <input
        key={params.get('q') ?? ''}
        id="market-search"
        type="search"
        name="q"
        defaultValue={params.get('q') ?? ''}
        placeholder="What are you looking for today?"
      />
      <button type="submit" aria-label="Search">
        ⌕
      </button>
    </form>
  );
}
