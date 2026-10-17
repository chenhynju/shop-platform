import type { Config } from 'tailwindcss';
import sharedPreset from '@repo/config-tailwind';

const config: Config = {
  presets: [sharedPreset],
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    '../../packages/ui/src/**/*.{ts,tsx}'
  ]
};

export default config;
