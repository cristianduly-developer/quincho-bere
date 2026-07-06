const { defineConfig } = require('@playwright/test')

module.exports = defineConfig({
  testDir: './tests/api',
  timeout: 15000,
  reporter: [['html', { outputFolder: 'playwright-report-api', open: 'on-failure' }], ['list']],
  use: {
    baseURL: 'https://eventos.solucionesmdp.com.ar',
  },
})
