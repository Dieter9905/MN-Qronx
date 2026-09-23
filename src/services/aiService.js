import api from './apiClient'

/**
 * Gọi AI riêng (backend) để phân tích văn bản thành NHIỀU công việc.
 * Backend giữ key, gói PRO, và trả về danh sách đã sanitize.
 * @param {string} text
 * @returns {Promise<Array>} tasks
 */
export async function fetchAIParseTasks(text) {
  const res = await api('POST', '/ai/parse-tasks', { body: { text } })
  if (!res.success) {
    const err = new Error(res.message || 'Dịch vụ AI lỗi')
    err.code = 'AI_ERROR'
    throw err
  }
  return Array.isArray(res.data?.tasks) ? res.data.tasks : []
}

/**
 * AI Natural Language Parser for Task Creation
 * Parses natural language input like:
 * - "Gọi điện cho sếp thứ 6 lúc 2h, nhắc trước 30 phút"
 * - "Ôn tập Toán chương 3 ngày mai lúc 19h"
 * - "Weekly meeting with team every Monday at 9am"
 *
 * Hỗ trợ NHIỀU CÔNG VIỆC trong cùng một đoạn văn:
 *   "Trưa nay ăn trưa lúc 11h. Chiều có cuộc họp lúc 2h. Tối ăn tối lúc 6h.
 *    Đi ngủ lúc 12h. Hãy nhắc tôi trước 5 phút mỗi cái."
 * → 4 công việc riêng biệt, mỗi cái kèm nhắc nhở trước 5 phút.
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
  // Không nhận "qua"/"kia" đứng một mình: "đi qua công ty", "bữa kia" không
  // phải là chỉ định ngày hôm qua/ngày kia (trước đây làm việc sau thành 22/9)
  relativeDays: {
    'hôm nay': 0, 'hom nay': 0, 'nay': 0, 'hn': 0,
    'ngày mai': 1, 'ngay mai': 1, 'mai': 1, 'tmai': 1,
    'ngày kia': 2, 'ngay kia': 2,
    'hôm qua': -1, 'hom qua': -1,
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
    'ưu tiên cao': 'HIGH', 'uu tien cao': 'HIGH',
    'ưu tiên khẩn cấp': 'URGENT', 'uu tien khan cap': 'URGENT',
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
    // Không nhận "mon"/"thu"/"sat" lẻ sau khi bỏ dấu: "món ăn"→thứ 2,
    // "thủ đức"→thứ 5, "gần sát"→thứ 7 (trước đây câu chứa "thủ đức"
    // lấy nhầm ngày thứ 5 thay vì "ngày 26")
    'monday': 1, 'tuesday': 2, 'tue': 2,
    'wednesday': 3, 'wed': 3, 'thursday': 4,
    'friday': 5, 'fri': 5, 'saturday': 6,
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

// ─── Tách câu: mỗi câu là một công việc tiềm năng ──────────
// Bước 1: dấu kết thúc câu.
const SENTENCE_SPLIT = /[.;!?]+|\n+/

// Chứa giờ cụ thể: "7h", "12h30", "2 giờ", "2pm" (chữ "h" trong "4 học"
// KHÔNG tính — lookbehind/lookahead tránh lẹm vào số học, số năm…)
const HAS_CLOCK =
  /(?<!\d)\d{1,2}\s*(?:[:h](?![a-zà-ỹ])|(?:giờ|gio|tiếng|tieng|hour)\b|(?:am|pm)\b)/i

// Cụm mở đầu một việc mới: buổi trong ngày, "mai/ngày mai", "lúc N", "Nh giờ", thứ tuần
const TASK_START = new RegExp(
  [
    '^(?:buổi\\s+)?(?:sáng|sang|trưa|trua|chiều|chieu|tối|toi|đêm|dem)\\b',
    '^(?:ngày\\s+)?(?:mai|nay|kia)\\b',
    '^(?:lúc|luc)\\s*\\d',
    '^\\d{1,2}\\s*[:h]',
    '^(?:thứ\\s*\\d|thu\\s*\\d|chủ nhật|chu nhat)\\b',
  ].join('|'),
  'i',
)

// Dấu ngắt việc: dấu phẩy hoặc từ nối tuần tự
const CLAUSE_SEPS = [
  /,/g,
  /\s+(?:sau\s*đó|sau\s*do|rồi|roi|xong|tiếp\s*theo|tiep\s*theo)\s+/gi,
  // "…8h30 và …9h" — hai vế cùng có giờ → tách; "An, Lan và Bình lúc 9h"
  // không tách vì vế trái chưa có giờ (guard trong splitClauses)
  /\s+(?:và|va)\s+/gi,
]

function findSeps(text) {
  const seps = []
  for (const re of CLAUSE_SEPS) {
    re.lastIndex = 0
    let m
    while ((m = re.exec(text))) seps.push([m.index, m.index + m[0].length])
  }
  return seps.sort((a, b) => a[0] - b[0])
}

/**
 * Tách một câu không có dấu kết thúc thành nhiều việc:
 * "…lên trường lúc 7h…, trưa đi ăn lúc 12h sau đó chiều 2h đi chụp hình"
 * → 3 việc. Chỉ cắt khi PHÍA TRƯỚC đã có giờ VÀ cụm ngay sau dấu ngắt
 * phải có giờ riêng hoặc mở đầu như một việc mới ("trưa…", "mai…").
 * Câu phụ không có giờ riêng ("Đi ăn trưa, có 5 người tham dự lúc 12h")
 * hay chỉ thị ("…19h, nhắc trước 30 phút") vẫn giữ nguyên.
 */
