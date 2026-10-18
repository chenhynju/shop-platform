'use client';
import { useState } from 'react';

export function ProductMedia({
  name,
  scene = false,
  priority = false
}: {
  name: string;
  scene?: boolean;
  priority?: boolean;
}) {
  const [failed, setFailed] = useState(false);
  const tile = scene
    ? 5
    : /keyboard|键盘/i.test(name)
      ? 0
      : /hub|扩展坞/i.test(name)
        ? 1
        : /mug|ceramic|杯/i.test(name)
          ? 2
          : /mouse|鼠标/i.test(name)
            ? 3
            : /mat|垫/i.test(name)
              ? 4
              : null;
  if (tile === null || failed)
    return (
      <div className="product-photo fallback">
        <div role="img" aria-label={`${name} — image unavailable`}>
          <span aria-hidden="true" style={{ fontSize: 48 }}>
            ◇
          </span>
          <p>Product image unavailable</p>
        </div>
      </div>
    );
  return (
    <div className="product-photo" role="img" aria-label={`${name} — AI-generated sample image`}>
      {/* Optimized at build time: one shared 54 KB WebP atlas; no image client runtime. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/images/catalog-atlas-v2.webp"
        alt=""
        width={1080}
        height={720}
        loading={priority ? 'eager' : 'lazy'}
        decoding="async"
        onError={() => setFailed(true)}
        className="product-atlas"
        style={{ left: `${-(tile % 3) * 100}%`, top: `${-Math.floor(tile / 3) * 100}%` }}
      />
    </div>
  );
}
