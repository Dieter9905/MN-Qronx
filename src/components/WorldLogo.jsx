import { LogoMark } from './Logo'

// Logo phiên bản thế giới phòng: chữ đặc Baloo 2, KHÔNG màu chuyển dần.
// (Logo.jsx còn giữ bản gradient cho phần app-shell cũ – world logo dùng
// ở landing nav và auth shell, mọi chữ đều token phòng.)
export default function WorldLogo({ size = 34, className = '' }) {
  return (
    <span className={`inline-flex select-none items-center gap-2.5 ${className}`} aria-label="MN-Qronx">
      <LogoMark size={size} />
      <span
        className="font-display leading-none whitespace-nowrap text-room-ink"
        style={{ fontSize: size * 0.6, fontWeight: 700 }}
      >
        MN-<span className="text-room-acorn">Q</span>ronx
      </span>
    </span>
  )
}
