/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#eff6ff',
          100: '#dbeafe',
          200: '#bfdbfe',
          300: '#93c5fd',
          400: '#60a5fa',
          500: '#3b82f6',
          600: '#1A6BFF',
          700: '#0052D4',
          800: '#003FAB',
          900: '#002F8A',
        },
        surface: '#F0F7FF',
        border: '#D6E4FF',
      },
      fontFamily: {
        sans: ['Inter', 'Be Vietnam Pro', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        card: '0 2px 16px 0 rgba(26, 107, 255, 0.08)',
        'card-hover': '0 8px 32px 0 rgba(26, 107, 255, 0.16)',
        glow: '0 0 20px rgba(26, 107, 255, 0.25)',
      },
      animation: {
        'fade-in': 'fadeIn 0.3s ease-out',
        'slide-up': 'slideUp 0.4s ease-out',
        'pulse-slow': 'pulse 3s ease-in-out infinite',
        'spin-slow': 'spin 3s linear infinite',
        'bounce-in': 'bounceIn 0.5s ease-out',
        'countdown': 'countdown 1s linear infinite',
      },
      keyframes: {
        fadeIn: { from: { opacity: 0 }, to: { opacity: 1 } },
        slideUp: { from: { opacity: 0, transform: 'translateY(16px)' }, to: { opacity: 1, transform: 'translateY(0)' } },
        bounceIn: {
          '0%': { opacity: 0, transform: 'scale(0.7)' },
          '70%': { transform: 'scale(1.05)' },
          '100%': { opacity: 1, transform: 'scale(1)' },
        },
      },
      backgroundImage: {
        'gradient-brand': 'linear-gradient(135deg, #1A6BFF 0%, #00A3FF 100%)',
        'gradient-brand-dark': 'linear-gradient(135deg, #0052D4 0%, #1A6BFF 100%)',
        'gradient-surface': 'linear-gradient(180deg, #F0F7FF 0%, #FFFFFF 100%)',
      },
    },
  },
  plugins: [],
};