function splitClauses(text) {
  const seps = findSeps(text)
  const chunks = []
  let pos = 0
  for (const [start, end] of seps) {
    if (start < pos) continue
    const left = text.slice(pos, start)
    const rest = text.slice(end)
    if (rest.trim().length < 4) continue
    if (!HAS_CLOCK.test(left)) continue
    // head = phần NGAY SAU dấu ngắt, cắt trước dấu ngắt kế tiếp
    const nextSep = findSeps(rest)[0]
    const head = nextSep ? rest.slice(0, nextSep[0]) : rest
    if (HAS_CLOCK.test(head) || TASK_START.test(rest.trim())) {
      chunks.push(left.trim())
      pos = end
    }
  }
  chunks.push(text.slice(pos).trim())
  return chunks.filter(Boolean)
}

function splitSentences(text) {
  return text
    .split(SENTENCE_SPLIT)
    .map((s) => s.trim())
    .filter(Boolean)
    .flatMap(splitClauses)
}

/**
 * Dấu hiệu buổi/ngữ cảnh đứng TRƯỚC con số trong câu.
 * VD: "Chiều có cuộc họp lúc 2h" → chiều + 2h = 14:00
 *     "Đi ngủ lúc 12h" → ngủ + 12h = 00:00 hôm sau
 */
function periodHintBefore(text, index) {
  const before = text.slice(0, index)
  // Biên từ để "ngủ" không khớp trong "ngu iu"/"nguoi", "tối" không...
  // (so NGUYÊN VĂN nên "tôi" tự tách khỏi "tối")
  const has = (rx) => new RegExp(`(?<![a-zà-ỹ])(?:${rx})(?![a-zà-ỹ])`, 'i').test(before)
  if (has('đêm|dem|khuya')) return 'đêm'
  if (has('tối|toi')) return 'tối'
  if (has('chiều|chieu')) return 'chiều'
  if (has('trưa|trua')) return 'trưa'
  if (has('sáng|sang')) return 'sáng'
  if (has('ngủ|ngu|sleep')) return 'ngủ'
  return null
}

/**
 * Áp dụng dấu hiệu buổi vào giờ. Trả về { hour, nextDay }.
 * - đêm/khuya/ngủ: 12h → 00:00 hôm sau; <12h → +12 (22h, 23h…)
 * - chiều/tối: <12h → +12
 * - sáng: 12h → 00:00
 * - trưa: <=10h → +12 ("ăn trưa lúc 1h" = 13:00)
 */
