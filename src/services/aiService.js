/**
 * AI Natural Language Parser for Task Creation
 * Parses natural language input like:
 * - "Gọi điện cho sếp thứ 6 lúc 2h, nhắc trước 30 phút"
 * - "Ôn tập Toán chương 3 ngày mai lúc 19h"
 * - "Weekly meeting with team every Monday at 9am"
 */

const VIETNAMESE_PATTERNS = {
  // Days of week
  days: {
    'thứ 2': 1, 'thứ hai': 1, 'thứ 3': 2, 'thứ ba': 2,
    'thứ 4': 3, 'thứ tư': 3, 'thứ 5': 4, 'thứ năm': 4,
    'thứ 6': 5, 'thứ sáu': 5, 'thứ 7': 6, 'thứ bảy': 6,
    'chủ nhật': 0, 'cn': 0, 'chủ nhat': 0,
  },

  // Relative days
  relativeDays: {
    'hôm nay': 0, 'hom nay': 0, 'nay': 0, 'hn': 0,
    'ngày mai': 1, 'ngay mai': 1, 'mai': 1, 'tmai': 1,
    'ngày kia': 2, 'ngay kia': 2, 'kia': 2,
    'hôm qua': -1, 'hom qua': -1, 'qua': -1,
    'hôm kia': -2, 'hom kia': -2,
  },

  // Time markers
  times: {
    'sáng': 8, 'sang': 8, 'buổi sáng': 8,
    'trưa': 12, 'buổi trưa': 12,
    'chiều': 15, 'buổi chiều': 15,
    'tối': 20, 'toi': 20, 'buổi tối': 20,
    'đêm': 22, 'dem': 22,
  },

  // Priority hints
  priorities: {
    'khẩn cấp': 'URGENT', 'khan cap': 'URGENT', 'urgent': 'URGENT', 'quá重要': 'URGENT',
    'quan trọng': 'HIGH', 'important': 'HIGH', 'high': 'HIGH',
    'trung bình': 'MEDIUM', 'medium': 'MEDIUM',
    'thấp': 'LOW', 'thap': 'LOW', 'low': 'LOW',
  },

  // Category hints
  categories: {
    'học tập': 'Học tập', 'hoc tap': 'Học tập', 'study': 'Học tập', 'ôn tập': 'Học tập',
    'công việc': 'Công việc', 'cong viec': 'Công việc', 'work': 'Công việc',
    'cá nhân': 'Cá nhân', 'ca nhan': 'Cá nhân', 'personal': 'Cá nhân',
    'sức khỏe': 'Sức khỏe', 'suc khoe': 'Sức khỏe', 'health': 'Sức khỏe',
  },

  // Reminder patterns
  reminderPatterns: [
    /nhắc\s*(trước|truoc)?\s*(\d+)\s*(phút|phut|tiếng|gio|hour|minute)/i,
    /remind\s*(\d+)\s*(min|hour|minute)/i,
    /nhac\s*(truoc)?\s*(\d+)\s*(phut|tieng|gio)/i,
  ],

  // Repeat patterns
  repeatPatterns: {
    'hàng ngày': 'DAILY', 'moi ngay': 'DAILY', 'daily': 'DAILY', 'every day': 'DAILY',
    'hàng tuần': 'WEEKLY', 'moi tuan': 'WEEKLY', 'weekly': 'WEEKLY', 'every week': 'WEEKLY',
    'hàng tháng': 'MONTHLY', 'moi thang': 'MONTHLY', 'monthly': 'MONTHLY', 'every month': 'MONTHLY',
  },
};

const ENGLISH_PATTERNS = {
  days: {
    'monday': 1, 'mon': 1, 'tuesday': 2, 'tue': 2,
    'wednesday': 3, 'wed': 3, 'thursday': 4, 'thu': 4,
    'friday': 5, 'fri': 5, 'saturday': 6, 'sat': 6,
    'sunday': 0, 'sun': 0,
  },
  relativeDays: {
    'today': 0, 'tomorrow': 1, 'day after tomorrow': 2,
    'yesterday': -1,
  },
  times: {
    'morning': 8, 'afternoon': 15, 'evening': 20, 'night': 22,
  },
};

