import type { Config } from 'tailwindcss';

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: '#3D7EFF',
        'brand-deep': '#2F66DB',
        'brand-soft': '#EAF1FF',
      },
    },
  },
  plugins: [],
} satisfies Config;