function applyPeriodHint(hint, hour) {
  if (!hint) return { hour, nextDay: false }
  const h = hint.toLowerCase()
  if (h === 'đêm' || h === 'dem' || h === 'khuya' || h === 'ngủ' || h === 'ngu' || h === 'sleep') {
    // 0h/12h đêm = nửa đêm hôm sau; 6–11h đêm = buổi tối (+12);
    // 1–5h đêm giữ nguyên ("về 3h sáng" = 03:00, không phải 15:00)
    if (hour === 0 || hour === 12) return { hour: 0, nextDay: true }
    if (hour >= 6 && hour < 12) return { hour: hour + 12, nextDay: false }
    return { hour, nextDay: false }
  }
  if (h === 'chiều' || h === 'chieu' || h === 'tối' || h === 'toi') {
    if (hour === 0) return { hour: 0, nextDay: true } // "Tối 0h" = 00:00 hôm sau
    if (hour < 12) return { hour: hour + 12, nextDay: false }
    return { hour, nextDay: false }
  }
  if (h === 'sáng' || h === 'sang') {
    if (hour === 12) return { hour: 0, nextDay: false }
    return { hour, nextDay: false }
  }
  if (h === 'trưa' || h === 'trua') {
    if (hour <= 10) return { hour: hour + 12, nextDay: false }
    return { hour, nextDay: false }
  }
  return { hour, nextDay: false }
}

/**
 * Trích giờ từ một câu. Trả { hour, minute, nextDay, matched } hoặc null.
 */
function extractTime(text) {
  // Thứ tự quan trọng: pattern "buổi + giờ" (chiều 5h, tối 8h, sáng 7h30)
  // phải được kiểm tra TRƯỚC pattern "giờ + buổi" (5h chiều, 8h tối),
  // nếu không "chiều 5h" sẽ bị hiểu thành 5h SÁNG (lệch 12 giờ).
  const timePatterns = [
    // Period trước số: "chiều 5h", "tối 8h", "sáng 7h30", "khuya 24h"
    /(sang|sáng|trưa|trua|chiều|chieu|tối|toi|đêm|dem|khuya)\s*(\d{1,2})\s*[:h]?\s*(\d{2})?/i,
    // Số trước, period sau: "5h", "5:30", "14h", "14:00", "5h chiều", "8h tối"
    // (trước đây thiếu "tối"/"khuya" → "7h tối" mất hint → ra 07:00)
    /(\d{1,2})\s*[:h]\s*(\d{2})?\s*(sang|sáng|trưa|trua|chiều|chieu|tối|toi|đêm|dem|khuya)?/i,
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
      if (match[3]) {
        periodHint = match[3].toLowerCase();
      } else if (/(?:am|pm)\s*$/i.test(match[0])) {
        // "7am/7pm" đã tường minh → đánh dấu để không ghép/kế thừa buổi khác
        periodHint = 'am|pm';
      }
    }

    // Buổi đứng TRƯỚC con số trong câu (vd "Chiều có cuộc họp lúc 2h")
    if (!periodHint) periodHint = periodHintBefore(text, match.index);

    let res = applyPeriodHint(periodHint, hour);
    hour = res.hour;
    let nextDay = res.nextDay;

    // Xử lý am/pm
    const fullMatch = match[0];
    if (fullMatch.includes('pm') && hour < 12) hour += 12;
    if (fullMatch.includes('am') && hour === 12) hour = 0;

    // "24h khuya" = 00:00 hôm sau (24 nằm ngoài 0–23 nên trước đây bị bỏ qua
    // hoàn toàn → câu không có giờ → công việc không có thời hạn)
    if (hour === 24) {
      hour = 0;
      nextDay = true;
    }

    if (hour >= 0 && hour <= 23 && minute >= 0 && minute <= 59) {
      return { hour, minute, nextDay, matched: match[0], period: periodHint };
    }
  }

  // Không có giờ cụ thể nhưng có từ chỉ buổi ("trưa đi ăn", "chiều họp") →
  // dùng giờ mặc định của buổi đó. Backend bắt buộc dueAt nên câu trống
  // sẽ bị từ chối lúc tạo công việc.
  const buoi = periodHintBefore(text, text.length);
  if (buoi) {
    // "…nhắc trước 5 phút mỗi buổi tối" vẫn là chỉ thị toàn cục, không phải việc
    if (extractReminder(text) && GLOBAL_MARKERS.test(text)) return null;
    const dflt = { 'sáng': 8, 'trưa': 12, 'chiều': 15, 'tối': 20, 'đêm': 22, 'ngủ': 22 }[buoi];
    if (dflt) return { hour: dflt, minute: 0, nextDay: false, matched: null, period: buoi };
  }
  const enPer = ['morning', 'afternoon', 'evening', 'night'].find((w) => hasWord(normalizeText(text), w));
  if (enPer) return { hour: ENGLISH_PATTERNS.times[enPer], minute: 0, nextDay: false, matched: null, period: enPer };
  return null;
}