function normalizeText(text) {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .trim();
}

function extractTime(text) {
  // Thứ tự quan trọng: pattern "buổi + giờ" (chiều 5h, tối 8h, sáng 7h30)
  // phải được kiểm tra TRƯỚC pattern "giờ + buổi" (5h chiều, 8h tối),
  // nếu không "chiều 5h" sẽ bị hiểu thành 5h SÁNG (lệch 12 giờ).
  const timePatterns = [
    // Period trước số: "chiều 5h", "tối 8h", "sáng 7h30"
    /(sang|sáng|trưa|trua|chiều|chieu|tối|toi|đêm|dem)\s*(\d{1,2})\s*[:h]?\s*(\d{2})?/i,
    // Số trước, period sau: "5h", "5:30", "14h", "14:00", "5h chiều", "8h tối"
    /(\d{1,2})\s*[:h]\s*(\d{2})?\s*(sang|toi|chiều|chieu|sáng|trua|trưa|dem|đêm)?/i,
    // "2 giờ", "2 tiếng"
    /(\d{1,2})\s*(gio|giờ|tiếng|tieng|hour)/i,
    // "2am", "2pm"
    /(\d{1,2})\s*(am|pm)/i,
  ]

  for (const pattern of timePatterns) {
    const match = text.match(pattern);
    if (!match) continue;

    let hour, minute = 0, periodHint = null;

    if (pattern.source.startsWith('(sang|sáng')) {
      // Pattern 1: period đứng trước số → "chiều 5h"
      periodHint = match[1].toLowerCase();
      hour = parseInt(match[2]);
      minute = match[3] ? (parseInt(match[3]) || 0) : 0;
    } else {
      // Pattern 2–4: số đứng trước
      hour = parseInt(match[1]);
      minute = match[2] ? (parseInt(match[2]) || 0) : 0;
      if (match[3]) periodHint = match[3].toLowerCase();
    }

    // Áp dụng period hint (sáng, chiều, tối…)
    if (periodHint) {
      if (['chiều', 'chieu', 'toi', 'tối', 'dem', 'đêm'].includes(periodHint) && hour < 12) {
        hour += 12;
      }
      if (['sang', 'sáng'].includes(periodHint) && hour === 12) {
        hour = 0;
      }
    }

    // Xử lý am/pm
    const fullMatch = match[0];
    if (fullMatch.includes('pm') && hour < 12) hour += 12;
    if (fullMatch.includes('am') && hour === 12) hour = 0;

    if (hour >= 0 && hour <= 23 && minute >= 0 && minute <= 59) {
      return { hour, minute };
    }
  }
  return null;
}

function extractDate(text) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const normalized = normalizeText(text);
  
  // Check relative days
  for (const [keyword, offset] of Object.entries(VIETNAMESE_PATTERNS.relativeDays)) {
    if (normalized.includes(normalizeText(keyword))) {
      const date = new Date(today);
      date.setDate(date.getDate() + offset);
      return date;
    }
  }
  
  for (const [keyword, offset] of Object.entries(ENGLISH_PATTERNS.relativeDays)) {
    if (normalized.includes(keyword)) {
      const date = new Date(today);
      date.setDate(date.getDate() + offset);
      return date;
    }
  }
  
  // Check day of week
  for (const [keyword, dayNum] of Object.entries(VIETNAMESE_PATTERNS.days)) {
    if (normalized.includes(normalizeText(keyword))) {
      const date = new Date(today);
      const currentDay = date.getDay();
      let daysUntil = dayNum - currentDay;
      if (daysUntil <= 0) daysUntil += 7;
      date.setDate(date.getDate() + daysUntil);
      return date;
    }
  }
  
  for (const [keyword, dayNum] of Object.entries(ENGLISH_PATTERNS.days)) {
    if (normalized.includes(keyword)) {
      const date = new Date(today);
      const currentDay = date.getDay();
      let daysUntil = dayNum - currentDay;
      if (daysUntil <= 0) daysUntil += 7;
      date.setDate(date.getDate() + daysUntil);
      return date;
    }
  }
  
  // Check "ngày X" pattern
  const dayMatch = normalized.match(/ngay\s*(\d{1,2})/);
  if (dayMatch) {
    const day = parseInt(dayMatch[1]);
    const date = new Date(today);
    date.setDate(day);
    if (date < today) date.setMonth(date.getMonth() + 1);
    return date;
  }
  
  return null;
}

