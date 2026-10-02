import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { fileURLToPath, URL } from 'node:url'

export default defineConfig({
  plugins: [vue()],

  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),

      /**
       * 关键：本项目所有组件都用「运行时 template 字符串」而非 .vue 单文件组件，
       * 因此必须使用带编译器的完整版 Vue。
       * 默认会解析到 vue/dist/vue.runtime.esm-bundler.js（无编译器），运行时报
       * "Component provided template option but runtime compilation is not supported"。
       */
      vue: 'vue/dist/vue.esm-bundler.js',
    },
  },

  /** 与 esm-bundler 构建配套的编译期开关，消除 feature flag 警告 */
  define: {
    __VUE_OPTIONS_API__: 'true',
    __VUE_PROD_DEVTOOLS__: 'false',
    __VUE_PROD_HYDRATION_MISMATCH_DETAILS__: 'false',
  },

  server: {
    port: 5173,
    host: '127.0.0.1',
    // 同源代理，规避开发期跨域与 OPTIONS 预检
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:8080',
        changeOrigin: true,
      },
    },
  },

  build: {
    outDir: 'dist',
    chunkSizeWarningLimit: 1500,
  },
})
