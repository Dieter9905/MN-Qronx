import config from '../config/index.js'
import prisma from '../config/prisma.js'
import ApiError from '../utils/ApiError.js'
import { sendEmail } from './emailService.js'
import { buildReport } from './reportService.js'
import { buildWeekPlan } from './plannerService.js'
import { isPlanExpired } from '../utils/planLimits.js'

/**
 * Báo cáo tuần qua email (quyền lợi gói Pro).
 *
 * Vì sao có file này: hai tính năng Pro vừa làm (báo cáo năng suất, kế hoạch tuần)
 * chỉ có giá trị nếu khách NHỚ mở app. Thư gửi sáng thứ 2 làm việc đó thay khách:
 * nhắc tuần rồi họ làm được gì (bằng số của chính họ), và tuần này có gì đang chờ.
 * Đây cũng là thứ khiến gói Pro "cảm thấy" được mỗi tuần dù khách không mở web.
 *
 * Ba ràng buộc phải nhớ khi sửa file này:
 *  1. **Hạn mức gửi thư rất chặt.** Tài khoản Mailjet của MN-Qronx đang trong giai
 *     đoạn duyệt tạm: 10 thư/giờ và 10 thư/ngày (xem services/mailQuota.js). Vì vậy
 *     mỗi lượt chỉ gửi một lô nhỏ, gặp lỗi hạn mức là DỪNG ngay và để lượt sau gửi
 *     tiếp — tuyệt đối không thử lại trong vòng lặp, mỗi thư bị từ chối là một tín
 *     hiệu xấu khi Mailjet xét duyệt tài khoản.
 *  2. **Không gửi trùng.** Cột weeklyReportSentAt là chốt chặn: cron chạy mỗi 15
 *     phút và nhịp /health cũng gọi, nên phải chắc mỗi khách đúng một thư mỗi tuần.
 *  3. **Không làm phiền người không muốn.** weeklyReportEnabled = false là im lặng
 *     tuyệt đối; thư nào cũng ghi rõ cách tắt.
 *
 * Nội dung thư dựng từ chính reportService/plannerService của app — cùng một nguồn
 * số liệu với giao diện, nên thư và web không bao giờ nói hai con số khác nhau.
 */

/** Số ngày gộp trong một báo cáo tuần. */
export const WEEKLY_REPORT_DAYS = 7

/** Khoảng cách tối thiểu giữa hai thư cho cùng một người (ngày). */
export const WEEKLY_REPORT_MIN_GAP_DAYS = 6

/** Số thư tối đa mỗi lượt gửi — nhỏ để không đụng trần 10 thư/giờ của Mailjet. */
export const DEFAULT_BATCH = 4

export const WEB_BASE_URL = (process.env.WEB_BASE_URL || 'https://www.mn-qronx.id.vn').replace(/\/+$/, '')

const DAY_MS = 86400000
const TZ = config.mail?.quotaTimezone || 'Asia/Ho_Chi_Minh'

function vietnamDayKey(date) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date)
}

function formatDayKey(key) {
  const [y, m, d] = key.split('-')
  return `${d}/${m}/${y}`
}

/** "Nguyễn Văn An" → "An" — gọi tên thân mật mà không cần cột riêng. */
export function firstName(fullName) {
  const parts = String(fullName || '').trim().split(/\s+/).filter(Boolean)
  return parts.length ? parts[parts.length - 1] : 'bạn'
}

function nf(value) {
  return new Intl.NumberFormat('vi-VN').format(value ?? 0)
}

/**
 * Dựng nội dung thư — hàm thuần, không đụng DB (test được không cần gửi thư thật).
 *
 * @param {object} input
 * @param {{fullName?:string}} input.user
 * @param {object} input.report Kết quả buildReport (7 ngày)
 * @param {object} input.planner Kết quả buildWeekPlan
 * @param {Date}   input.now
 * @returns {{subject:string, text:string, html:string}}
 */
