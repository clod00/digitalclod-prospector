/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: '#080C14',
        surface: '#0F1829',
        'surface-2': '#162035',
        border: '#1E2D47',
        accent: '#3B82F6',
        'accent-hover': '#2563EB',
        amber: '#F59E0B',
        'amber-dim': '#D97706',
        success: '#10B981',
        danger: '#EF4444',
        muted: '#6B7280',
        'text-primary': '#F1F5F9',
        'text-secondary': '#94A3B8',
      },
      fontFamily: {
        sans: ['"DM Sans"', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
