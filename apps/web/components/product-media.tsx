import Image from 'next/image';
import { ProductArt } from './product-art';

export function ProductMedia({
  name,
  scene = false,
  priority = false
}: {
  name: string;
  scene?: boolean;
  priority?: boolean;
}) {
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
  if (tile === null)
    return (
      <div className="product-photo fallback">
        <ProductArt name={name} />
      </div>
    );
  return (
    <div className="product-photo" role="img" aria-label={`${name} — AI-generated sample image`}>
      <Image
        src="/images/catalog-atlas-v2.png"
        alt=""
        width={1536}
        height={1024}
        sizes="1080px"
        priority={priority}
        className="product-atlas"
        style={{ left: `${-(tile % 3) * 100}%`, top: `${-Math.floor(tile / 3) * 100}%` }}
      />
    </div>
  );
}