export function buildWeeklyEmail({ user, report, planner, now = new Date() } = {}) {
  const name = firstName(user?.fullName)
  const t = report?.totals || {}
  const range = report?.range || { from: vietnamDayKey(now), to: vietnamDayKey(now) }
  const s = planner?.summary || {}

  const completed = t.completed || 0
  const delta = t.completedDelta || 0
  const links = {
    reports: `${WEB_BASE_URL}/app/reports`,
    planner: `${WEB_BASE_URL}/app/planner`,
    settings: `${WEB_BASE_URL}/app/settings`,
  }

  const subject =
    completed > 0
      ? `Tuần rồi bạn xong ${nf(completed)} việc${t.overdueOpen ? ` · ${nf(t.overdueOpen)} việc đang quá hạn` : ''}`
      : 'Tuần rồi chưa có việc nào được đánh dấu xong'

  // ── Phần 1: tuần rồi làm được gì ──
  const lines = []
  const html = []

  if (completed > 0) {
    const compare =
      delta > 0
        ? `nhiều hơn tuần trước ${nf(delta)} việc`
        : delta < 0
          ? `ít hơn tuần trước ${nf(Math.abs(delta))} việc`
          : 'ngang bằng tuần trước'
    lines.push(`Tuần rồi bạn hoàn thành ${nf(completed)} việc — ${compare}.`)
    lines.push(`Tỉ lệ xong đúng hạn: ${nf(t.onTimeRate)}% (${nf(t.onTime)} đúng hạn, ${nf(t.late)} muộn).`)
    html.push(
      `<p style="margin:0 0 10px"><b>Tuần rồi bạn hoàn thành ${nf(completed)} việc</b> — ${compare}.<br />Tỉ lệ xong đúng hạn: <b>${nf(t.onTimeRate)}%</b> (${nf(t.onTime)} đúng hạn, ${nf(t.late)} muộn).</p>`
    )

    if (t.nagSaved > 0) {
      lines.push(
        `Nhắc dai đã kéo bạn quay lại ${nf(t.nagSaved)} việc đáng lẽ bị bỏ quên (chuông phải kêu lại ${nf(t.nagRepeats)} lần).`
      )
      html.push(
        `<p style="margin:0 0 10px">Nhắc dai đã kéo bạn quay lại <b>${nf(t.nagSaved)} việc</b> đáng lẽ bị bỏ quên (chuông phải kêu lại ${nf(t.nagRepeats)} lần).</p>`
      )
    }
    if (t.streakCurrent > 1) {
      lines.push(`Bạn đang có chuỗi ${nf(t.streakCurrent)} ngày liên tiếp có việc được xong.`)
      html.push(`<p style="margin:0 0 10px">Bạn đang có chuỗi <b>${nf(t.streakCurrent)} ngày</b> liên tiếp có việc được xong.</p>`)
    }
  } else {
    lines.push('Tuần rồi chưa có việc nào được đánh dấu xong.')
    html.push('<p style="margin:0 0 10px">Tuần rồi chưa có việc nào được đánh dấu xong trong MN-Qronx.</p>')
  }

  if (planner?.goldenHour?.hour !== null && planner?.goldenHour?.hour !== undefined && completed > 0) {
    lines.push(`Giờ vàng của bạn: ${planner.goldenHour.hour}h — dành giờ đó cho việc khó nhất.`)
    html.push(`<p style="margin:0 0 10px">Giờ vàng của bạn: <b>${planner.goldenHour.hour}h</b> — dành giờ đó cho việc khó nhất.</p>`)
  }

  // ── Phần 2: tuần này có gì chờ ──
  lines.push('')
  lines.push(`TUẦN NÀY (${formatDayKey(planner?.range?.from || range.from)} → ${formatDayKey(planner?.range?.to || range.to)})`)
  html.push('<h3 style="margin:22px 0 8px;font-size:15px">Tuần này có gì chờ bạn</h3>')

  const openCount = s.openCount || 0
  if (openCount === 0) {
    lines.push('Không có việc nào đang mở. Tuần này bạn rảnh — tạo việc mới nếu cần.')
    html.push('<p style="margin:0 0 10px">Không có việc nào đang mở. Tuần này bạn rảnh.</p>')
  } else {
    const bits = [`${nf(openCount)} việc cần làm`]
    if (s.dueTodayCount) bits.push(`${nf(s.dueTodayCount)} việc đến hạn hôm nay`)
    if (s.overdueCount) bits.push(`${nf(s.overdueCount)} việc đang quá hạn`)
    lines.push(bits.join(' · ') + '.')
    html.push(`<p style="margin:0 0 10px">${bits.join(' · ')}.</p>`)

    if (s.overloaded) {
      const warning = `Tuần này bạn nhận nhiều hơn sức mình: ${nf(openCount)} việc nhưng kế hoạch chỉ đủ chỗ cho ${nf(s.seats)} — giữ nhịp này thì ${nf(s.atRiskCount)} việc sẽ trễ hạn.`
      lines.push(warning)
      lines.push('Hãy dồn sớm, dời hạn, hoặc bỏ bớt việc không thật sự cần làm.')
      html.push(
        `<p style="margin:0 0 10px;padding:10px 12px;background:#fff7ed;border-left:3px solid #f97316"><b>${warning}</b><br />Hãy dồn sớm, dời hạn, hoặc bỏ bớt việc không thật sự cần làm.</p>`
      )
    } else {
      lines.push(`Tuần này vừa sức: còn ${nf(s.seatsLeft)} chỗ trống trong kế hoạch.`)
      html.push(`<p style="margin:0 0 10px">Tuần này vừa sức: còn ${nf(s.seatsLeft)} chỗ trống trong kế hoạch.</p>`)
    }

    // Việc gấp nhất của tuần — để thư có ích ngay cả khi không bấm vào link
    const nextUp = (planner?.days || []).flatMap((d) => d.items.map((i) => ({ ...i, day: d }))).slice(0, 3)
    if (nextUp.length) {
      lines.push('')
      lines.push('Làm trước mấy việc này:')
      html.push('<p style="margin:12px 0 6px"><b>Làm trước mấy việc này:</b></p><ul style="margin:0 0 10px;padding-left:18px">')
      nextUp.forEach((item) => {
        const when = item.day?.isToday ? 'hôm nay' : `ngày ${formatDayKey(item.day?.date || '')}`
        const late = item.overdue ? ` (quá hạn ${nf(item.daysLate)} ngày)` : ''
        lines.push(`- ${item.title} — ${when}${late}`)
        html.push(`<li style="margin-bottom:4px">${item.title} — ${when}${late}</li>`)
      })
      html.push('</ul>')
    }
  }

  // ── Nút bấm + chân thư ──
  const button = (href, label, primary = false) =>
    `<a href="${href}" style="display:inline-block;margin:0 8px 8px 0;padding:11px 18px;border-radius:10px;text-decoration:none;font-weight:bold;font-size:14px;${
      primary ? 'background:#4f46e5;color:#fff' : 'background:#eef2ff;color:#3730a3'
    }">${label}</a>`

  const text = [
    `Chào ${name},`,
    '',
    `Đây là báo cáo tuần MN-Qronx (${formatDayKey(range.from)} → ${formatDayKey(range.to)}).`,
    '',
    ...lines,
    '',
    `Mở báo cáo chi tiết: ${links.reports}`,
    `Xem kế hoạch tuần: ${links.planner}`,
    '',
    `Bạn nhận thư này vì đang dùng gói Pro của MN-Qronx. Muốn tắt? Vào ${links.settings} → mục Thông báo.`,
  ].join('\n')

  const htmlBody = `<!doctype html>
<html lang="vi"><body style="margin:0;background:#f8fafc;font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;color:#0f172a">
  <div style="max-width:560px;margin:0 auto;padding:24px 16px">
    <div style="background:#fff;border-radius:16px;padding:22px 20px;border:1px solid #e2e8f0">
      <p style="margin:0 0 4px;font-size:13px;color:#64748b">Báo cáo tuần MN-Qronx · ${formatDayKey(range.from)} → ${formatDayKey(range.to)}</p>
      <h2 style="margin:0 0 14px;font-size:19px">Chào ${name}, tuần này của bạn đây</h2>
      ${html.join('\n      ')}
      <div style="margin-top:18px">
        ${button(links.reports, 'Mở báo cáo chi tiết', true)}
        ${button(links.planner, 'Xem kế hoạch tuần')}
      </div>
    </div>
    <p style="font-size:12px;color:#64748b;line-height:1.6;margin:14px 4px">
      Bạn nhận thư này vì đang dùng gói <b>Pro</b> của MN-Qronx.
      Muốn tắt? Mở <a href="${links.settings}" style="color:#4f46e5">Cài đặt → Thông báo</a> và tắt “Báo cáo tuần qua email”.
    </p>
  </div>
</body></html>`

  return { subject, text, html: htmlBody }
}

