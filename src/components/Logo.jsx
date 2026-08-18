// Logo MN-Qronx theo brand guideline: "MN-" navy, "Q" là đồng hồ + dấu tích,
// "ronx" gradient xanh → tím. Tagline: PLAN · DO · ON TIME

export function LogoMark({ size = 40, withRing = false }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      role="img"
      aria-label="Logo MN-Qronx"
      className={withRing ? 'rounded-[30%] shadow-glow-blue' : undefined}
    >
      <defs>
        <linearGradient id="mnq-mark-g" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#2563EB" />
          <stop offset="0.55" stopColor="#06B6D4" />
          <stop offset="1" stopColor="#8B5CF6" />
        </linearGradient>
      </defs>
      <rect x="2" y="2" width="60" height="60" rx="16" fill="url(#mnq-mark-g)" />
      <circle cx="32" cy="32" r="20" fill="none" stroke="#fff" strokeWidth="5" />
      <path d="M32 18v14l10 6" fill="none" stroke="#fff" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
      <path
        d="M44 38c2.5 2.5 4 6 4 10l-3 3-2.6-4.4"
        fill="none"
        stroke="#fff"
        strokeWidth="4.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export function Logo({ size = 36, tagline = false, dark = false, className = '' }) {
  return (
    <span className={`inline-flex items-center gap-2.5 select-none ${className}`}>
      <LogoMark size={size} />
      <span className="flex flex-col leading-none">
        <span
          className="font-extrabold tracking-tight"
          style={{ fontSize: size * 0.52 }}
          aria-label="MN-Qronx"
        >
          <span className={dark ? 'text-white' : 'text-navy-900'}>MN-</span>
          <span className="text-brand-blue">Q</span>
          <span className="bg-brand-gradient bg-clip-text text-transparent">ronx</span>
        </span>
        {tagline && (
          <span
            className={`mt-1 font-semibold tracking-[0.18em] uppercase ${
              dark ? 'text-navy-100/80' : 'text-navy-400'
            }`}
            style={{ fontSize: Math.max(8, size * 0.18) }}
          >
            Plan · Do · On Time
          </span>
        )}
      </span>
    </span>
  )
}

// Biến thể chỉ text (cho footer/trang đậm)
export function LogoText({ dark = false, className = '' }) {
  return (
    <span className={`font-extrabold tracking-tight text-lg ${className}`}>
      <span className={dark ? 'text-white' : 'text-navy-900'}>MN-</span>
      <span className="text-brand-blue">Q</span>
      <span className="bg-brand-gradient bg-clip-text text-transparent">ronx</span>
    </span>
  )
}