function extractReminder(text) {
  const normalized = normalizeText(text);
  
  // Vietnamese: "nhắc trước 30 phút", "nhac truoc 1 tieng"
  const viMatch = normalized.match(/nh(?:ă|a)c\s*(?:truoc|trước)?\s*(\d+)\s*(phút|phut|tiếng|tieng|gio|giờ)/i);
  if (viMatch) {
    const amount = parseInt(viMatch[1]);
    const unit = viMatch[2];
    if (['phút', 'phut', 'minute', 'min'].includes(unit)) {
      return -amount;
    } else if (['tiếng', 'tieng', 'hour', 'gio', 'giờ'].includes(unit)) {
      return -amount * 60;
    }
  }
  
  // English: "remind 30 minutes before", "remind 1 hour before"
  const enMatch = normalized.match(/remind\s*(?:me\s*)?(\d+)\s*(min|minute|hour|hr)/i);
  if (enMatch) {
    const amount = parseInt(enMatch[1]);
    const unit = enMatch[2];
    if (['min', 'minute'].includes(unit)) {
      return -amount;
    } else if (['hour', 'hr'].includes(unit)) {
      return -amount * 60;
    }
  }
  
  return null;
}

function extractRepeat(text) {
  const normalized = normalizeText(text);
  
  for (const [keyword, value] of Object.entries(VIETNAMESE_PATTERNS.repeatPatterns)) {
    if (normalized.includes(normalizeText(keyword))) {
      return value;
    }
  }
  
  for (const [keyword, value] of Object.entries({
    'daily': 'DAILY', 'weekly': 'WEEKLY', 'monthly': 'MONTHLY',
    'every day': 'DAILY', 'every week': 'WEEKLY', 'every month': 'MONTHLY',
  })) {
    if (normalized.includes(keyword)) {
      return value;
    }
  }
  
  return 'NONE';
}

function extractPriority(text) {
  const normalized = normalizeText(text);
  
  for (const [keyword, priority] of Object.entries(VIETNAMESE_PATTERNS.priorities)) {
    if (normalized.includes(normalizeText(keyword))) {
      return priority;
    }
  }
  
  return 'MEDIUM';
}

function extractCategory(text) {
  const normalized = normalizeText(text);
  
  for (const [keyword, category] of Object.entries(VIETNAMESE_PATTERNS.categories)) {
    if (normalized.includes(normalizeText(keyword))) {
      return category;
    }
  }
  
  return null;
}

