/**
 * Xem trạng thái tài khoản Mailjet + hạn mức gửi còn lại trong ngày.
 *
 * Dùng: npm run mail:status
 *
 * Script chỉ ĐỌC, trừ 1 lần gọi Send API ở chế độ SandboxMode — Mailjet kiểm tra
 * key + sender + payload nhưng KHÔNG gửi thật và không tính vào hạn mức ngày:
 *   1. Cấu hình đang dùng (API/SMTP, địa chỉ From, hạn mức ngày)
 *   2. Tên miền gửi (SPF/DKIM) và các address sender có đang Active/OK không
 *   3. Số thư đã gửi hôm nay / hạn mức (mặc định 10 — giai đoạn duyệt tạm)
 *
 * Sau khi Mailjet gỡ giới hạn, đặt MAIL_DAILY_LIMIT=0 để tắt kiểm tra hạn mức.
 */

const { default: config } = await import('../src/config/index.js')
const { getMailStatus } = await import('../src/services/emailService.js')
const { getQuotaStatus } = await import('../src/services/mailQuota.js')

const line = '-'.repeat(60)
const ok = (b) => (b ? '\u2705' : '\u274c')
const fmt = (date) => date.toLocaleString('vi-VN', { timeZone: config.mail.quotaTimezone })

const auth = Buffer.from(`${config.mail.apiKey}:${config.mail.secretKey}`).toString('base64')
const rest = async (path) => {
  const res = await fetch(`${config.mail.restUrl}${path}`, { headers: { Authorization: `Basic ${auth}` } })
  const text = await res.text()
  let data = null
  try {
    data = JSON.parse(text)
  } catch {
    // Mailjet trả HTML khi key sai / bị chặn ở proxy
  }
  return { ok: res.ok, status: res.status, data, text }
}

const status = getMailStatus()
console.log(`TRẠNG THÁI GỬI THƯ MAILJET\n${line}`)
console.log(`  Đường gửi      : ${status.transport}${status.requested === 'auto' ? ' (auto)' : ` (MAIL_TRANSPORT=${status.requested})`}`)
const keyState = status.apiConfigured
  ? 'đã có key + secret'
  : config.mail.apiKey
    ? 'có key nhưng THIẾU secret'
    : 'CHƯA CÓ'
console.log(`  Mailjet API key: ${keyState}`)
console.log(`  SMTP           : ${status.smtpConfigured ? `${config.smtp.host}:${config.smtp.port}` : 'CHƯA CÓ'}`)
console.log(`  From           : ${status.from}`)
const limitText = (n, unit) => (n > 0 ? `${n} thư/${unit}` : `không kiểm soát ${unit}`)
console.log(`  Hạn mức gửi    : ${limitText(status.hourlyLimit, 'giờ')} · ${limitText(status.dailyLimit, 'ngày')}`)
console.log(`  Múi giờ chia hạn mức: ${status.quotaTimezone}`)

if (!status.apiConfigured && !status.smtpConfigured) {
  const hasKeyOnly = Boolean(config.mail.apiKey) && !config.mail.secretKey
  console.log(`\n\u274c Chưa cấu hình gửi thư${hasKeyOnly ? ' — đã có API key nhưng THIẾU Secret Key' : ''}.`)
  console.log('   Mở backend/.env và điền:')
  if (hasKeyOnly) {
    console.log('   MAILJET_SECRET_KEY=...  (app.mailjet.com \u2192 API Keys \u2192 bấm con mắt ở cột Secret Key)')
  } else {
    console.log('   MAILJET_API_KEY=...     (app.mailjet.com \u2192 Account settings \u2192 API keys)')
    console.log('   MAILJET_SECRET_KEY=...')
  }
  console.log('   EMAIL_FROM=MN-Qronx <no-reply@mn-qronx.id.vn>')
  process.exit(1)
}

// ─── 1. Tên miền gửi + sender ──────────────────────────────────────────
if (status.apiConfigured) {
  console.log(`\nTÊN MIỀN GỬI THƯ\n${line}`)
  const domains = await rest('/dns?Limit=100')
  if (!domains.ok) {
    console.log(`  \u26a0\ufe0f  Không đọc được danh sách tên miền (HTTP ${domains.status})`)
  } else if (!domains.data?.Data?.length) {
    console.log('  \u274c Tài khoản chưa có tên miền gửi thư nào')
  } else {
    for (const d of domains.data.Data) {
      console.log(`  ${ok(d.SPFStatus === 'OK' && d.DKIMStatus === 'OK')} ${d.Domain} — SPF=${d.SPFStatus || '?'} | DKIM=${d.DKIMStatus || '?'}`)
    }
  }

  console.log('\nĐỊA CHỈ GỬI (SENDER)')
  const senders = await rest('/sender?Limit=100')
  if (!senders.ok) {
    console.log(`  \u26a0\ufe0f  Không đọc được danh sách sender (HTTP ${senders.status})`)
  } else if (!senders.data?.Data?.length) {
    console.log('  \u274c Chưa có sender nào — thêm no-reply@mn-qronx.id.vn trong Mailjet.')
  } else {
    for (const s of senders.data.Data) {
      console.log(`  ${ok(s.Status === 'Active')} ${s.Email} — ${s.Status}`)
    }
  }
}

