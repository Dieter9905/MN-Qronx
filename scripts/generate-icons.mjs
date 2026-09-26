/**
 * Sinh icon PWA (PNG) mà không cần cài thư viện đồ hoạ.
 *
 * Vẽ một đồng hồ trắng trên nền gradient chàm→tím, xuất 192/512/180px và bản
 * maskable (nền tràn viền, đồng hồ nhỏ lại để lọt vùng an toàn của launcher).
 *
 * Chạy: node scripts/generate-icons.mjs
 */
import zlib from 'node:zlib'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const OUT_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'public', 'icons')

// ─── PNG encoder ────────────────────────────────────────────
const CRC_TABLE = (() => {
  const t = new Int32Array(256)
  for (let n = 0; n < 256; n += 1) {
    let c = n
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    t[n] = c
  }
  return t
})()

function crc32(buf) {
  let c = -1
  for (let i = 0; i < buf.length; i += 1) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8)
  return (c ^ -1) >>> 0
}

function chunk(type, data) {
  const length = Buffer.alloc(4)
  length.writeUInt32BE(data.length, 0)
  const typeBuf = Buffer.from(type, 'ascii')
  const crcBuf = Buffer.alloc(4)
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0)
  return Buffer.concat([length, typeBuf, data, crcBuf])
}

function encodePng(width, height, rgba) {
  const raw = Buffer.alloc(height * (1 + width * 4))
  for (let y = 0; y < height; y += 1) {
    const rowStart = y * (1 + width * 4)
    raw[rowStart] = 0 // filter: None
    rgba.copy(raw, rowStart + 1, y * width * 4, (y + 1) * width * 4)
  }
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(width, 0)
  ihdr.writeUInt32BE(height, 4)
  ihdr[8] = 8 // bit depth
  ihdr[9] = 6 // colour type RGBA
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

// ─── Vẽ ─────────────────────────────────────────────────────
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v))

/** Khoảng cách tới đoạn thẳng — dùng để vẽ kim đồng hồ. */
function distToSegment(px, py, x1, y1, x2, y2) {
  const dx = x2 - x1
  const dy = y2 - y1
  const lenSq = dx * dx + dy * dy || 1
  const t = clamp(((px - x1) * dx + (py - y1) * dy) / lenSq, 0, 1)
  return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy))
}

function drawIcon(size, { fullBleed = false } = {}) {
  const buf = Buffer.alloc(size * size * 4)
  const cx = size / 2
  const cy = size / 2
  const corner = fullBleed ? 0 : size * 0.225
  const radius = size * (fullBleed ? 0.24 : 0.3) // bán kính mặt đồng hồ
  const stroke = size * (fullBleed ? 0.038 : 0.05)

  // Gradient chàm → tím theo đường chéo
  const from = [79, 70, 229] // #4F46E5
  const to = [124, 58, 237] // #7C3AED

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const i = (y * size + x) * 4

      // Nền bo góc (hoặc tràn viền với bản maskable)
      let bgAlpha = 1
      if (corner > 0) {
        const dx = Math.max(Math.abs(x - cx) - (size / 2 - corner), 0)
        const dy = Math.max(Math.abs(y - cy) - (size / 2 - corner), 0)
        const sd = Math.hypot(dx, dy) - corner
        bgAlpha = clamp(0.5 - sd, 0, 1) // anti-alias 1px
      }

      const t = (x + y) / (size * 2)
      const r = Math.round(from[0] + (to[0] - from[0]) * t)
      const g = Math.round(from[1] + (to[1] - from[1]) * t)
      const b = Math.round(from[2] + (to[2] - from[2]) * t)

      // Mặt đồng hồ: vành tròn + 2 kim + chấm giữa
      const dist = Math.hypot(x - cx, y - cy)
      const ring = clamp(stroke / 2 + 0.5 - Math.abs(dist - radius), 0, 1)
      const hand1 = clamp(stroke * 0.45 + 0.5 - distToSegment(x, y, cx, cy, cx, cy - radius * 0.62), 0, 1)
      const hand2 = clamp(stroke * 0.45 + 0.5 - distToSegment(x, y, cx, cy, cx + radius * 0.46, cy + radius * 0.28), 0, 1)
      const dot = clamp(stroke * 0.55 + 0.5 - dist, 0, 1)
      const white = Math.max(ring, hand1, hand2, dot)

      const alpha = bgAlpha * 255
      buf[i] = Math.round(r * (1 - white) + 255 * white)
      buf[i + 1] = Math.round(g * (1 - white) + 255 * white)
      buf[i + 2] = Math.round(b * (1 - white) + 255 * white)
      buf[i + 3] = Math.round(alpha)
    }
  }
  return buf
}

function write(name, size, options) {
  const file = path.join(OUT_DIR, name)
  fs.writeFileSync(file, encodePng(size, size, drawIcon(size, options)))
  const kb = (fs.statSync(file).size / 1024).toFixed(1)
  console.log(`  ${name} — ${size}x${size}, ${kb} KB`)
}

fs.mkdirSync(OUT_DIR, { recursive: true })
console.log('Sinh icon PWA:')
write('icon-192.png', 192)
write('icon-512.png', 512)
write('icon-maskable-512.png', 512, { fullBleed: true })
write('apple-touch-icon.png', 180, { fullBleed: true })
console.log('Xong →', OUT_DIR)