/**
 * Kiểm tra từ có xuất hiện NGUYÊN TỪ (không lẹm vào từ khác):
 * "thu" (Thursday) không được khớp trong "thuốc", "nay" không khớp trong "vậy"…
 * Text đã normalize (bỏ dấu) nên so bằng regex biên từ.
 */
function hasWord(normalized, keyword) {
  const kw = normalizeText(keyword)
  const esc = kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return new RegExp(`(?<![a-zà-ỹ0-9])${esc}(?![a-zà-ỹ0-9])`, 'i').test(normalized)
}

/**
 * Trích ngày từ một câu. Trả { date, matched } hoặc null.
 */
function extractDate(text) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const normalized = normalizeText(text);

  // Relative days
  for (const [keyword, offset] of Object.entries(VIETNAMESE_PATTERNS.relativeDays)) {
    if (hasWord(normalized, keyword)) {
      const date = new Date(today);
      date.setDate(date.getDate() + offset);
      return { date, matched: keyword };
    }
  }

  for (const [keyword, offset] of Object.entries(ENGLISH_PATTERNS.relativeDays)) {
    if (hasWord(normalized, keyword)) {
      const date = new Date(today);
      date.setDate(date.getDate() + offset);
      return { date, matched: keyword };
    }
  }

  // Day of week
  for (const [keyword, dayNum] of Object.entries(VIETNAMESE_PATTERNS.days)) {
    if (hasWord(normalized, keyword)) {
      const date = new Date(today);
      const currentDay = date.getDay();
      let daysUntil = dayNum - currentDay;
      if (daysUntil <= 0) daysUntil += 7;
      date.setDate(date.getDate() + daysUntil);
      return { date, matched: keyword };
    }
  }

  for (const [keyword, dayNum] of Object.entries(ENGLISH_PATTERNS.days)) {
    if (hasWord(normalized, keyword)) {
      const date = new Date(today);
      const currentDay = date.getDay();
      let daysUntil = dayNum - currentDay;
      if (daysUntil <= 0) daysUntil += 7;
      date.setDate(date.getDate() + daysUntil);
      return { date, matched: keyword };
    }
  }

  // "ngày X"
  const dayMatch = normalized.match(/ngay\s*(\d{1,2})/);
  if (dayMatch) {
    const day = parseInt(dayMatch[1]);
    const date = new Date(today);
    date.setDate(day);
    if (date < today) date.setMonth(date.getMonth() + 1);
    return { date, matched: text.slice(dayMatch.index, dayMatch.index + dayMatch[0].length) };
  }

  return null;
}

/**
 * Trích nhắc nhở ("nhắc tôi trước 30 phút", "remind me 1 hour before").
 * Trả { offset (phút, âm = trước giờ đến hạn), matched } hoặc null.
 */