/**
 * Danh sách người nên nhận thư tuần này: đang dùng gói Pro, chưa tắt nhận thư, và
 * chưa được gửi trong tuần này. Sắp theo người lâu chưa nhận nhất để ai cũng tới
 * lượt khi hạn mức gửi thư bị chặn giữa chừng.
 *
 * @param {number[]} [options.userIds] Chỉ lấy đúng những người này (đường gửi tay /
 *        test). Vẫn đi qua CÙNG một bộ điều kiện, nên không có đường nào lách được
 *        luật "mỗi tuần một thư".
 */
export async function collectRecipients({ now = new Date(), limit = DEFAULT_BATCH, userIds } = {}) {
  const cutoff = new Date(now.getTime() - WEEKLY_REPORT_MIN_GAP_DAYS * DAY_MS)
  const rows = await prisma.user.findMany({
    where: {
      plan: 'PRO',
      isActive: true,
      weeklyReportEnabled: true,
      OR: [{ weeklyReportSentAt: null }, { weeklyReportSentAt: { lt: cutoff } }],
      ...(userIds ? { userId: { in: userIds } } : {}),
    },
    select: {
      userId: true,
      fullName: true,
      email: true,
      plan: true,
      planExpiresAt: true,
      weeklyReportSentAt: true,
    },
    orderBy: [{ weeklyReportSentAt: 'asc' }, { userId: 'asc' }],
    take: userIds ? userIds.length : limit,
  })
  // Gói Pro đã hết hạn (chưa kịp hạ trong DB) thì coi như không còn quyền lợi
  return rows.filter((u) => !isPlanExpired(u))
}

