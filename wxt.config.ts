import { defineConfig } from 'wxt';
import tailwindcss from '@tailwindcss/vite';

// See https://wxt.dev/api/config.html
export default defineConfig({
  modules: ['@wxt-dev/module-vue'],
  manifest: {
    name: 'SDC Boost',
    description: 'Browser extension to enhance SDC.com with powerful modules and features',
    permissions: ['storage'],
    icons: {
      16: '/icon/16.png',
      32: '/icon/32.png',
      48: '/icon/48.png',
      96: '/icon/96.png',
      128: '/icon/128.png',
    },
  },
  vite: () => ({
    plugins: [tailwindcss()],
  }),
});