function extractReminder(text) {
  const normalized = normalizeText(text);

  // Vietnamese: "nhắc tôi trước 30 phút", "nhac truoc 1 tieng"
  const sliceOrig = (m) => (m ? text.slice(m.index, m.index + m[0].length) : null)

  const viMatch = normalized.match(/nh(?:ă|a)c\s*(?:tôi|toi|bạn|ban|em|mình|minh|me|us)?\s*(?:truoc|trước)?\s*(\d+)\s*(phút|phut|tiếng|tieng|gio|giờ|hour|minute)/i);
  if (viMatch) {
    const amount = parseInt(viMatch[1]);
    const unit = viMatch[2];
    if (['phút', 'phut', 'minute', 'min'].includes(unit)) {
      return { offset: -amount, matched: sliceOrig(viMatch) };
    } else if (['tiếng', 'tieng', 'hour', 'gio', 'giờ'].includes(unit)) {
      return { offset: -amount * 60, matched: sliceOrig(viMatch) };
    }
  }

  // "báo thức trước 5 phút"
  const baoMatch = normalized.match(/bao thuc\s*(?:truoc|trước)?\s*(\d+)\s*(phút|phut|tiếng|tieng|gio|giờ)/i);
  if (baoMatch) {
    const amount = parseInt(baoMatch[1]);
    const unit = baoMatch[2];
    if (['phút', 'phut'].includes(unit)) {
      return { offset: -amount, matched: sliceOrig(baoMatch) };
    } else if (['tiếng', 'tieng', 'gio', 'giờ'].includes(unit)) {
      return { offset: -amount * 60, matched: sliceOrig(baoMatch) };
    }
  }

  // English: "remind me 30 minutes before", "remind 1 hour before"
  const enMatch = normalized.match(/remind\s*(?:me\s*)?(\d+)\s*(min|minute|hour|hr)/i);
  if (enMatch) {
    const amount = parseInt(enMatch[1]);
    const unit = enMatch[2];
    if (['min', 'minute'].includes(unit)) {
      return { offset: -amount, matched: sliceOrig(enMatch) };
    } else if (['hour', 'hr'].includes(unit)) {
      return { offset: -amount * 60, matched: sliceOrig(enMatch) };
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

/**
 * Làm sạch tiêu đề công việc từ câu gốc: bỏ giờ/ngày/nhắc nhở đã trích,
 * bỏ chủ ngữ, từ nối, từ chỉ buổi ở ĐẦU câu (không phá "ăn trưa/ăn tối").
 */
function cleanTitle(clause, spans) {
  const collapse = (x) => x.replace(/\s+/g, ' ').trim()
  const escapeRegExp = (str) => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  let s = clause
  // Bỏ các cụm đã trích xuất (giờ, ngày, nhắc nhở) — không phân biệt hoa/thường
  for (const span of spans) {
    if (span && span.length > 1) {
      s = s.replace(new RegExp(escapeRegExp(span), 'gi'), ' ')
    }
  }
  s = collapse(s)
  // Bỏ "vào lúc / lúc / tại / at" còn sót
  s = s.replace(/\b(vào lúc|vào|tại|lúc|at)\b/gi, ' ')
  s = collapse(s)
  // Ngày còn sót (span có thể trỏ sai chỗ khi câu có dấu) — "ngày 23/9", "ngày 26"
  s = s.replace(/\bngày\s*\d{1,2}\s*[/-]\s*\d{1,2}(?:\s*[/-]\s*\d{2,4})?\b/gi, ' ')
  s = s.replace(/\bngày\s+\d{1,2}\b/gi, ' ')
  s = s.replace(/\b\d{1,2}\s*[/-]\s*\d{1,2}(?:\s*[/-]\s*\d{2,4})?\b/g, ' ')
  // Giờ còn sót — "9h", "8h30 sáng", "24h khuya"
  // (biên như HAS_CLOCK: "4 học" không bị cắt mất chữ "học")
  s = s.replace(/\b\d{1,2}\s*[:h](?![a-zà-ỹ])\s*\d{0,2}\s*(?:sáng|sang|trưa|trua|chiều|chieu|tối|toi|đêm|dem|khuya)?/gi, ' ')
  s = collapse(s)
  // Lặp tới khi ổn định — sau khi bỏ span/ngày/giờ, từ nối + chủ ngữ mới
  // trồi ra đầu câu ("Sau đó tôi sẽ qua…" → cần bỏ nhiều lớp mới ra "Qua…")
  for (let pass = 0; pass < 3; pass++) {
    const before = s
    // Bỏ từ chỉ buổi ở ĐẦU câu ("Trưa nay...", "Chiều có...", "Tối ăn...")
    s = s.replace(/^(?:buổi\s+)?(?:sáng|sang|trưa|trua|chiều|chieu|tối|toi|đêm|dem|khuya)\b/gi, ' ')
    s = collapse(s)
    // Bỏ chủ ngữ ở đầu câu ("tôi đi ăn trưa" → "đi ăn trưa", "chúng tôi sẽ…" → bỏ "chúng tôi sẽ")
    s = s.replace(/^(?:chúng tôi|chung toi|tôi|toi|em|mình|minh|bạn|ban|chúng ta|chung ta|anh|chị|chi)\b(?:\s+(?:sẽ|se|cần|can|phải|phai|muốn|muon|đi|di))?/gi, ' ')
    s = collapse(s)
    // Bỏ từ nối đầu câu
    s = s.replace(/^(?:và|va|rồi|roi|sau đó|sau do|kế tiếp|ke tiep|tiếp theo|tiep theo|xong|hãy|hay|cần|can|phải|phai|sẽ|se|every)\b/gi, ' ')
    s = collapse(s)
    // Bỏ "có" đầu câu ("Có cuộc họp" → "Cuộc họp")
    s = s.replace(/^có\s+/i, ' ')
    if (s === before) break
  }
  s = collapse(s)
  // Bỏ từ chỉ mức ưu tiên / lặp lại / dấu phẩy thừa còn sót trong tiêu đề
  s = s.replace(/\b(khẩn cấp|khan cap|quan trọng|important|trung bình|thấp|thap|urgent|high|medium|low|nghiêm trọng|hàng ngày|hang ngay|hàng tuần|hang tuan|hàng tháng|hang thang|daily|weekly|monthly|every day|every week|every month)\b/gi, ' ')
  // Bỏ cụm "ưu tiên cao/thấp…" (biên tự viết thường/VI để \b không trượt:
  // chữ "ư" KHÔNG phải \w nên \b(?:ưu…) không bao giờ khớp)
  s = s.replace(/(?<![a-zà-ỹ])(?:ưu tiên|uu tien)\s+(?:cao|thấp|thap|trung bình|trung binh|khẩn cấp|khan cap|urgent|high|low)(?![a-zà-ỹ0-9])/gi, ' ')
  s = s.replace(/,/g, ' ')
  s = collapse(s)
  s = s.replace(/[.,;!?]\s*$/g, '').trim()

  if (!s) return null
  return s.charAt(0).toUpperCase() + s.slice(1)
}

/**
 * Dấu hiệu cho biết câu là cụm CHỈ THỊ TOÀN CỤC
 * ("Hãy nhắc tôi trước 5 phút mỗi cái") — không phải một công việc.
 */
const GLOBAL_MARKERS = /(mỗi|moi|từng|tung|tất cả|tat ca|mọi|each|every|all)/i

function isModifierClause(clause, remInfo, timeInfo) {
  if (!remInfo || timeInfo) return false
  if (GLOBAL_MARKERS.test(clause)) return true
  // Cụm gần như chỉ gồm lời nhắc nhở → coi là chỉ thị toàn cục
  const leftover = clause.replace(remInfo.matched, '').trim()
  return leftover.length < 6
}

/**
 * Parse MỘT câu thành một công việc đầy đủ trường.
 * @param {Date|null} carryDate - ngày đã biết ở câu TRƯỚC ("Sáng mai 7h lên
 *   trường, trưa 12h đi ăn" → câu sau không nhắc "mai" nữa nhưng vẫn là ngày mai).
 */
function parseClause(clause, categories, globalReminderOffset, carryDate = null, carryHour = null, carryPeriod = null) {
  const timeInfo = extractTime(clause)
  const dateInfo = extractDate(clause)
  const remInfo = extractReminder(clause)

  // Ngày đến hạn: ngày trong câu → ngày kế thừa từ câu trước → hôm nay.
  // Luôn có thời hạn (backend bắt buộc dueAt): câu không giờ không ngày
  // mặc định 18:00 — trước đây ra null và bị server từ chối lúc tạo.
  let day = null
  if (dateInfo?.date) day = new Date(dateInfo.date)
  else if (carryDate) day = new Date(carryDate)
  else day = new Date()
  day.setHours(0, 0, 0, 0)

  let hour = 18, minute = 0
  if (timeInfo) {
    hour = timeInfo.hour
    minute = timeInfo.minute
    // Giờ lõm (chỉ có số, không nêu buổi) trong chuỗi đang là buổi tối/trưa/
    // chiều → kế thừa buổi nếu vẫn đi tiếp về phía sau: "…8h30 và …9h" →
    // 21:00, "…7h tối, …9h" → 21:00. Buổi sáng / "ngủ" không kế thừa; câu
    // có ngày riêng thì coi như bắt đầu ngày/buỗi mới.
    if (
      !timeInfo.period &&
      !dateInfo?.date &&
      carryPeriod &&
      /^(?:trưa|trua|chiều|chieu|tối|toi|đêm|dem|khuya)$/.test(carryPeriod) &&
      hour >= 1 && hour <= 11 &&
      carryHour != null &&
      hour + 12 >= carryHour
    ) {
      hour += 12
    }
    if (timeInfo.nextDay) day.setDate(day.getDate() + 1)
  }
  day.setHours(hour, minute, 0, 0)
  // Câu KHÔNG tự nêu ngày mà giờ đã lùi qua quá khứ → dời sang hôm sau
  // ("sau đó 9h" gõ lúc 17h → 9h ngày mai), nếu không backend từ chối
  // và việc bị mất im lặng khi bấm tạo.
  if (!dateInfo?.date && day.getTime() <= Date.now()) {
    day.setDate(day.getDate() + 1)
  }
  const dueAt = day.toISOString()

  // Nhắc nhở: ưu tiên nhắc nhở riêng của câu, nếu không dùng chỉ thị toàn cục
  const reminders = []
  const offset = remInfo ? remInfo.offset : globalReminderOffset
  if (offset && dueAt) {
    const remindAt = new Date(new Date(dueAt).getTime() + offset * 60 * 1000)
    if (remindAt < new Date(dueAt)) {
      reminders.push({ remindAt: remindAt.toISOString() })
    }
  }

  const repeatType = extractRepeat(clause)
  const priority = extractPriority(clause)
  const categoryName = extractCategory(clause)

  let categoryId = null
  if (categoryName && categories.length > 0) {
    const found = categories.find((c) => c.name.toLowerCase().includes(categoryName.toLowerCase()))
    if (found) categoryId = found.id
  }

  const title = cleanTitle(clause, [timeInfo?.matched, dateInfo?.matched, remInfo?.matched])
  if (!title) return null

  return {
    title,
    description: '',
    categoryId,
    priority,
    dueAt,
    repeatType,
    reminders,
    confidence: dueAt ? 0.9 : 0.6,
  }
}

/**
 * Parse một đoạn văn thành NHIỀU công việc.
 * @param {string} text - Natural language input (có thể gồm nhiều câu)
 * @param {Array} categories - Available categories
 * @returns {{success: boolean, tasks: Array, message?: string}}
 */
export function parseNaturalLanguageTasks(text, categories = []) {
  if (!text?.trim()) {
    return { success: false, message: 'Vui lòng nhập nội dung' }
  }

  const clauses = splitSentences(text)

  // Pass 1: tìm cụm chỉ thị toàn cục ("nhắc trước 5 phút mỗi cái")
  let globalReminderOffset = null
  for (const clause of clauses) {
    const remInfo = extractReminder(clause)
    const timeInfo = extractTime(clause)
    if (isModifierClause(clause, remInfo, timeInfo) && globalReminderOffset == null) {
      globalReminderOffset = remInfo.offset
    }
  }

  // Pass 2: parse từng câu thành công việc (kế thừa ngày + buổi từ câu trước)
  const tasks = []
  let carryDate = null
  let carryHour = null
  let carryPeriod = null
  for (const clause of clauses) {
    const remInfo = extractReminder(clause)
    const timeInfo = extractTime(clause)
    if (isModifierClause(clause, remInfo, timeInfo)) continue
    const task = parseClause(clause, categories, globalReminderOffset, carryDate, carryHour, carryPeriod)
    if (task) tasks.push(task)
    const dateInfo = extractDate(clause)
    // giờ ĐÃ resolve (+12/kế thừa…) của câu này — lấy từ dueAt để câu sau
    // so sánh đúng (python cũng dùng giờ cuối)
    const finalHour = task
      ? new Date(task.dueAt).getHours() + new Date(task.dueAt).getMinutes() / 60
      : (timeInfo ? timeInfo.hour + timeInfo.minute / 60 : null)
    if (dateInfo?.date) {
      carryDate = dateInfo.date
      // ngày mới → mang theo buổi của CHÍNH câu đó (không thì bắt đầu mới)
      carryPeriod = timeInfo?.period || null
      carryHour = timeInfo ? finalHour : null
    } else if (timeInfo) {
      carryPeriod = timeInfo.period || carryPeriod
      carryHour = finalHour
    }
  }

  // Không tách được câu nào → thử parse cả chuỗi như một công việc
  if (!tasks.length) {
    const task = parseClause(text, categories, globalReminderOffset)
    if (task) tasks.push(task)
  }

  return { success: tasks.length > 0, tasks, confidence: tasks.length ? (tasks[0].confidence ?? 0.8) : 0 }
}

/**
 * Parse một đoạn văn thành MỘT công việc (tương thích ngược — lấy việc đầu tiên).
 * @param {string} text - Natural language input
 * @param {Array} categories - Available categories
 * @returns {Object} Parsed task data
 */
export function parseNaturalLanguage(text, categories = []) {
  const res = parseNaturalLanguageTasks(text, categories)
  if (!res.success) return res
  const first = res.tasks[0]
  return {
    success: true,
    data: first,
    confidence: first.confidence,
    taskCount: res.tasks.length,
  }
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
  parseNaturalLanguageTasks,
  suggestTaskBreakdown,
  prioritizeTasks,
  detectScheduleWarnings,
  generateSmartBreakdown,
};