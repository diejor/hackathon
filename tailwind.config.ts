import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './app/**/*.{ts,tsx}',
    './src/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        'tmo-magenta': '#E20074',
      },
    },
  },
  plugins: [],
};

export default config;
