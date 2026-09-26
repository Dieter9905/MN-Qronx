import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { startServer, stopServer, api, register, login, cleanup, prisma, rawGet } from './setup.js'

async function newUser(prefix) {
  const email = `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}@example.com`
  await register(email, 'Test@1234', 'ICS Test')
  const loginRes = await login(email, 'Test@1234')
  const token = loginRes.data.data.accessToken
  const row = await prisma.user.findUnique({ where: { email }, select: { userId: true } })
  return { email, token, userId: row.userId }
}

async function createTask(token, body) {
  const res = await api('POST', '/tasks', {
    token,
    body: { dueAt: new Date(Date.now() + 3600_000).toISOString(), ...body },
  })
  expect(res.status).toBe(201)
  return res.data.data
}

/** Lấy key từ URL /api/v1/calendar/<key> để gọi feed (app lịch gọi không có token). */
function keyOf(url) {
  return String(url).split('/calendar/')[1]
}

beforeAll(async () => {
  await startServer()
})

afterAll(async () => {
  await cleanup()
  await stopServer()
})

describe('Lịch .ics (xuất một chiều sang Google Calendar/Outlook)', () => {
  it('GET /me/ics tự sinh khoá và trả URL, gọi lại vẫn giữ nguyên khoá cũ', async () => {
    const u = await newUser('ics_url')

    const first = await api('GET', '/me/ics', { token: u.token })
    expect(first.status).toBe(200)
    expect(first.data.data.url).toMatch(/\/calendar\/[A-Za-z0-9_-]{20,}$/)

    const again = await api('GET', '/me/ics', { token: u.token })
    expect(again.data.data.url).toBe(first.data.data.url)
  })

  it('feed trả text/calendar đúng chuẩn RFC 5545: escape, gập dòng, RRULE', async () => {
    const u = await newUser('ics_feed')

    // Ký tự đặc biệt phải được escape theo RFC 5545 (; , \ xuống dòng)
    await createTask(u.token, {
      title: 'Họp nhóm; báo cáo doanh số, tuần 1',
      description: 'Dòng 1\nDòng 2',
      priority: 'HIGH',
    })
    // Việc lặp hằng tuần Thứ 2-4-6 → RRULE BYDAY=MO,WE,SA
    await createTask(u.token, {
      title: 'Việc lặp hằng tuần',
      repeatType: 'WEEKLY',
      repeatDays: [1, 3, 6],
    })
    // Tiêu đề rất dài → phải gập dòng, không dòng nào quá 75 octet (255 ký tự là mức tối đa)
    await createTask(u.token, { title: 'Tiêu đề dài '.repeat(20).trim() })

    const urlRes = await api('GET', '/me/ics', { token: u.token })
    const feed = await rawGet(`/calendar/${keyOf(urlRes.data.data.url)}`)

    expect(feed.status).toBe(200)
    expect(feed.contentType).toContain('text/calendar')
    const text = feed.buffer.toString('utf8')

    expect(text.startsWith('BEGIN:VCALENDAR\r\n')).toBe(true)
    expect(text.trimEnd().endsWith('END:VCALENDAR')).toBe(true)

    // Escape: phẩy/chấm phẩy trong SUMMARY và xuống dòng trong DESCRIPTION
    expect(text).toContain('SUMMARY:Họp nhóm\\; báo cáo doanh số\\, tuần 1')
    expect(text).toContain('DESCRIPTION:Dòng 1\\nDòng 2')

    // Lặp hằng tuần → BYDAY theo ISO 1=Thứ 2 …
    expect(text).toContain('RRULE:FREQ=WEEKLY;BYDAY=MO,WE,SA')

    // Gập dòng RFC 5545 §3.1: mọi dòng (kể cả dòng nối) ≤ 75 octet UTF-8
    const lines = text.split('\r\n')
    for (const line of lines) {
      expect(Buffer.byteLength(line, 'utf8')).toBeLessThanOrEqual(75)
    }
    // 3 việc → 3 VEVENT
    expect(text.match(/BEGIN:VEVENT/g)).toHaveLength(3)
  })

  it('khoá sai trả 404, đuôi .ics vẫn đọc được, không token vẫn lấy feed', async () => {
    const u = await newUser('ics_key')
    await createTask(u.token, { title: 'Việc của tôi' })

    const bad = await rawGet('/calendar/khoa-sai-het-ban-oi')
    expect(bad.status).toBe(404)

    const urlRes = await api('GET', '/me/ics', { token: u.token })
    const key = keyOf(urlRes.data.data.url)

    // Một số app lịch tự thêm đuôi .ics vào URL
    const withSuffix = await rawGet(`/calendar/${key}.ics`)
    expect(withSuffix.status).toBe(200)
    expect(withSuffix.contentType).toContain('text/calendar')

    // Việc của người khác không lọt vào feed
    const other = await newUser('ics_victim')
    await createTask(other.token, { title: 'Việc bí mật của người khác' })
    const mine = await rawGet(`/calendar/${key}`)
    expect(mine.buffer.toString('utf8')).toContain('Việc của tôi')
    expect(mine.buffer.toString('utf8')).not.toContain('bí mật')
  })

  it('xoá mềm (thùng rác) thì việc biến mất khỏi feed', async () => {
    const u = await newUser('ics_trash')
    const task = await createTask(u.token, { title: 'Sẽ đưa vào thùng rác' })
    const keep = await createTask(u.token, { title: 'Việc còn giữ' })

    const urlRes = await api('GET', '/me/ics', { token: u.token })
    const key = keyOf(urlRes.data.data.url)

    await api('DELETE', `/tasks/${task.id}`, { token: u.token })

    const feed = await rawGet(`/calendar/${key}`)
    const text = feed.buffer.toString('utf8')
    expect(text).not.toContain('thùng rác')
    expect(text).toContain('Việc còn giữ')
    expect(keep.id).toBeTruthy()
  })

  it('xoay khoá: khoá cũ 404 ngay, khoá mới hoạt động', async () => {
    const u = await newUser('ics_rotate')
    await createTask(u.token, { title: 'Việc sau khi xoay khoá' })

    const before = await api('GET', '/me/ics', { token: u.token })
    const oldKey = keyOf(before.data.data.url)

    const rotated = await api('POST', '/me/ics/rotate', { token: u.token })
    expect(rotated.status).toBe(200)
    const newKey = keyOf(rotated.data.data.url)
    expect(newKey).not.toBe(oldKey)

    expect((await rawGet(`/calendar/${oldKey}`)).status).toBe(404)
    const fresh = await rawGet(`/calendar/${newKey}`)
    expect(fresh.status).toBe(200)
    expect(fresh.buffer.toString('utf8')).toContain('sau khi xoay khoá')
  })

  it('/me/ics bắt buộc đăng nhập', async () => {
    const anon = await api('GET', '/me/ics')
    expect(anon.status).toBe(401)
  })
})
