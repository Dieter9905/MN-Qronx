import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { flushSync } from 'react-dom'

const ThemeContext = createContext()

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('mn-qronx-theme')
      if (saved) return saved
      return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
    }
    return 'light'
  })

  useEffect(() => {
    const root = document.documentElement
    root.classList.remove('light', 'dark')
    root.classList.add(theme)
    localStorage.setItem('mn-qronx-theme', theme)
  }, [theme])

  /**
   * Đổi sáng/tối kèm hiệu ứng "màn che tròn" lan ra từ vị trí bấm
   * (View Transitions API – Chrome/Edge/Safari mới; trình duyệt cũ tự động
   * chuyển sang đổi màu tức thì, không cần cấu hình thêm).
   */
  const toggleTheme = useCallback(
    (origin) => {
      const next = theme === 'light' ? 'dark' : 'light'
      const reduceMotion =
        typeof window !== 'undefined' &&
        window.matchMedia('(prefers-reduced-motion: reduce)').matches

      if (typeof document === 'undefined' || typeof document.startViewTransition !== 'function' || reduceMotion) {
        setTheme(next)
        return
      }

      const x = origin?.clientX ?? window.innerWidth - 48
      const y = origin?.clientY ?? 48
      const radius = Math.hypot(Math.max(x, window.innerWidth - x), Math.max(y, window.innerHeight - y))

      const transition = document.startViewTransition(() => {
        flushSync(() => setTheme(next))
      })

      transition.ready
        .then(() => {
          document.documentElement.animate(
            { clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${radius}px at ${x}px ${y}px)`] },
            {
              duration: 640,
              easing: 'cubic-bezier(0.16, 1, 0.3, 1)',
              pseudoElement: '::view-transition-new(root)',
            }
          )
        })
        .catch(() => {
          /* trình duyệt huỷ transition (đổi trang, tab ẩn…) – bỏ qua */
        })
    },
    [theme]
  )

  return (
    <ThemeContext.Provider value={{ theme, setTheme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  )
}

export const useTheme = () => useContext(ThemeContext)
