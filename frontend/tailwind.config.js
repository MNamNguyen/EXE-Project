/** @type {import('tailwindcss').Config} */

// Màu lấy từ biến CSS trong src/index.css (một chỗ cho cả bản sáng lẫn tối).
// Màu nào cần độ mờ kiểu `bg-foreground/5` thì khai dạng kênh `--x-rgb`, vì Tailwind v3
// chỉ ghép được `<alpha-value>` vào rgb(), không ghép được vào một mã hex có sẵn.
const v = (name) => `var(--${name})`;
const ch = (name) => `rgb(var(--${name}-rgb) / <alpha-value>)`;

export default {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: ch('primary'),
          hover: v('primary-hover'),
          foreground: ch('primary-foreground'),
          light: v('primary-light'),
        },
        background: { DEFAULT: v('background'), hover: v('background-hover') },
        surface: { DEFAULT: v('surface'), hover: v('surface-hover'), overlay: v('surface-overlay') },
        'item-hover': v('item-hover'),
        foreground: ch('foreground'),
        muted: ch('muted'),
        border: { DEFAULT: v('border'), strong: v('border-strong') },
        'chart-fill': v('chart-fill'),
        secondary: { DEFAULT: v('secondary'), hover: v('secondary-hover') },
        'button-hover': v('button-hover'),
        danger: { DEFAULT: v('danger'), bg: v('danger-bg'), 'bg-hover': v('danger-bg-hover') },
        error: {
          DEFAULT: ch('error'),
          text: v('error-text'),
          bg: v('error-bg'),
          border: v('error-border'),
          strong: v('error-strong'),
        },
        success: { DEFAULT: v('success'), bg: v('success-bg') },
        warning: { DEFAULT: v('warning'), bg: v('warning-bg') },
        neutral: { DEFAULT: v('neutral'), bg: v('neutral-bg') },
        info: { DEFAULT: v('info'), bg: v('info-bg') },
        'cat-violet': { DEFAULT: v('cat-violet'), bg: v('cat-violet-bg') },
        'cat-teal': { DEFAULT: v('cat-teal'), bg: v('cat-teal-bg') },
        'cat-pink': { DEFAULT: v('cat-pink'), bg: v('cat-pink-bg') },
      },
      borderColor: { focus: v('border-focus') },
      ringColor: { focus: v('ring-focus') },
      fontFamily: {
        sans: ['var(--app-font)'],
      },
      opacity: { 4: '0.04', 8: '0.08', 13: '0.13', 16: '0.16' },
      boxShadow: {
        popover: v('elevation-popover'),
        modal: v('elevation-modal'),
        'segment-track': v('shadow-segment-track'),
        'segment-thumb': v('shadow-segment-thumb'),
      },
      transitionTimingFunction: {
        // Đường cong "sheet" cho panel trượt (500ms vào / 350ms ra)
        sheet: 'cubic-bezier(0.32, 0.72, 0, 1)',
      },
    },
  },
  plugins: [],
};
