import type { Config } from 'tailwindcss';

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: '#3D7EFF',
        'brand-deep': '#2F66DB',
        'brand-soft': '#EAF1FF',
        surface: '#FFFFFF',
        canvas: '#F7F8FA',
        ink: '#26292E',
        muted: '#9AA0A8',
        line: '#F0F1F3',
        chip: '#F4F5F7',
        success: {
          DEFAULT: '#16A34A',
          soft: '#E8F6EE',
        },
        danger: {
          DEFAULT: '#E64545',
          soft: '#FDEDED',
        },
        warning: {
          DEFAULT: '#C77714',
          soft: '#FBF1E0',
        },
      },
    },
  },
  plugins: [],
} satisfies Config;
