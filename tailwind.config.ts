/** @type {import('tailwindcss').Config} */
const config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
      },
    },
  },
  plugins: [],
  safelist: [
    // Dynamic color classes for document types
    'bg-blue-50', 'bg-blue-100', 'bg-blue-600', 'bg-blue-700',
    'text-blue-600', 'text-blue-700', 'text-blue-900',
    'border-blue-400', 'border-blue-600',
    'from-blue-600', 'to-blue-700', 'from-blue-100', 'to-blue-200',
    'hover:bg-blue-200', 'hover:bg-blue-50',
    
    'bg-orange-50', 'bg-orange-100', 'bg-orange-600', 'bg-orange-700',
    'text-orange-600', 'text-orange-700', 'text-orange-900',
    'border-orange-400', 'border-orange-600',
    'from-orange-600', 'to-orange-700', 'from-orange-100', 'to-orange-200',
    'hover:bg-orange-200', 'hover:bg-orange-50',
    
    'bg-green-50', 'bg-green-100', 'bg-green-600', 'bg-green-700',
    'text-green-600', 'text-green-700', 'text-green-900',
    'border-green-400', 'border-green-600',
    'from-green-600', 'to-green-700', 'from-green-100', 'to-green-200',
    'hover:bg-green-200', 'hover:bg-green-50',
    
    'bg-gray-50', 'bg-gray-100', 'bg-gray-600', 'bg-gray-700',
    'text-gray-600', 'text-gray-700', 'text-gray-900',
    'border-gray-400', 'border-gray-600',
  ],
};

export default config;
