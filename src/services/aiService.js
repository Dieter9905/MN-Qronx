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
    'hôm nay': 0, 'hom nay': 0, 'ngay': 0,
    'ngày mai': 1, 'ngay mai': 1, 'mai': 1,
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
  // Match patterns like "2h", "2:30", "14:00", "2 giờ", "2 tiếng"
  const timePatterns = [
    /(\d{1,2})\s*[:h]\s*(\d{2})?\s*(sang|toi|chiều|sáng|trua|trưa|dem|đêm)?/i,
    /(\d{1,2})\s*(gio|giờ|tiếng|tieng|hour)/i,
    /(sang|toi|chiều|sáng|trua|trưa|dem|đêm)\s*(\d{1,2})\s*h?/i,
    /(\d{1,2})\s*(am|pm)/i,
  ];

  for (const pattern of timePatterns) {
    const match = text.match(pattern);
    if (match) {
      let hour = parseInt(match[1] || match[2]);
      let minute = parseInt(match[2] || '0');
      
      if (match[3]) {
        const period = match[3].toLowerCase();
        if (['toi', 'tối', 'chiều', 'chieu', 'dem', 'đêm'].includes(period) && hour < 12) {
          hour += 12;
        }
      }
      
      if (match[0].includes('pm') && hour < 12) hour += 12;
      if (match[0].includes('am') && hour === 12) hour = 0;
      
      if (hour >= 0 && hour <= 23 && minute >= 0 && minute <= 59) {
        return { hour, minute: isNaN(minute) ? 0 : minute };
      }
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

export default {
  parseNaturalLanguage,
  suggestTaskBreakdown,
};
