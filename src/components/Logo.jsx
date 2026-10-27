// Logo MN-Qronx — ikon "Q đồng hồ" gradient neon (assets/brand/logo-512.png,
// sinh lại qua scripts/gen-brand-icons.py). Dùng mọi nơi: header, landing,
// login, sidebar…

export function LogoMark({ size = 40, withRing = false }) {
  return (
    <img
      src="/icons/icon-512.png"
      width={size}
      height={size}
      role="img"
      alt="Logo MN-Qronx"
      draggable={false}
      className={`shrink-0 ${withRing ? 'rounded-[30%] shadow-glow-blue' : ''}`}
    />
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
          <span className={dark ? 'text-white' : 'text-navy-900 dark:text-white'}>MN-</span>
          <span className="text-brand-blue">Q</span>
          <span className="bg-brand-gradient bg-clip-text text-transparent">ronx</span>
        </span>
        {tagline && (
          <span
            className={`mt-1 font-semibold tracking-[0.18em] uppercase ${
              dark ? 'text-navy-100/80' : 'text-navy-400 dark:text-slate-400'
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
