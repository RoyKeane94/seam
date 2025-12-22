/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    '../../**/*.{html,py,js}',
  ],
  theme: {
    extend: {
      colors: {
        'seam-bg': '#FAF8F5',
        'seam-surface': '#FFFFFF',
        'seam-text': '#2D2D2D',
        'seam-text-secondary': '#6B6B6B',
        'seam-navy': '#1E40AF',
        'seam-navy-dark': '#1E3A8A',
        'seam-border': '#E8E6E3',
        'seam-success': '#10B981',
        'seam-error': '#EF4444',
      },
      fontFamily: {
        sans: ['-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
      },
    },
  },
  plugins: [],
}

