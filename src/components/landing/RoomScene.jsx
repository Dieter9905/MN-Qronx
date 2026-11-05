import { useEffect, useRef, useState } from 'react'
import { BellRinging, Clock } from '@phosphor-icons/react'

/**
 * PHÒNG MINI-HOMPY — minh hoạ phòng isometric vẽ tay (không phụ thuộc ảnh).
 * Ngữ pháp: tường giấy hoa + sàn caro, chìt chít nâu ấm, Sticker đồ vật dựng thẳng
 * (đồng hồ, cây, chuông) — đúng chất bức tấm room của Cyworld.
 *
 * Sự sống thật trong phòng:
 *  - đồng hồ treo tường chạy theo giờ thật (product proof),
 *  - món việc đến hạn sáng đèn (blush + quầng nhịp),
 *  - nút "Đặt báo thức" chạy mạch biên đạo: việc sáng đèn → chuông lắc reo → toast.
 */

// Đồng hồ treo tường — giờ thật
function useClock() {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(id)
  }, [])
  return now
}

// ===== Toạ độ phòng: điểm góc sàn & tường =====
// Sàn A(150,468) B(380,350) C(610,468) D(380,586); tường cao 210.
const WALL_H = 210
const A = { x: 150, y: 468 }
const B = { x: 380, y: 350 }
// P(u,h) tường trái: đi từ A về B, h = chiều cao (px):
const wallL = (u, h) => ({ x: 150 + 230 * u, y: 468 - 118 * u - h })
// P(u,h) tường phải: đi từ B về C:
const wallR = (u, h) => ({ x: 380 + 230 * u, y: 350 + 118 * u - h })

