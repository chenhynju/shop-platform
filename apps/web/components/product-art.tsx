// Original, decorative illustrations for sample products; not product photography.
export function ProductArt({ name, large = false }: { name: string; large?: boolean }) {
  const kind = /keyboard|键盘/i.test(name)
    ? 'keyboard'
    : /mouse|鼠标/i.test(name)
      ? 'mouse'
      : /head|耳机/i.test(name)
        ? 'headphones'
        : /monitor|显示/i.test(name)
          ? 'monitor'
          : 'package';
  return (
    <svg
      className={large ? 'product-art large' : 'product-art'}
      viewBox="0 0 360 260"
      fill="none"
      aria-hidden="true"
    >
      <ellipse cx="180" cy="224" rx="105" ry="14" fill="#172d3b" opacity=".09" />
      {kind === 'keyboard' ? (
        <g transform="translate(42 75) rotate(-8 138 65)">
          <rect width="276" height="130" rx="16" fill="#283e4d" />
          <rect x="10" y="10" width="256" height="107" rx="10" fill="#e5e2d8" />
          {Array.from({ length: 40 }, (_, i) => (
            <rect
              key={i}
              x={20 + (i % 10) * 24}
              y={20 + Math.floor(i / 10) * 22}
              width="19"
              height="16"
              rx="3"
              fill={i === 29 ? '#ed885c' : '#faf8f1'}
            />
          ))}
          <rect x="83" y="108" width="112" height="9" rx="3" fill="#a4a397" />
        </g>
      ) : kind === 'mouse' ? (
        <g transform="rotate(-18 180 130)">
          <path d="M123 119c0-89 114-89 114 0v49c0 71-114 71-114 0z" fill="#d9d4c8" />
          <path d="M180 53v76h-57v-10c0-42 22-66 57-66z" fill="#f5f2e9" />
          <rect x="174" y="76" width="12" height="28" rx="6" fill="#ed885c" />
          <path d="M180 53v20" stroke="#a9a69c" strokeWidth="2" />
        </g>
      ) : kind === 'headphones' ? (
        <g>
          <path d="M99 153v-42a81 81 0 01162 0v42" stroke="#283e4d" strokeWidth="24" />
          <path d="M110 106a70 70 0 01140 0" stroke="#d8d0bf" strokeWidth="12" />
          <rect
            x="85"
            y="117"
            width="44"
            height="85"
            rx="20"
            fill="#ed885c"
            transform="rotate(-9 85 117)"
          />
          <rect
            x="233"
            y="110"
            width="44"
            height="85"
            rx="20"
            fill="#ed885c"
            transform="rotate(9 233 110)"
          />
          <path d="M255 193c0 20-22 25-52 25" stroke="#283e4d" strokeWidth="5" />
        </g>
      ) : kind === 'monitor' ? (
        <g>
          <rect x="48" y="42" width="264" height="159" rx="10" fill="#283e4d" />
          <rect x="58" y="52" width="244" height="137" rx="4" fill="#b7ccc6" />
          <path d="M58 159l73-66 64 52 50-37 57 65v16H58z" fill="#7b9f97" />
          <circle cx="249" cy="88" r="19" fill="#f8dfaa" />
          <path
            d="M172 201v23h-47m55-23v23h55"
            stroke="#283e4d"
            strokeWidth="10"
            strokeLinecap="round"
          />
        </g>
      ) : (
        <g>
          <path d="M102 85l78-36 78 36v105l-78 36-78-36z" fill="#d1b695" />
          <path d="M102 85l78 37 78-37-78-36z" fill="#ead9bf" />
          <path d="M180 122v104l78-36V85z" fill="#b99773" />
          <path d="M145 64l79 38v32l-25 12v-32l-79-38z" fill="#f4eee2" />
          <path d="M119 159l38 18" stroke="#886b51" strokeWidth="5" />
        </g>
      )}
    </svg>
  );
}
