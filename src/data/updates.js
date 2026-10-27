/**
 * Update history for MN-Qronx
 * Each update has version, date, changes with type (feature, fix, improvement)
 */

export const APP_VERSION = '1.3.0'

export const updates = [
  {
    version: '1.3.0',
    date: '2026-10-27',
    title: '🧩 Tiện ích Chrome chính thức ra mắt',
    highlights: [
      'Tiện ích Chrome MN-Qronx đã lên Cửa hàng Chrome Web',
      'Chuông nhắc việc kêu ngay trên máy — kể cả khi đóng tab web',
      'Đăng nhập bằng tài khoản Google ngay trong tiện ích',
      'Bấm giờ Pomodoro tập trung ngay trên thanh công cụ',
    ],
    changes: [
      {
        type: 'feature',
        icon: '🧩',
        title: 'Tiện ích Chrome (MV3)',
        description: 'Cài 1 lần, nhận chuông nhắc việc đúng hạn trên mọi tab — kể cả khi tab web đã đóng. Có sẵn trên Chrome Web Store.',
      },
      {
        type: 'feature',
        icon: '🔐',
        title: 'Đăng nhập Google trong tiện ích',
        description: 'Tài khoản tạo bằng Google (OAuth) đăng nhập tiện ích chỉ với một nút bấm — dùng chung phiên Google trên web.',
      },
      {
        type: 'feature',
        icon: '🍅',
        title: 'Bấm giờ Pomodoro',
        description: 'Phiên tập trung 25/45/60 phút hoặc dài tuỳ ý (tối đa 8 giờ), đếm ngược trên badge và thông báo hết phiên.',
      },
      {
        type: 'fix',
        icon: '🗑️',
        title: 'Sửa xoá công việc',
        description: 'Đã sửa lỗi giao diện xoá 1 công việc nhưng màn hình đếm nhầm số lượng đã xoá.',
      },
      {
        type: 'improvement',
        icon: '💜',
        title: 'Nhận diện thương hiệu mới',
        description: 'Logo gradients mới thống nhất trên web, tiện ích, PWA và app Windows; favicon đã đổi sang bản mới.',
      },
    ],
  },
  {
    version: '1.2.0',
    date: '2026-08-25',
    title: '🤖 AI Natural Language Input',
    highlights: [
      'Tạo task bằng ngôn ngữ tự nhiên - không cần fill form',
      'AI tự động parse ngày giờ, ưu tiên, nhắc nhở',
      'Gợi ý các bước thực hiện cho task phức tạp',
    ],
    changes: [
      {
        type: 'feature',
        icon: '🧠',
        title: 'AI Quick Capture',
        description: 'Nhập text tự nhiên như "Ôn tập Toán ngày mai lúc 19h, nhắc trước 30 phút" và AI sẽ tự động tạo task với đầy đủ thông tin.',
      },
      {
        type: 'feature',
        icon: '📋',
        title: 'Task Breakdown Suggestions',
        description: 'AI gợi ý các bước thực hiện chi tiết cho công việc của bạn.',
      },
      {
        type: 'improvement',
        icon: '🎨',
        title: 'Cải thiện Landing Page',
        description: 'Thêm hiệu ứng 3D mouse-tracking, scroll animations, và parallax.',
      },
      {
        type: 'fix',
        icon: '🌙',
        title: 'Sửa lỗi Dark Mode',
        description: 'Đã sửa màu chữ và giao diện cho chế độ tối trên toàn bộ ứng dụng.',
      },
    ],
  },
  {
    version: '1.1.0',
    date: '2026-08-20',
    title: '✨ Focus Mode & Quick Capture',
    highlights: [
      'Chế độ tập trung giúp bạn làm việc hiệu quả hơn',
      'Tạo task nhanh bằng phím tắt Ctrl+K',
      'Hệ thống phím tắt toàn diện',
    ],
    changes: [
      {
        type: 'feature',
        icon: '⚡',
        title: 'Focus Mode',
        description: 'Chế độ tập trung toàn màn hình, hiển thị task hiện tại và bộ đếm thời gian.',
      },
      {
        type: 'feature',
        icon: '🎯',
        title: 'Quick Capture',
        description: 'Tạo task nhanh bằng Ctrl+K mà không cần rời khỏi trang hiện tại.',
      },
      {
        type: 'feature',
        icon: '⌨️',
        title: 'Keyboard Shortcuts',
        description: 'Phím tắt cho mọi thao tác: Ctrl+N tạo task, Ctrl+D đổi theme, ? xem danh sách phím tắt.',
      },
    ],
  },
  {
    version: '1.0.0',
    date: '2026-08-18',
    title: '🚀 Phiên bản đầu tiên',
    highlights: [
      'Quản lý công việc với nhắc nhở kiểu báo thức',
      'Dashboard trực quan với thống kê',
      'Đồng bộ đa thiết bị',
    ],
    changes: [
      {
        type: 'feature',
        icon: '📱',
        title: 'Task Management',
        description: 'Tạo, chỉnh sửa, hoàn thành công việc với phân loại và ưu tiên.',
      },
      {
        type: 'feature',
        icon: '🔔',
        title: 'Alarm-style Reminders',
        description: 'Nhắc nhở toàn màn hình như báo thức, không thể bỏ lỡ.',
      },
      {
        type: 'feature',
        icon: '📅',
        title: 'Calendar View',
        description: 'Xem công việc theo ngày, tuần, tháng.',
      },
      {
        type: 'feature',
        icon: '🌙',
        title: 'Dark Mode',
        description: 'Chế độ tối để sử dụng ban đêm.',
      },
    ],
  },
]

export default updates