function extractTitle(text) {
  // Remove common patterns to get the main title
  let title = text
    .replace(/(?:nhắc|nhac|remind)\s*(?:trước|truoc|me)?\s*\d+\s*(?:phút|phut|tiếng|tieng|gio|giờ|hour|minute|min).*/gi, '')
    .replace(/(?:thứ|thu)\s*\d/gi, '')
    .replace(/(?:hôm nay|hom nay|ngày mai|ngay mai|mai|today|tomorrow)/gi, '')
    .replace(/(?:lúc|luc|at)\s*\d{1,2}\s*[:h]?\s*\d{0,2}/gi, '')
    .replace(/(?:sáng|sang|trưa|trua|chiều|chieu|tối|toi|đêm|dem|morning|afternoon|evening|night)/gi, '')
    .replace(/(?:hàng ngày|hàng tuần|hàng tháng|daily|weekly|monthly)/gi, '')
    .replace(/(?:khẩn cấp|quan trọng|trung bình|thấp|urgent|important|high|medium|low)/gi, '')
    .replace(/(?:học tập|công việc|cá nhân|sức khỏe|study|work|personal|health)/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
  
  // Capitalize first letter
  if (title) {
    title = title.charAt(0).toUpperCase() + title.slice(1);
  }
  
  return title || text.trim();
}

/**
 * Parse natural language text into task data
 * @param {string} text - Natural language input
 * @param {Array} categories - Available categories
 * @returns {Object} Parsed task data
 */
export function parseNaturalLanguage(text, categories = []) {
  if (!text?.trim()) {
    return { success: false, message: 'Vui lòng nhập nội dung' };
  }
  
  const extractedDate = extractDate(text);
  const extractedTime = extractTime(text);
  const reminderMinutes = extractReminder(text);
  const repeat = extractRepeat(text);
  const priority = extractPriority(text);
  const categoryName = extractCategory(text);
  const title = extractTitle(text);
  
  // Build due date
  let dueAt = null;
  if (extractedDate && extractedTime) {
    extractedDate.setHours(extractedTime.hour, extractedTime.minute, 0, 0);
    dueAt = extractedDate.toISOString();
  } else if (extractedDate) {
    extractedDate.setHours(18, 0, 0, 0);
    dueAt = extractedDate.toISOString();
  } else if (extractedTime) {
    const today = new Date();
    today.setHours(extractedTime.hour, extractedTime.minute, 0, 0);
    if (today < new Date()) {
      today.setDate(today.getDate() + 1);
    }
    dueAt = today.toISOString();
  }
  
  // Build reminders
  const reminders = [];
  if (reminderMinutes && dueAt) {
    const remindAt = new Date(new Date(dueAt).getTime() + reminderMinutes * 60 * 1000);
    if (remindAt < new Date(dueAt)) {
      reminders.push({ remindAt: remindAt.toISOString() });
    }
  }
  
  // Find category
  let categoryId = null;
  if (categoryName && categories.length > 0) {
    const found = categories.find(c => 
      c.name.toLowerCase().includes(categoryName.toLowerCase())
    );
    if (found) categoryId = found.id;
  }
  
  return {
    success: true,
    data: {
      title,
      dueAt,
      priority,
      categoryId,
      repeatType: repeat,
      reminders,
      description: '',
    },
    confidence: dueAt ? 0.9 : 0.6,
  };
}

/**
 * Suggest task breakdown using AI
 * @param {string} taskTitle - The task title
 * @returns {Array} Suggested subtasks
 */
export function suggestTaskBreakdown(taskTitle) {
  const normalized = normalizeText(taskTitle);
  
  // Common task breakdown patterns
  const patterns = {
    'on tap|review|hoc': [
      'Xem lại lý thuyết',
      'Làm bài tập thực hành',
      'Ôn lại những phần khó',
      'Làm đề thi thử',
    ],
    'bien soan|chuan bi|prepar': [
      'Chuẩn bị tài liệu cần thiết',
      'Xây dựng outline nội dung',
      'Thực hiện nội dung chính',
      'Kiểm tra và chỉnh sửa',
    ],
    'hop|meeting|review': [
      'Chuẩn bị agenda',
      'Tổng hợp thông tin cần trình bày',
      'Tham gia họp',
      'Ghi chú action items',
    ],
    'email|gui|send|tra loi|reply': [
      'Đọc và hiểu nội dung email',
      'Soạn nội dung phản hồi',
      'Kiểm tra lại trước khi gửi',
      'Gửi email',
    ],
    'tap|exercise|workout|the duc': [
      'Khởi động',
      'Bài tập chính',
      'Giãn cơ',
      'Nghỉ ngơi và hydrate',
    ],
    'slide|presentation|thuyet trinh': [
      'Xây dựng outline',
      'Thiết kế slide',
      'Chuẩn bị nội dung thuyết minh',
      'Tập thuyết trình',
    ],
  };
  
  for (const [pattern, subtasks] of Object.entries(patterns)) {
    if (new RegExp(pattern, 'i').test(normalized)) {
      return subtasks.map(content => ({
        content,
        isCompleted: false,
      }));
    }
  }
  
  // Default breakdown
  return [
    { content: 'Phân tích yêu cầu', isCompleted: false },
    { content: 'Thực hiện công việc', isCompleted: false },
    { content: 'Kiểm tra kết quả', isCompleted: false },
  ];
}

// ─── Helpers ─────────────────────────────────────────────

const PRIORITY_LABEL = { URGENT: 'Khẩn cấp', HIGH: 'Cao', MEDIUM: 'Trung bình', LOW: 'Thấp' }

function startOfDay(d) {
  const x = new Date(d)
  x.setHours(0, 0, 0, 0)
  return x
}

function addDays(d, n) {
  const x = new Date(d)
  x.setDate(x.getDate() + n)
  return x
}

function sameDay(a, b) {
  if (!a || !b) return false
  return startOfDay(a).getTime() === startOfDay(b).getTime()
}

function fmtTime(d) {
  return d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
}

function humanHours(hours) {
  if (hours < 24) return `${Math.max(0, Math.round(hours))} giờ`
  return `${Math.round(hours / 24)} ngày`
}

function dayLabel(d) {
  const today = startOfDay(new Date())
  const diff = Math.round((startOfDay(d) - today) / 86400000)
  if (diff === 0) return 'hôm nay'
  if (diff === 1) return 'ngày mai'
  if (diff === -1) return 'hôm qua'
  return d.toLocaleDateString('vi-VN', { weekday: 'short', day: 'numeric', month: 'numeric' })
}

// ─── AI: Ưu tiên thông minh ────────────────────────────────
// Xếp hạng công việc đang mở theo mức độ khẩn cấp + lý do.

export function prioritizeTasks(tasks = [], now = new Date()) {
  const open = tasks.filter((t) => t.status === 'TODO' || t.status === 'IN_PROGRESS')

  const scored = open.map((t) => {
    const due = t.dueAt ? new Date(t.dueAt) : null
    const isOverdue = due && due.getTime() < now.getTime()
    const hoursLeft = due ? Math.round((due - now) / 3600000) : null
    let score = 0
    const reasons = []

    if (isOverdue) {
      const overdueHours = Math.abs(hoursLeft)
      score += 6000 + Math.min(overdueHours, 24 * 30)
      reasons.push(`Quá hạn ${humanHours(overdueHours)}`)
    } else if (due) {
      if (sameDay(due, now)) {
        score += 2500
        reasons.push(hoursLeft <= 4 ? `Đến hạn trong ${humanHours(hoursLeft)}` : `Đến hạn hôm nay lúc ${fmtTime(due)}`)
      } else if (due < addDays(now, 3)) {
        score += 900
        reasons.push(`Đến hạn ${dayLabel(due)} ${due ? 'lúc ' + fmtTime(due) : ''}`)
      } else {
        score += 300
        reasons.push(`Đến hạn ${dayLabel(due)}`)
      }
    } else {
      score += 100
      reasons.push('Chưa đặt thời hạn')
    }

    const pri = { URGENT: 500, HIGH: 260, MEDIUM: 120, LOW: 20 }[t.priority] || 80
    if (t.priority === 'URGENT' || t.priority === 'HIGH') {
      reasons.push(`Ưu tiên ${PRIORITY_LABEL[t.priority] || t.priority}`)
    }
    score += pri

    if (t.repeatType && t.repeatType !== 'NONE') {
      score += 60
    }
    if (t.subtasks?.some((s) => !s.isCompleted)) {
      score += 40
    }

    let recommendation = 'Nên làm sớm'
    if (isOverdue) recommendation = 'Làm ngay bây giờ'
    else if (sameDay(due, now)) recommendation = 'Ưu tiên hôm nay'

    return {
      task: t,
      score,
      reasons: reasons.slice(0, 3),
      recommendation,
      isOverdue,
    }
  })

  return scored.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score
    const da = a.task.dueAt ? new Date(a.task.dueAt) : null
    const db = b.task.dueAt ? new Date(b.task.dueAt) : null
    if (!da) return 1
    if (!db) return -1
    return da - db
  })
}

