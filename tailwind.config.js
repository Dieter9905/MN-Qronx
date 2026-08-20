/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', 'system-ui', '-apple-system', 'Segoe UI', 'sans-serif'],
      },
      colors: {
        // MN-Qronx brand palette (brand guidelines)
        navy: {
          DEFAULT: '#0D1B2A',
          50: '#F0F4FA',
          100: '#DCE6F2',
          200: '#B9CDE5',
          300: '#8FAED4',
          400: '#5F8BBF',
          500: '#3D6AA5',
          600: '#2B5088',
          700: '#1F3D6B',
          800: '#162C4E',
          900: '#0D1B2A',
        },
        brand: {
          blue: '#2563EB',
          cyan: '#06B6D4',
          purple: '#8B5CF6',
        },
      },
      backgroundImage: {
        'brand-gradient': 'linear-gradient(120deg, #2563EB 0%, #06B6D4 55%, #8B5CF6 110%)',
        'brand-gradient-soft': 'linear-gradient(120deg, rgba(37,99,235,0.10), rgba(6,182,212,0.10), rgba(139,92,246,0.10))',
        'hero-glow': 'radial-gradient(60% 50% at 70% 20%, rgba(139,92,246,0.28) 0%, rgba(6,182,212,0.18) 45%, rgba(13,27,42,0) 75%)',
        'hero-glow-dark': 'radial-gradient(60% 50% at 70% 20%, rgba(139,92,246,0.4) 0%, rgba(6,182,212,0.25) 45%, rgba(13,27,42,0) 75%)',
        'alarm-gradient': 'linear-gradient(160deg, #0D1B2A 0%, #1e3a8a 55%, #6d28d9 130%)',
        'dark-gradient': 'linear-gradient(180deg, #0f172a 0%, #1e293b 100%)',
      },
      boxShadow: {
        card: '0 1px 2px rgba(13,27,42,0.05), 0 4px 16px rgba(13,27,42,0.06)',
        'card-dark': '0 1px 2px rgba(0,0,0,0.3), 0 4px 16px rgba(0,0,0,0.4)',
        'card-hover': '0 2px 4px rgba(13,27,42,0.06), 0 12px 32px rgba(13,27,42,0.12)',
        'card-hover-dark': '0 2px 4px rgba(0,0,0,0.4), 0 12px 32px rgba(0,0,0,0.5)',
        'glow-blue': '0 8px 30px rgba(37,99,235,0.35)',
        'glow-purple': '0 8px 30px rgba(139,92,246,0.35)',
        'alarm': '0 0 0 1px rgba(255,255,255,0.08), 0 24px 80px rgba(13,27,42,0.6)',
        '3d': '0 20px 60px -15px rgba(37,99,235,0.3), 0 0 0 1px rgba(255,255,255,0.1)',
        '3d-hover': '0 30px 80px -15px rgba(37,99,235,0.4), 0 0 0 1px rgba(255,255,255,0.15)',
      },
      animation: {
        'fade-in': 'fadeIn 0.25s ease-out both',
        'slide-up': 'slideUp 0.3s cubic-bezier(0.16,1,0.3,1) both',
        'slide-down': 'slideDown 0.25s cubic-bezier(0.16,1,0.3,1) both',
        'scale-in': 'scaleIn 0.2s cubic-bezier(0.16,1,0.3,1) both',
        'alarm-ring': 'alarmRing 0.5s ease-in-out infinite',
        'alarm-bell': 'alarmBell 0.9s ease-in-out infinite',
        'pop-in': 'popIn 0.4s cubic-bezier(0.16,1,0.3,1) both',
        'pulse-soft': 'pulseSoft 2.4s ease-in-out infinite',
        'float': 'float 6s ease-in-out infinite',
        'shimmer': 'shimmer 1.6s linear infinite',
        'progress-stripes': 'progressStripes 1s linear infinite',
        'spin-slow': 'spin 8s linear infinite',
        '3d-rotate': 'rotate3d 12s ease-in-out infinite',
        '3d-card-tilt': 'tilt3d 6s ease-in-out infinite',
        'glow-pulse': 'glowPulse 3s ease-in-out infinite',
        'hero-float': 'heroFloat 5s ease-in-out infinite',
        'rotate-slow': 'rotateSlow 20s linear infinite',
        'bounce-subtle': 'bounceSubtle 2s ease-in-out infinite',
      },
      keyframes: {
        fadeIn: { from: { opacity: '0' }, to: { opacity: '1' } },
        slideUp: { from: { opacity: '0', transform: 'translateY(16px)' }, to: { opacity: '1', transform: 'translateY(0)' } },
        slideDown: { from: { opacity: '0', transform: 'translateY(-12px)' }, to: { opacity: '1', transform: 'translateY(0)' } },
        scaleIn: { from: { opacity: '0', transform: 'scale(0.96)' }, to: { opacity: '1', transform: 'scale(1)' } },
        popIn: { from: { opacity: '0', transform: 'scale(0.9) translateY(8px)' }, to: { opacity: '1', transform: 'scale(1) translateY(0)' } },
        alarmRing: {
          '0%, 100%': { boxShadow: '0 0 0 0 rgba(255,255,255,0.35)' },
          '50%': { boxShadow: '0 0 0 18px rgba(255,255,255,0)' },
        },
        alarmBell: {
          '0%, 100%': { transform: 'rotate(-12deg)' },
          '50%': { transform: 'rotate(12deg)' },
        },
        pulseSoft: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.55' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-12px)' },
        },
        shimmer: {
          from: { backgroundPosition: '-200% 0' },
          to: { backgroundPosition: '200% 0' },
        },
        progressStripes: {
          from: { backgroundPosition: '1rem 0' },
          to: { backgroundPosition: '0 0' },
        },
        rotate3d: {
          '0%': { transform: 'perspective(800px) rotateY(0deg) rotateX(0deg)' },
          '25%': { transform: 'perspective(800px) rotateY(5deg) rotateX(3deg)' },
          '50%': { transform: 'perspective(800px) rotateY(0deg) rotateX(0deg)' },
          '75%': { transform: 'perspective(800px) rotateY(-5deg) rotateX(-3deg)' },
          '100%': { transform: 'perspective(800px) rotateY(0deg) rotateX(0deg)' },
        },
        tilt3d: {
          '0%, 100%': { transform: 'perspective(600px) rotateX(0deg) rotateY(0deg) scale(1)' },
          '50%': { transform: 'perspective(600px) rotateX(2deg) rotateY(3deg) scale(1.02)' },
        },
        glowPulse: {
          '0%, 100%': { boxShadow: '0 0 30px rgba(37,99,235,0.3), 0 0 60px rgba(139,92,246,0.15)' },
          '50%': { boxShadow: '0 0 50px rgba(37,99,235,0.5), 0 0 80px rgba(139,92,246,0.3)' },
        },
        heroFloat: {
          '0%, 100%': { transform: 'translateY(0) translateX(0) rotate(0deg)' },
          '33%': { transform: 'translateY(-10px) translateX(5px) rotate(1deg)' },
          '66%': { transform: 'translateY(-5px) translateX(-3px) rotate(-0.5deg)' },
        },
        rotateSlow: {
          from: { transform: 'rotate(0deg)' },
          to: { transform: 'rotate(360deg)' },
        },
        bounceSubtle: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-6px)' },
        },
      },
      perspective: {
        '800': '800px',
        '1000': '1000px',
        '1200': '1200px',
      },
      transformStyle: {
        'preserve-3d': 'preserve-3d',
      },
    },
  },
  plugins: [],
}
