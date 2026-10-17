// 全仓共享的设计 tokens：颜色 / 字体 / 间距统一在这里定义
// 消费方在 tailwind.config 中以 presets: [sharedPreset] 引入
/** @type {import('tailwindcss').Config} */
module.exports = {
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: '#6366f1',
          dark: '#4f46e5',
          light: '#e0e7ff'
        }
      },
      fontFamily: {
        sans: [
          'Inter',
          'system-ui',
          '-apple-system',
          'Segoe UI',
          'PingFang SC',
          'Microsoft YaHei',
          'sans-serif'
        ]
      }
    }
  }
};
