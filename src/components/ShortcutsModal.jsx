import { Keyboard, X, Lightning } from '@phosphor-icons/react'
import { useLanguage } from '../context/LanguageContext'
import { useTheme } from '../context/ThemeContext'

const shortcuts_vi = [
  { keys: ['Ctrl', 'N'], label: 'Tạo công việc mới' },
  { keys: ['Ctrl', 'H'], label: 'Về Dashboard' },
  { keys: ['Ctrl', 'T'], label: 'Đi tới Công việc' },
  { keys: ['Ctrl', 'L'], label: 'Đi tới Lịch' },
  { keys: ['Ctrl', ','], label: 'Đi tới Cài đặt' },
  { keys: ['Ctrl', 'D'], label: 'Đổi giao diện Sáng/Tối' },
  { keys: ['Ctrl', 'Shift', 'L'], label: 'Đổi ngôn ngữ' },
  { keys: ['Ctrl', 'K'], label: 'Tạo task nhanh' },
  { keys: ['Ctrl', 'F'], label: 'Chế độ tập trung' },
  { keys: ['?'], label: 'Hiện phím tắt này' },
  { keys: ['Esc'], label: 'Đóng' },
]

const shortcuts_en = [
  { keys: ['Ctrl', 'N'], label: 'New task' },
  { keys: ['Ctrl', 'H'], label: 'Go to Dashboard' },
  { keys: ['Ctrl', 'T'], label: 'Go to Tasks' },
  { keys: ['Ctrl', 'L'], label: 'Go to Calendar' },
  { keys: ['Ctrl', ','], label: 'Go to Settings' },
  { keys: ['Ctrl', 'D'], label: 'Toggle Dark/Light mode' },
  { keys: ['Ctrl', 'Shift', 'L'], label: 'Toggle Language' },
  { keys: ['Ctrl', 'K'], label: 'Quick capture' },
  { keys: ['Ctrl', 'F'], label: 'Focus mode' },
  { keys: ['?'], label: 'Show this dialog' },
  { keys: ['Esc'], label: 'Close' },
]

export default function ShortcutsModal({ onClose }) {
  const { lang } = useLanguage()
  const t_header = lang === 'vi'
    ? { shortcutsTitle: 'Phím tắt', shortcutsSubtitle: 'Sử dụng phím tắt để thao tác nhanh hơn' }
    : { shortcutsTitle: 'Keyboard Shortcuts', shortcutsSubtitle: 'Use shortcuts to work faster' }
  const shortcuts = lang === 'vi' ? shortcuts_vi : shortcuts_en

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-navy-900/60 backdrop-blur-sm dark:bg-black/60">
      <div className="relative mx-4 w-full max-w-lg animate-scale-in">
        <div className="overflow-hidden rounded-3xl bg-white shadow-2xl ring-1 ring-navy-100 dark:bg-slate-900 dark:ring-slate-700">
          {/* Header */}
          <div className="flex items-center justify-between bg-navy-900 px-6 py-5 dark:bg-slate-800">
            <div className="flex items-center gap-3 text-white">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-gradient">
                <Keyboard size={20} weight="bold" />
              </span>
              <div>
                <h2 className="font-bold">{t_header.shortcutsTitle}</h2>
                <p className="text-xs text-navy-300 dark:text-slate-400">{t_header.shortcutsSubtitle}</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-white/60 transition hover:bg-white/10 hover:text-white"
            >
              <X size={16} weight="bold" />
            </button>
          </div>

          {/* Shortcuts list */}
          <div className="max-h-96 overflow-y-auto px-6 py-4">
            <ul className="space-y-2">
              {shortcuts.map((s) => (
                <li
                  key={s.label}
                  className="flex items-center justify-between rounded-xl px-3 py-2.5 transition hover:bg-navy-50 dark:hover:bg-slate-800"
                >
                  <span className="text-sm font-semibold text-navy-700 dark:text-slate-300">{s.label}</span>
                  <div className="flex items-center gap-1">
                    {s.keys.map((k, i) => (
                      <span key={i}>
                        <kbd className="inline-flex h-7 min-w-[28px] items-center justify-center rounded-lg border border-navy-200 bg-navy-50 px-1.5 text-[11px] font-bold text-navy-600 shadow-sm dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300">
                          {k}
                        </kbd>
                        {i < s.keys.length - 1 && <span className="mx-0.5 text-navy-300 dark:text-slate-600">+</span>}
                      </span>
                    ))}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  )
}
