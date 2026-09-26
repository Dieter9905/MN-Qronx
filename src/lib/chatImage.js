/**
 * Nén ảnh ngay trên máy người dùng trước khi gửi trong hội thoại hỗ trợ.
 *
 * Vì sao cần nén: ảnh được lưu thẳng trong DB (xem SupportAttachment bên backend)
 * và backend chỉ nhận tối đa ~1,4 MB mỗi ảnh. Ảnh chụp màn hình điện thoại thường
 * 2–6 MB, nếu gửi nguyên gốc sẽ bị từ chối hoặc làm phình DB. Canvas thu nhỏ cạnh
 * dài nhất về 1600px và xuất JPEG chất lượng 0.72 → thường còn 150–400 KB mà vẫn
 * đọc rõ chữ trong ảnh chụp màn hình.
 */
const MAX_ORIGINAL_BYTES = 8 * 1024 * 1024
const MAX_DIM = 1600
const QUALITY = 0.72

async function loadBitmap(file) {
  if (typeof createImageBitmap === 'function') {
    try {
      return await createImageBitmap(file)
    } catch {
      /* HEIC hoặc định dạng trình duyệt không hỗ trợ → thử cách dưới */
    }
  }
  return new Promise((resolve, reject) => {
    const img = new Image()
    const url = URL.createObjectURL(file)
    img.onload = () => {
      URL.revokeObjectURL(url)
      resolve(img)
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('Không đọc được ảnh này'))
    }
    img.src = url
  })
}

/**
 * @returns {Promise<{mimeType: string, dataBase64: string, name: string, previewUrl: string, size: number}>}
 */
export async function compressImageFile(file) {
  if (!file) throw new Error('Không đọc được tệp')
  if (!String(file.type).startsWith('image/')) {
    throw new Error('Chỉ gửi được ảnh (JPG, PNG, WEBP…)')
  }
  if (file.size > MAX_ORIGINAL_BYTES) {
    throw new Error('Ảnh gốc quá lớn (tối đa 8 MB)')
  }

  const bitmap = await loadBitmap(file)
  const width = bitmap.width || 1
  const height = bitmap.height || 1
  const scale = Math.min(1, MAX_DIM / Math.max(width, height))
  const outW = Math.max(1, Math.round(width * scale))
  const outH = Math.max(1, Math.round(height * scale))

  const canvas = document.createElement('canvas')
  canvas.width = outW
  canvas.height = outH
  const ctx = canvas.getContext('2d')
  // PNG trong suốt khi chuyển sang JPEG mà không tô nền sẽ thành màu đen
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, outW, outH)
  ctx.drawImage(bitmap, 0, 0, outW, outH)
  if (bitmap.close) bitmap.close()

  const dataUrl = canvas.toDataURL('image/jpeg', QUALITY)
  const dataBase64 = dataUrl.slice(dataUrl.indexOf(',') + 1)

  return {
    mimeType: 'image/jpeg',
    dataBase64,
    name: file.name || 'anh.jpg',
    previewUrl: dataUrl,
    size: Math.round((dataBase64.length * 3) / 4),
  }
}

export function formatBytes(bytes) {
  if (!bytes) return '0 KB'
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}