// ─── AI: Cảnh báo lịch (quá tải + xung đột) ────────────────

export function detectScheduleWarnings(tasks = [], now = new Date()) {
  const warnings = []
  const open = tasks.filter((t) => t.status === 'TODO' || t.status === 'IN_PROGRESS')
  const overdue = open.filter((t) => t.dueAt && new Date(t.dueAt) < now)

  // Quá hạn nhiều
  if (overdue.length >= 3) {
    warnings.push({
      level: 'danger',
      title: `${overdue.length} công việc đang quá hạn`,
      detail: 'Hãy ưu tiên xử lý trước, sau đó mới nhận việc mới.',
    })
  }

  // Nhóm theo ngày → quá tải
  const byDay = {}
  for (const t of open) {
    if (!t.dueAt) continue
    const key = startOfDay(new Date(t.dueAt)).toISOString()
    if (!byDay[key]) byDay[key] = []
    byDay[key].push(t)
  }
  for (const [key, list] of Object.entries(byDay)) {
    const day = new Date(key)
    if (list.length >= 5 && day >= startOfDay(now)) {
      warnings.push({
        level: 'warn',
        title: `Ngày ${dayLabel(day)} có tới ${list.length} công việc`,
        detail: 'Lịch khá dày – cân nhắc dời bớt việc ít quan trọng sang ngày khác.',
      })
    }
  }

  // Xung đột giờ (cùng ngày, cách nhau < 60 phút)
  const timed = open
    .filter((t) => t.dueAt)
    .map((t) => ({ t, d: new Date(t.dueAt) }))
    .sort((a, b) => a.d - b.d)
  for (let i = 0; i < timed.length; i++) {
    for (let j = i + 1; j < timed.length; j++) {
      const a = timed[i]
      const b = timed[j]
      if (sameDay(a.d, b.d)) {
        const gap = Math.abs(b.d - a.d) / 60000
        if (gap < 60) {
          warnings.push({
            level: 'warn',
            title: 'Xung đột lịch gần nhau',
            detail: `“${a.t.title}” lúc ${fmtTime(a.d)} và “${b.t.title}” lúc ${fmtTime(b.d)} cùng ${dayLabel(a.d)} – chỉ cách ${Math.round(gap)} phút.`,
          })
          break
        }
      } else {
        break
      }
    }
  }

  if (warnings.length === 0) {
    warnings.push({
      level: 'ok',
      title: 'Lịch của bạn đang ổn',
      detail: 'Không phát hiện quá tải hoặc xung đột thời gian đáng lo.',
    })
  }

  return warnings
}

