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
    build: {
      // Use Terser with ASCII-only output to prevent UTF-8 encoding errors
      // This ensures all non-ASCII characters are properly escaped
      // See: https://github.com/PostHog/posthog-js/issues/2604
      minify: 'terser',
      terserOptions: {
        compress: {
          drop_console: false,
          drop_debugger: false,
          pure_funcs: [],
        },
        format: {
          ascii_only: true, // Critical: Forces ASCII-safe output
          comments: false,
        },
        mangle: {
          keep_classnames: true,
          keep_fnames: true,
        },
      },
    },
  }),
});
