// Sinh Assets/logo.ico từ PNG 512x512 (ICO gói trực tiếp ảnh PNG).
// Dùng: node make-ico.mjs <src.png> <out.ico>
import { readFileSync, writeFileSync } from 'node:fs'

const [src, out] = process.argv.slice(2)
if (!src || !out) {
  console.error('node make-ico.mjs <src.png> <out.ico>')
  process.exit(1)
}

const png = readFileSync(src)

// PNG chuẩn cấu thành ICO: header + 1 entry + dữ liệu
const header = Buffer.alloc(6)
header.writeUInt16LE(0, 0) // reserved
header.writeUInt16LE(1, 2) // type = icon
header.writeUInt16LE(1, 4) // số ảnh

const entry = Buffer.alloc(16)
entry.writeUInt8(0, 0) // width  = 256
entry.writeUInt8(0, 1) // height = 256
entry.writeUInt8(0, 2) // palette
entry.writeUInt8(0, 3) // reserved
entry.writeUInt16LE(1, 4) // planes
entry.writeUInt16LE(32, 6) // bitcount
entry.writeUInt32LE(png.length, 8) // size PNG
entry.writeUInt32LE(22, 12) // offset (6 + 16)

writeFileSync(out, Buffer.concat([header, entry, png]))
console.log(`Created ${out} (${22 + png.length} bytes from ${src})`)
