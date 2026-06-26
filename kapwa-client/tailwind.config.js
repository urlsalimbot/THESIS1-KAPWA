export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: { DEFAULT: '#2E5C8A', dark: '#1E3D5C', light: '#E8F0F7' },
        surface: { DEFAULT: '#F9F9FD', white: '#FFFFFF' },
        border: '#E0E1E3',
        'text-primary': '#1A1A1A',
        'text-secondary': '#707070',
        'text-muted': '#6B7280',
        success: { bg: '#D4EDDA', text: '#155724' },
        warning: { bg: '#FFF3CD', text: '#856404' },
        info: { bg: '#D1ECF1', text: '#0C5460' },
        disbursed: { bg: '#E2E3E5', text: '#383D41' },
        closed: { bg: '#F5F5F5', text: '#707070' },
      },
      fontFamily: {
        heading: ['Plus Jakarta Sans', 'sans-serif'],
        body: ['Inter', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'sans-serif'],
      },
      boxShadow: {
        card: '0px 1px 2px 0px rgba(0, 0, 0, 0.05)',
      },
    },
  },
  plugins: [],
}