/**
 * Gửi báo cáo tuần cho một lô nhỏ người dùng.
 *
 * @param {object} options
 * @param {Date}   options.now
 * @param {number} options.limit Số thư tối đa lượt này
 * @param {Function} options.mailer Hàm gửi thư (mặc định emailService.sendEmail) —
 *        tách ra để test chạy được mà không gửi thư thật cho khách.
 * @param {boolean} options.dryRun Chỉ dựng nội dung, không gửi, không ghi mốc.
 * @param {Array} options.recipients Danh sách người nhận chỉ định — dùng cho test
 *        và cho đường gửi tay, để không phải quét cả bảng người dùng.
 * @returns {Promise<{candidates:number, sent:number, failed:number, quotaReached:boolean, skipped:number}>}
 */
export async function sendWeeklyReports({
  now = new Date(),
  limit = DEFAULT_BATCH,
  mailer = sendEmail,
  dryRun = false,
  recipients: givenRecipients,
} = {}) {
  // Danh sách chỉ định vẫn phải qua đúng bộ điều kiện như đường tự động — đọc lại
  // từ DB để mốc "đã gửi tuần này" vừa ghi có hiệu lực ngay, không gửi trùng.
  const recipients = await collectRecipients({
    now,
    limit: givenRecipients ? givenRecipients.length : limit,
    userIds: givenRecipients ? givenRecipients.map((r) => r.userId) : undefined,
  })
  const result = {
    candidates: recipients.length,
    sent: 0,
    failed: 0,
    skipped: 0,
    quotaReached: false,
  }

  for (const user of recipients) {
    try {
      // Báo cáo và kế hoạch của CHÍNH người này (số liệu thật, không phải mẫu chung)
      const [report, planner] = await Promise.all([
        buildReport(user.userId, { days: WEEKLY_REPORT_DAYS, now }),
        buildWeekPlan(user.userId, { now }),
      ])
      const email = buildWeeklyEmail({ user, report, planner, now })

      if (!dryRun) {
        await mailer({ to: user.email, subject: email.subject, text: email.text, html: email.html })
        await prisma.user.update({
          where: { userId: user.userId },
          data: { weeklyReportSentAt: now },
        })
      }
      result.sent += 1
    } catch (err) {
      // Hết hạn mức gửi thư → DỪNG cả lượt, không thử người tiếp theo: mỗi thư bị
      // Mailjet từ chối là một tín hiệu xấu khi họ xét duyệt tài khoản.
      if (err?.code === 'quota-exceeded' || err?.status === 429) {
        result.quotaReached = true
        result.skipped = recipients.length - result.sent
        console.warn('[WeeklyReport] Đã chạm hạn mức gửi thư, để lượt sau gửi tiếp:', err.message)
        break
      }
      result.failed += 1
      console.error(`[WeeklyReport] Không gửi được cho ${user.email}: ${err.message}`)
    }
  }

  return result
}

/** Bật/tắt nhận báo cáo tuần (khách tự quyết, không hỏi thêm gì). */
export async function setWeeklyReportEnabled(userId, enabled) {
  const user = await prisma.user.findUnique({ where: { userId }, select: { userId: true } })
  if (!user) throw ApiError.notFound('Không tìm thấy người dùng')
  const { weeklyReportEnabled } = await prisma.user.update({
    where: { userId },
    data: { weeklyReportEnabled: !!enabled },
    select: { weeklyReportEnabled: true },
  })
  return { weeklyReportEnabled }
}

export default {
  WEEKLY_REPORT_DAYS,
  WEEKLY_REPORT_MIN_GAP_DAYS,
  DEFAULT_BATCH,
  firstName,
  buildWeeklyEmail,
  collectRecipients,
  sendWeeklyReports,
  setWeeklyReportEnabled,
}
