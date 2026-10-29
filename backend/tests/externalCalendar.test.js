import { describe, expect, it } from 'vitest'
import { parseIcs, expandRrule, isAllowedIcsUrl } from '../src/services/externalCalendarService.js'

// ─── Parser ICS — chỉ test logic thuần, không đụng DB/mạng ──────────────

const SAMPLE_ICS = [
  'BEGIN:VCALENDAR',
  'VERSION:2.0',
  'PRODID:-//Google Inc//Google Calendar 70.9054//EN',
  'BEGIN:VEVENT',
  'DTSTART;VALUE=DATE:20261105',
  'DTEND;VALUE=DATE:20261106',
  'DTSTAMP:20261028T000000Z',
  'UID:abc123@google.com',
  'CREATED:20261021T091211Z',
  'SUMMARY:Sinh nhật Mai',
  'END:VEVENT',
  'BEGIN:VEVENT',
  'DTSTART:20261102T090000Z',
  'DTEND:20261102T100000Z',
  'UID:meet456@google.com',
  'SUMMARY:Weekly sync\\, standoff room',
  'STATUS:CONFIRMED',
  'END:VEVENT',
  'BEGIN:VEVENT',
  'DTSTART:20261103T133000Z',
  'UID:cancelled@google.com',
  'SUMMARY:Đã hủy',
  'STATUS:CANCELLED',
  'END:VEVENT',
  'END:VCALENDAR',
].join('\r\n')

describe('parseIcs', () => {
  it('đọc sự kiện cả ngày (VALUE=DATE) đúng hạn allDay', () => {
    const events = parseIcs(SAMPLE_ICS)
    const bday = events.find((e) => e.uid === 'abc123@google.com')
    expect(bday).toBeTruthy()
    expect(bday.allDay).toBe(true)
    // (UTC 00:00 ngày 5/11)
    expect(bday.startsAt.getUTCHours()).toBe(0)
    expect(bday.title).toBe('Sinh nhật Mai')
  })

  it('đọc sự kiện có giờ + gỡ escape \\, trong SUMMARY', () => {
    const events = parseIcs(SAMPLE_ICS)
    const meet = events.find((e) => e.uid === 'meet456@google.com')
    expect(meet.title).toBe('Weekly sync, standoff room')
    expect(meet.allDay).toBe(false)
    expect(meet.endsAt.getTime()).toBeGreaterThan(meet.startsAt.getTime())
  })

  it('bỏ sự kiện STATUS:CANCELLED', () => {
    const events = parseIcs(SAMPLE_ICS)
    expect(events.find((e) => e.uid === 'cancelled@google.com')).toBeUndefined()
  })

  it('nối dòng gấp (folded line) của SUMMARY dài', () => {
    const ics = [
      'BEGIN:VCALENDAR',
      'BEGIN:VEVENT',
      'DTSTART:20261105T080000Z',
      'UID:folded@x',
      'SUMMARY:Họp dài dòng quá nên\\ ICS gấp dòng tiếp bên dưới',
      ' về đây',
      'END:VEVENT',
      'END:VCALENDAR',
    ].join('\r\n')
    const events = parseIcs(ics)
    // chỉ chấp nhận "folded" mảnh: dòng " về đây" bắt đầu bằng dấu cách
    expect(events[0].title).toContain('tiếp bên dưới')
  })
})

describe('expandRrule', () => {
  const base = {
    uid: 'rrule@x',
    title: 'Học',
    startsAt: new Date(Date.UTC(2026, 10, 2)), // thứ Hai 2/11/2026
    endsAt: new Date(Date.UTC(2026, 10, 2, 1)),
    allDay: true,
  }

  it('WEEKLY+BYDAY sinh đủ các ngày trong tuần theo INTERVAL=1', () => {
    const out = expandRrule({ ...base }, 'FREQ=WEEKLY;BYDAY=MO,WE;COUNT=4', null)
    // 1 lần gốc + 3 lần sinh, xen kẽ MO/WE
    expect(out.length).toBe(4)
    expect(out[1].startsAt.getUTCDay()).toBe(3) // thứ Tư
    expect(out[2].startsAt.getUTCDay()).toBe(1) // thứ Hai tuần sau
  })

  it('DAILY INTERVAL=2 tôn trọng UNTIL', () => {
    const out = expandRrule({ ...base, allDay: false }, 'FREQ=DAILY;INTERVAL=2;UNTIL=20261108T000000Z', null)
    expect(out.length).toBe(4) // 2/11, 4, 6, 8
    expect(out[3].startsAt.getUTCDate()).toBe(8)
  })

  it('RRULE dạng lạ giữ nguyên lần đầu, không sinh vô hạn', () => {
    const out = expandRrule({ ...base }, 'FREQ=YEARLY;BYDAY=-1SU;BYMONTH=12', null)
    expect(out.length).toBe(1)
  })
})

describe('isAllowedIcsUrl', () => {
  it('chỉ nhận https của nhà cung cấp quen thuộc', () => {
    expect(isAllowedIcsUrl('https://calendar.google.com/calendar/ical/x/basic.ics')).toBe(true)
    expect(isAllowedIcsUrl('https://outlook.office365.com/owa/calendar/abc/reachcalendar.ics')).toBe(true)
    expect(isAllowedIcsUrl('http://calendar.google.com/calendar/ical/x/basic.ics')).toBe(false) // http
    expect(isAllowedIcsUrl('https://localhost/db-admin.ics')).toBe(false)
    expect(isAllowedIcsUrl('https://192.168.1.1/x.ics')).toBe(false)
    expect(isAllowedIcsUrl('https://evil-attacker.example/orchid')).toBe(false)
    expect(isAllowedIcsUrl('rubbish')).toBe(false)
  })
})