// `app` = bản dùng trong /app: cùng căn phòng nhưng của chính người dùng —
// không có nút demo chuông, không có thẻ "(mẫu)" của landing, đồng hồ vẫn chạy.
export default function RoomScene({ t, app = false }) {
  const now = useClock()

  // ----- Mạch demo chuông: idle → lit (việc sáng đèn) → ring (chuông lắc + toast) -----
  const [demo, setDemo] = useState('idle')
  const timersRef = useRef([])
  useEffect(
    () => () => {
      timersRef.current.forEach(clearTimeout)
    },
    []
  )
  const runDemo = () => {
    if (demo !== 'idle') return
    setDemo('lit')
    timersRef.current = [
      setTimeout(() => setDemo('ring'), 500),
      setTimeout(() => setDemo('idle'), 2700),
    ]
  }
  const ringing = demo === 'ring'

  return (
    <div className={`relative mx-auto w-full ${app ? 'max-w-[560px]' : 'max-w-[780px]'}`}>
      {/* Nhãn nhỏ tại góc — bằng chứng sản phẩm: đồng hồ chạy giờ thật */}
      {!app && (
        <span className="absolute right-1 top-1 z-10 flex items-center gap-1.5 rounded-full bg-room-moss/80 px-3 py-1 text-xs font-bold text-room-ink ring-1 ring-room-acorn/25">
          <Clock size={13} weight="bold" /> {t.roomClockCaption}
        </span>
      )}

      {/* Trong /app thu cảnh lại (cắt bớt trần + sàn) để phòng không chiếm hết
          màn hình làm việc; landing vẫn giữ nguyên khung rộng. */}
      <svg viewBox={app ? '0 150 640 440' : '0 115 640 500'} className="h-auto w-full" role="img" aria-hidden="true">
        <defs>
          <radialGradient id="qronx-due-glow">
            <stop offset="0%" stopColor="#F5C9CF" stopOpacity="0.9" />
            <stop offset="60%" stopColor="#F5C9CF" stopOpacity="0.35" />
            <stop offset="100%" stopColor="#F5C9CF" stopOpacity="0" />
          </radialGradient>
          <radialGradient id="qronx-lamp-warm">
            <stop offset="0%" stopColor="#EECB8A" stopOpacity="0.85" />
            <stop offset="55%" stopColor="#EECB8A" stopOpacity="0.3" />
            <stop offset="100%" stopColor="#EECB8A" stopOpacity="0" />
          </radialGradient>
        </defs>

        {/* ================= TƯỜNG ================= */}
        {/* Tường trái — giấy kẻ sọc (các sọc chạy theo mặt phẳng tường) */}
        <polygon
          points={`${A.x},${A.y} ${B.x},${B.y} ${B.x},${B.y - WALL_H} ${A.x},${A.y - WALL_H}`}
          fill="rgb(var(--room-moss))"
        />
        {[1, 3, 5, 7, 9].map((i) => {
          const u1 = i / 10
          const u2 = u1 + 0.03
          const p1 = wallL(u1, 0)
          const p2 = wallL(u2, 0)
          return (
            <polygon
              key={`stripe-${i}`}
              points={`${p1.x},${p1.y} ${p1.x},${p1.y - WALL_H} ${p2.x},${p2.y - WALL_H} ${p2.x},${p2.y}`}
              fill="rgb(var(--room-acorn) / 0.07)"
            />
          )
        })}

        {/* Tường trái — giấy hoa: hoa nhỏ nhụi chuông (tránh vùng cửa sổ và dây chít chít) */}
        {(() => {
          const spots = [
            [0.1, 26], [0.34, 26], [0.6, 26], [0.84, 26],
            [0.08, 96], [0.8, 96], [0.9, 96],
            [0.1, 160], [0.8, 160],
            [0.05, 186], [0.65, 192], [0.94, 186],
          ]
          const flowers = []
          spots.forEach(([u, h], i) => {
            const p = wallL(u, h)
            const s = i % 3 === 1 ? 0.86 : 1
            for (let k = 0; k < 5; k++) {
              const ang = (k * 72 * Math.PI) / 180
              flowers.push(
                <circle
                  key={`fl-${i}-${k}`}
                  cx={p.x + Math.cos(ang) * 4.2 * s}
                  cy={p.y + Math.sin(ang) * 4.2 * s}
                  r={3 * s}
                  fill="rgb(var(--room-paper) / 0.8)"
                />
              )
            }
            flowers.push(
              <circle key={`flc-${i}`} cx={p.x} cy={p.y} r={1.9 * s} fill="rgb(var(--room-bell))" />
            )
          })
          return flowers
        })()}

        {/* Tường phải — giấy hoa: nhánh hoa 4 cánh mảnh theo nhịp tường */}
        <polygon
          points={`${B.x},${B.y} ${(wallR(1, 0)).x},${(wallR(1, 0)).y} ${(wallR(1, WALL_H)).x},${(wallR(1, WALL_H)).y} ${B.x},${B.y - WALL_H}`}
          fill="rgb(var(--room-sage))"
        />
        {[60, 110, 160].map((h, r) =>
          [.14, .32, .5, .68, .86].map((u0, c) => {
            const u = u0 + (r % 2 ? 0.09 : 0)
            if (u > 0.95) return null
            const p = wallR(u, h)
            return (
              <g key={`hb-${r}-${c}`}>
                {[0, 90, 180, 270].map((ang) => {
                  const rad = (ang * Math.PI) / 180
                  return (
                    <circle
                      key={ang}
                      cx={p.x + Math.cos(rad) * 2.6}
                      cy={p.y + Math.sin(rad) * 2.6}
                      r="1.9"
                      fill="rgb(var(--room-paper) / 0.65)"
                    />
                  )
                })}
                <circle cx={p.x} cy={p.y} r="1.2" fill="rgb(var(--room-acorn) / 0.5)" />
              </g>
            )
          })
        )}

        {/* Băng gạch đáy tường — viền mảnh chạy hai tường */}
        <path
          d={`M ${A.x} ${A.y} L ${B.x} ${B.y} L ${(wallR(1, 0)).x} ${(wallR(1, 0)).y}`}
          fill="none"
          stroke="rgb(var(--room-acorn) / 0.85)"
          strokeWidth="2.5"
          strokeLinecap="round"
        />
        {/* Mép tường: cột dọc hai biên + đường nóc tường */}
        <path
          d={`M ${A.x} ${A.y} L ${A.x} ${A.y - WALL_H} L ${B.x} ${B.y - WALL_H} L ${(wallR(1, WALL_H)).x} ${(wallR(1, WALL_H)).y} L ${(wallR(1, 0)).x} ${(wallR(1, 0)).y}`}
          fill="none"
          stroke="rgb(var(--room-acorn) / 0.6)"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Khung cửa sổ vòm (tường trái) — theo mặt phẳng tường */}
        {/* Khung viền cửa sổ */}
        <path
          d="M 212 288 L 212 391 L 318 341 L 318 233 Q 265 190 212 288 Z"
          fill="rgb(var(--room-oat))"
          stroke="rgb(var(--room-acorn) / 0.7)"
          strokeWidth="2"
          strokeLinejoin="round"
        />
        <path
          d="M 222 289 L 222 379 L 309 336 L 309 240 Q 265 205 222 289 Z"
          fill="rgb(var(--room-sky))"
        />
        {/* Nan chia */}
        <path d="M 265 230 L 265 358" stroke="rgb(var(--room-oat))" strokeWidth="3" />
        <path d="M 224 333 L 306 292" stroke="rgb(var(--room-oat))" strokeWidth="3" />
        {/* Mặt trời (ngày) / Sao + trăng (tối) — sticker dựng thẳng trước mặt kính */}
        <g className="room-only-light">
          <circle cx="287" cy="256" r="10" fill="rgb(var(--room-bell))" stroke="rgb(var(--room-acorn) / 0.55)" strokeWidth="1.5" />
          {[0, 45, 90, 135, 180, 225, 270, 315].map((ang) => {
            const rad = (ang * Math.PI) / 180
            const x1 = 287 + Math.cos(rad) * 14
            const y1 = 256 + Math.sin(rad) * 14
            const x2 = 287 + Math.cos(rad) * 19
            const y2 = 256 + Math.sin(rad) * 19
            return <path key={`ray-${ang}`} d={`M ${x1} ${y1} L ${x2} ${y2}`} stroke="rgb(var(--room-bell) / 0.8)" strokeWidth="2.5" strokeLinecap="round" />
          })}
          {/* Mây trắng vu vơ */}
          <g fill="rgb(var(--room-paper))" opacity="0.9">
            <circle cx="243" cy="262" r="8" />
            <circle cx="233" cy="266" r="6" />
            <circle cx="251" cy="267" r="6" />
          </g>
        </g>
        <g className="room-only-dark">
          <circle cx="287" cy="256" r="10" fill="rgb(var(--room-oat))" />
          <circle cx="291" cy="252" r="8.5" fill="rgb(var(--room-sky))" />
          <circle cx="240" cy="270" r="1.8" fill="rgb(var(--room-oat))" opacity="0.9" />
          <circle cx="232" cy="252" r="1.4" fill="rgb(var(--room-oat))" opacity="0.7" />
          <circle cx="251" cy="242" r="1.4" fill="rgb(var(--room-oat))" opacity="0.7" />
        </g>

        {/* ===== Cờ xé treo garland trên tường trái ===== */}
        <path d="M 168 264 L 293 200" stroke="rgb(var(--room-acorn) / 0.8)" strokeWidth="1.6" />
        {[0.15, 0.325, 0.5, 0.675, 0.85].map((tt, i) => {
          const x = 168 + 125 * tt
          const y = 264 - 64 * tt
          const color = ['var(--room-sage)', 'var(--room-blush)', 'var(--room-paper)', 'var(--room-rain)', 'var(--room-blush)'][i]
          return (
            <polygon
              key={`flag-${i}`}
              points={`${x - 6},${y} ${x + 6},${y} ${x},${y + 15}`}
              fill={`rgb(${color})`}
            />
          )
        })}

        {/* ===== Đồng hồ treo tường (tường phải) — sticker tròn, giờ thật ===== */}
        <circle cx="495" cy="300" r="45" fill="rgb(var(--room-paper))" stroke="rgb(var(--room-acorn) / 0.85)" strokeWidth="2" />
        <circle cx="495" cy="300" r="37" fill="none" stroke="rgb(var(--room-acorn) / 0.25)" strokeWidth="1.5" />
        {[0, 90, 180, 270].map((ang) => {
          const rad = (ang * Math.PI) / 180
          const x1 = 495 + Math.sin(rad) * 32
          const y1 = 300 - Math.cos(rad) * 32
          const x2 = 495 + Math.sin(rad) * 26
          const y2 = 300 - Math.cos(rad) * 26
          return <path key={`tick-${ang}`} d={`M ${x1} ${y1} L ${x2} ${y2}`} stroke="rgb(var(--room-acorn))" strokeWidth="3" strokeLinecap="round" />
        })}
        {[30, 60, 120, 150, 210, 240, 300, 330].map((ang) => {
          const rad = (ang * Math.PI) / 180
          return <circle key={`tk-${ang}`} cx={495 + Math.sin(rad) * 30} cy={300 - Math.cos(rad) * 30} r="1.6" fill="rgb(var(--room-acorn) / 0.55)" />
        })}
        {(() => {
          const h = now.getHours() % 12
          const m = now.getMinutes()
          const s = now.getSeconds()
          const hourA = h * 30 + m * 0.5
          const minA = m * 6 + s * 0.1
          const secA = s * 6
          const pt = (a, len) => {
            const rad = (a * Math.PI) / 180
            return { x: 495 + Math.sin(rad) * len, y: 300 - Math.cos(rad) * len }
          }
          const pH = pt(hourA, 15)
          const pM = pt(minA, 25)
          const pS = pt(secA, 27)
          const tail = pt(secA + 180, 7)
          return (
            <g>
              <path d={`M 495 300 L ${pH.x} ${pH.y}`} stroke="rgb(var(--room-ink))" strokeWidth="3.6" strokeLinecap="round" />
              <path d={`M 495 300 L ${pM.x} ${pM.y}`} stroke="rgb(var(--room-ink))" strokeWidth="2.8" strokeLinecap="round" />
              <path d={`M ${tail.x} ${tail.y} L ${pS.x} ${pS.y}`} stroke="rgb(var(--room-acorn) / 0.9)" strokeWidth="1.6" strokeLinecap="round" />
              <circle cx="495" cy="300" r="3.4" fill="rgb(var(--room-acorn))" />
            </g>
          )
        })()}
        {/* móc treo + đinh */}
        <path d="M 495 255 L 495 249" stroke="rgb(var(--room-acorn))" strokeWidth="2.5" strokeLinecap="round" />

        {/* ================= SÀN CARO ================= */}
        {(() => {
          // P(u,v) = A + u·AB + v·AD, thảm 4×4
          const P = (u, v) => ({ x: 150 + 230 * u + 230 * v, y: 468 - 118 * u + 118 * v })
          const tiles = []
          for (let i = 0; i < 4; i++)
            for (let j = 0; j < 4; j++) {
              const p1 = P(i / 4, j / 4)
              const p2 = P((i + 1) / 4, j / 4)
              const p3 = P((i + 1) / 4, (j + 1) / 4)
              const p4 = P(i / 4, (j + 1) / 4)
              tiles.push(
                <polygon
                  key={`tile-${i}-${j}`}
                  points={`${p1.x},${p1.y} ${p2.x},${p2.y} ${p3.x},${p3.y} ${p4.x},${p4.y}`}
                  fill={(i + j) % 2 === 0 ? 'rgb(var(--room-oat))' : 'rgb(var(--room-sage) / 0.5)'}
                />
              )
            }
          return <g>{tiles}</g>
        })()}
        {/* Viền thảm phía trước sàn */}
        <path
          d="M 150 468 L 380 586 L 610 468"
          fill="none"
          stroke="rgb(var(--room-acorn) / 0.85)"
          strokeWidth="2.5"
          strokeLinecap="round"
        />

        {/* Thảm tròn dưới ghế (hình tròn áp tròn - chất minihompy) */}
        <g transform="rotate(-27.14 250 470)">
          <ellipse cx="250" cy="470" rx="88" ry="42" fill="rgb(var(--room-rain) / 0.35)" />
          <ellipse cx="250" cy="470" rx="74" ry="34" fill="none" stroke="rgb(var(--room-paper) / 0.75)" strokeWidth="2.5" strokeDasharray="5 7" />
        </g>

        {/* ================= ĐỒ VẬT ================= */}

        {/* Ánh đèn ấm (chỉ buổi tối) */}
        <circle cx="174" cy="392" r="58" fill="url(#qronx-lamp-warm)" className="lamp-glow" />
        {/* Đèn cây */}
        <path d="M 160 462 L 188 462" stroke="rgb(var(--room-acorn) / 0.3)" strokeWidth="6" strokeLinecap="round" />
        <ellipse cx="174" cy="464" rx="16" ry="6" fill="rgb(var(--room-acorn) / 0.75)" />
        <path d="M 173 400 L 174 458" stroke="rgb(var(--room-acorn) / 0.8)" strokeWidth="3" strokeLinecap="round" />
        <polygon points="156,384 192,384 198,404 150,404" fill="rgb(var(--room-oat))" stroke="rgb(var(--room-acorn) / 0.75)" strokeWidth="2" strokeLinejoin="round" />
        <circle cx="174" cy="380" r="4" fill="rgb(var(--room-bell))" stroke="rgb(var(--room-acorn) / 0.6)" strokeWidth="1.5" />

        {/* Ghế bành + gối tựa */}
        <rect x="172" y="366" width="76" height="58" rx="16" fill="rgb(var(--room-moss))" stroke="rgb(var(--room-acorn) / 0.8)" strokeWidth="2" />
        <rect x="160" y="402" width="22" height="50" rx="10" fill="rgb(var(--room-acorn))" />
        <rect x="262" y="358" width="22" height="50" rx="10" fill="rgb(var(--room-acorn))" />
        <g transform="rotate(-14 205 402)">
          <rect x="188" y="384" width="30" height="24" rx="8" fill="rgb(var(--room-blush))" stroke="rgb(var(--room-acorn) / 0.55)" strokeWidth="1.6" />
        </g>
        <polygon points="172,436 258,390 300,413 214,459" fill="rgb(var(--room-moss))" stroke="rgb(var(--room-acorn) / 0.8)" strokeWidth="2" strokeLinejoin="round" />

        {/* Cây xanh góc trái */}
        <ellipse cx="231" cy="516" rx="24" ry="8" fill="rgb(var(--room-acorn) / 0.15)" />
        <path d="M 218 478 L 246 478 L 242 511 L 224 511 Z" fill="rgb(var(--room-acorn))" stroke="rgb(var(--room-acorn) / 0.9)" strokeWidth="2" strokeLinejoin="round" />
        <rect x="213" y="470" width="38" height="10" rx="4" fill="rgb(var(--room-acorn))" stroke="rgb(var(--room-acorn) / 0.9)" strokeWidth="1.6" />
        <g stroke="rgb(var(--room-acorn) / 0.75)" strokeWidth="1.8" fill="rgb(var(--room-moss))">
          <ellipse cx="219" cy="442" rx="7" ry="17" transform="rotate(-22 219 442)" />
          <ellipse cx="231" cy="432" rx="7.5" ry="18" />
          <ellipse cx="243" cy="441" rx="7" ry="16.5" transform="rotate(20 243 441)" />
          <ellipse cx="226" cy="453" rx="5.5" ry="12" transform="rotate(-8 226 453)" />
          <ellipse cx="237" cy="452" rx="5.5" ry="11.5" transform="rotate(10 237 452)" />
        </g>

        {/* ===== BÀN HỌC ===== */}
        {/* chân bàn */}
        <rect x="368" y="474" width="9" height="36" rx="4" fill="rgb(var(--room-acorn))" />
        <rect x="440" y="514" width="9" height="32" rx="4" fill="rgb(var(--room-acorn))" />
        <rect x="584" y="437" width="8" height="28" rx="4" fill="rgb(var(--room-acorn))" />
        {/* mặt bàn + mặt nghiêng */}
        <polygon points="368,452 512,378 592,419 448,493" fill="rgb(var(--room-oat))" stroke="rgb(var(--room-acorn) / 0.85)" strokeWidth="2" strokeLinejoin="round" />
        <polygon points="368,452 448,493 448,519 368,478" fill="rgb(var(--room-acorn) / 0.45)" />
        <polygon points="448,493 592,419 592,445 448,519" fill="rgb(var(--room-acorn) / 0.6)" />

        {/* Món việc 1 — ĐẾN HẠN (sáng đèn, quầng blush nhịp nhàng) */}
        <g className={demo !== 'idle' ? 'opacity-100' : ''}>
          <circle cx="406" cy="424" r="40" fill="url(#qronx-due-glow)" className="room-due-glow" />
        </g>
        <ellipse cx="406" cy="462" rx="30" ry="10" fill="rgb(var(--room-acorn) / 0.18)" />
        <rect x="380" y="392" width="52" height="66" rx="9" fill="rgb(var(--room-blush))" stroke="rgb(var(--room-acorn) / 0.9)" strokeWidth="2" />
        <rect x="392" y="387" width="28" height="11" rx="4" fill="rgb(var(--room-paper) / 0.85)" stroke="rgb(var(--room-acorn) / 0.4)" strokeWidth="1.4" />
        <rect x="389" y="416" width="34" height="4.5" rx="2.2" fill="rgb(var(--room-acorn) / 0.4)" />
        <rect x="389" y="429" width="24" height="4.5" rx="2.2" fill="rgb(var(--room-acorn) / 0.4)" />
        {/* đinh ghim */}
        <circle cx="406" cy="398" r="3.4" fill="rgb(var(--room-paper))" stroke="rgb(var(--room-acorn) / 0.8)" strokeWidth="1.6" />

        {/* Món việc 2 — sắp tới */}
        <ellipse cx="477" cy="450" rx="27" ry="9" fill="rgb(var(--room-acorn) / 0.15)" />
        <rect x="452" y="380" width="50" height="64" rx="9" fill="rgb(var(--room-paper))" stroke="rgb(var(--room-acorn) / 0.85)" strokeWidth="2" />
        <rect x="463" y="375" width="26" height="10" rx="4" fill="rgb(var(--room-oat))" stroke="rgb(var(--room-acorn) / 0.4)" strokeWidth="1.4" />
        <rect x="461" y="403" width="32" height="4.5" rx="2.2" fill="rgb(var(--room-acorn) / 0.35)" />
        <rect x="461" y="416" width="22" height="4.5" rx="2.2" fill="rgb(var(--room-acorn) / 0.35)" />
        <circle cx="477" cy="386" r="3.2" fill="rgb(var(--room-paper))" stroke="rgb(var(--room-acorn) / 0.8)" strokeWidth="1.6" />

        {/* Món việc 3 — đã hoàn thành (dấu tích) */}
        <ellipse cx="535" cy="425" rx="24" ry="8" fill="rgb(var(--room-acorn) / 0.15)" />
        <g transform="rotate(2 535 386)">
          <rect x="512" y="360" width="46" height="58" rx="9" fill="rgb(var(--room-paper))" stroke="rgb(var(--room-acorn) / 0.85)" strokeWidth="2" />
          <circle cx="535" cy="384" r="9" fill="rgb(var(--room-sage))" stroke="rgb(var(--room-acorn) / 0.7)" strokeWidth="1.8" />
          <path d="M 530.5 384.5 L 534 388.5 L 540 380.5" stroke="rgb(var(--room-ink))" strokeWidth="2.4" fill="none" strokeLinecap="round" strokeLinejoin="round" />
          <rect x="521" y="403" width="28" height="4" rx="2" fill="rgb(var(--room-acorn) / 0.35)" />
        </g>

        {/* Chuông để bàn (khoảnh khắc: đổ chuông khi việc đến hạn) */}
        <ellipse cx="374" cy="452" rx="28" ry="9" fill="rgb(var(--room-acorn) / 0.18)" />
        <g
          style={{ transformBox: 'fill-box', transformOrigin: '50% 95%' }}
          className={ringing ? 'animate-alarm-bell' : undefined}
        >
          <rect x="348" y="438" width="52" height="9" rx="4.5" fill="rgb(var(--room-bell))" stroke="rgb(var(--room-acorn) / 0.9)" strokeWidth="2" />
          <path d="M 356 438 A 18 18 0 0 1 392 438 Z" fill="rgb(var(--room-bell))" stroke="rgb(var(--room-acorn) / 0.9)" strokeWidth="2" strokeLinejoin="round" />
          <circle cx="374" cy="417" r="4.5" fill="rgb(var(--room-bell))" stroke="rgb(var(--room-acorn) / 0.9)" strokeWidth="2" />
          {ringing ? (
            <>
              <path d="M 344 424 L 338 419" stroke="rgb(var(--room-acorn) / 0.85)" strokeWidth="2.2" strokeLinecap="round" />
              <path d="M 404 424 L 410 419" stroke="rgb(var(--room-acorn) / 0.85)" strokeWidth="2.2" strokeLinecap="round" />
              <path d="M 348 433 L 341 433" stroke="rgb(var(--room-acorn) / 0.7)" strokeWidth="2" strokeLinecap="round" />
              <path d="M 400 433 L 407 433" stroke="rgb(var(--room-acorn) / 0.7)" strokeWidth="2" strokeLinecap="round" />
            </>
          ) : null}
        </g>
      </svg>

      {/* ===== Thẻ việc nổi — hành động demo có nhãn ẩn (mẫu) ===== */}
      {!app && (
      <div className="absolute bottom-[-5%] left-[8%] w-48 -rotate-2 rounded-2xl bg-room-paper p-3 ring-1 ring-room-acorn/35 shadow-[0_14px_30px_-18px_rgb(0_0_0/0.25)] sm:w-56">
        {ringing ? (
          <p className="animate-pop-in absolute -top-11 right-0 whitespace-nowrap rounded-full bg-room-ink px-3 py-1.5 text-xs font-bold text-room-paper shadow-[0_10px_24px_-12px_rgb(0_0_0/0.4)]">
            {t.roomToast}
          </p>
        ) : null}
        <div className="flex items-center gap-2">
          <span className="on-blush rounded-full bg-room-blush px-2 py-0.5 text-[11px] font-black leading-[1.35] tracking-[0.1em]">
            {t.roomChip}
          </span>
          <span className="flex items-center gap-1 text-[11px] font-bold text-room-ink/70">
            <Clock size={12} weight="bold" /> {t.alarmTime}
          </span>
        </div>
        <p className="mt-1.5 font-display text-sm font-bold leading-snug text-room-ink">{t.alarmTask}</p>
        <button
          type="button"
          onClick={runDemo}
          disabled={demo !== 'idle'}
          className="mt-2.5 flex w-full items-center justify-center gap-2 rounded-full bg-room-acorn px-3 py-2 font-display text-sm font-bold text-room-paper transition hover:bg-room-acorn/90 disabled:opacity-70"
        >
          <BellRinging size={15} weight="bold" /> {t.roomSetAlarm}
        </button>
      </div>
      )}
    </div>
  )
}