// ─── AI: Tách việc con nâng cao ────────────────────────────
// Tương tự suggestTaskBreakdown nhưng nhận thêm mô tả & số ngày
// còn lại để gợi ý phù hợp hơn.

export function generateSmartBreakdown(title = '', description = '', dueInDays = null) {
  const text = `${normalizeText(title)} ${normalizeText(description || '')}`

  const base = (steps) => steps.map((content) => ({ content, isCompleted: false }))

  let steps = suggestTaskBreakdown(title)

  // Bổ sung bước theo mô tả
  if (steps.length <= 3) {
    steps = base(['Phân tích yêu cầu', 'Lên kế hoạch thực hiện', 'Thực hiện chính', 'Kiểm tra & hoàn thiện'])
  }

  // Thêm bước theo nội dung mô tả
  if (/nop|submit|hand in|gui/i.test(text)) {
    steps = steps.concat(base(['Rà soát lần cuối trước khi nộp']))
  }
  if (/hop|meeting|phong van|interview/i.test(text)) {
    steps = steps.concat(base(['Chuẩn bị câu hỏi / tài liệu', 'Ghi chú sau buổi họp']))
  }
  if (/bai tap lon|do an|project|report|bao cao/i.test(text)) {
    steps = steps.concat(base(['Viết nháp', 'Chỉnh sửa theo góp ý']))
  }

  // Gợi ý nhịp độ theo thời gian còn lại
  const hint =
    dueInDays == null
      ? null
      : dueInDays <= 1
        ? 'Chỉ còn ít thời gian – hãy làm phần quan trọng nhất trước.'
        : dueInDays <= 3
          ? 'Chia đều công việc trong 3 ngày tới.'
          : 'Có dư thời gian – làm chắc từng bước, đừng dồn vào cuối.'

  return { steps, hint }
}

export default {
  parseNaturalLanguage,
  suggestTaskBreakdown,
  prioritizeTasks,
  detectScheduleWarnings,
  generateSmartBreakdown,
};