// ─── 2. Hạn mức gửi ────────────────────────────────────────────────────
console.log(`\nHẠN MỨC GỬI\n${line}`)
const quota = await getQuotaStatus()
for (const w of quota.windows) {
  const src = w.countedFrom === 'mailjet' ? 'thống kê Mailjet' : 'đếm cục bộ'
  if (!w.enforced) {
    console.log(`  Theo ${w.label.padEnd(6)}: tắt kiểm tra`)
    continue
  }
  console.log(`  Theo ${w.label.padEnd(6)}: đã gửi ${w.sent}/${w.limit} thư — còn ${w.remaining} (${src})`)
  if (w.error) console.log(`           \u2139\ufe0f  ${w.error}`)
}
if (quota.binding) {
  console.log(`  Siết nhất      : ${quota.binding.label} — làm mới lúc ${fmt(quota.binding.resetAt)} (${quota.timezone})`)
}

// ─── 3. Gửi thử sandbox (không gửi thật, không tính hạn mức) ───────────
console.log(`\nGỬI THỬ SANDBOX (không gửi thật)\n${line}`)
let sandboxOk = false
if (!status.apiConfigured) {
  console.log('  (bỏ qua — chưa có API key)')
} else if (status.transport === 'smtp') {
  console.log('  (bỏ qua — MAIL_TRANSPORT=smtp, dùng `npm run mail:send -- <email> --sandbox`)')
} else {
  try {
    const res = await fetch(config.mail.apiUrl, {
      method: 'POST',
      headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        SandboxMode: true,
        Messages: [
          {
            From: { Email: 'no-reply@mn-qronx.id.vn', Name: 'MN-Qronx' },
            To: [{ Email: 'kiem-tra@example.com' }],
            Subject: 'Kiểm tra cấu hình Mailjet',
            TextPart: 'Sandbox check',
          },
        ],
      }),
    })
    const raw = await res.text()
    if (res.ok) {
      const result = JSON.parse(raw)?.Messages?.[0]
      sandboxOk = result?.Status === 'success'
      console.log(`  ${ok(sandboxOk)} Mailjet nhận payload — Status=${result?.Status || '?'}`)
      if (!sandboxOk) console.log(`     ${JSON.stringify(result?.Errors || result).slice(0, 300)}`)
    } else {
      let data = null
      try {
        data = JSON.parse(raw)
      } catch {
        /* ignore */
      }
      console.log(`  \u274c Mailjet từ chối — HTTP ${res.status}${data?.ErrorCode ? ` \u00b7 ${data.ErrorCode}` : ''}`)
      console.log(`     ${data?.ErrorMessage || raw.slice(0, 200)}`)
      if (data?.ErrorCode === 'mj-0001') {
        console.log('     \u2192 Tài khoản vẫn bị khoá ở tầng tài khoản: cần trả lời ticket hỗ trợ.')
      }
    }
  } catch (err) {
    console.log(`  \u274c Không gọi được Mailjet API: ${err.message}`)
  }
}

// ─── Kết luận ──────────────────────────────────────────────────────────
console.log(`\n${line}`)
if (sandboxOk && (!quota.enforced || quota.remaining > 0)) {
  console.log(`\u2705 Có thể gửi thư ngay${quota.enforced ? ` — còn ${quota.remaining} thư (hạn mức ${quota.binding.label}).` : '.'}`)
  if (quota.enforced && quota.remaining <= 2) {
    console.log('   \u26a0\ufe0f  Sắp hết hạn mức — cân nhắc xin Mailjet gỡ giới hạn (xem docs/email-domain-setup.md).')
  }
} else if (sandboxOk && quota.remaining === 0) {
  console.log(`\u26a0\ufe0f  Đã dùng hết ${quota.limit} thư/${quota.binding.label} — chờ hạn mức làm mới (${fmt(quota.binding.resetAt)}) hoặc xin Mailjet gỡ giới hạn.`)
} else {
  console.log('\u274c Chưa gửi được — xem các dòng \u274c ở trên.')
}
console.log()

if (!sandboxOk) process.exitCode = 1
else if (quota.enforced && quota.remaining === 0) process.exitCode = 2
