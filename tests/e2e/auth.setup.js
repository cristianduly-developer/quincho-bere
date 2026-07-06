const { test: setup, expect } = require('@playwright/test')
const path = require('path')

const AUTH_FILE = path.join(__dirname, '.auth/user.json')

setup.use({ headless: false, launchOptions: { slowMo: 500 } })

setup('autenticar usuario', async ({ page }) => {
  setup.setTimeout(120000) // 2 minutos para que hagas login

  await page.goto('/')

  // Si ya hay sesión guardada y válida, salteamos el login
  const yaLogueado = await page.locator('text=Reservas').isVisible().catch(() => false)
  if (yaLogueado) {
    await page.context().storageState({ path: AUTH_FILE })
    return
  }

  // Esperar botón de Google y hacer click
  await expect(page.locator('text=Iniciar sesión con Google')).toBeVisible({ timeout: 15000 })

  await page.locator('text=Iniciar sesión con Google').click()

  // Esperar a que completes el login de Google (2 minutos)
  console.log('\n⚠️  Completá el login con Google en la ventana que se abrió.\n')
  await expect(page.locator('text=Reservas').or(page.locator('text=Inicio'))).toBeVisible({ timeout: 120000 })

  // Guardar sesión para reutilizar en todos los tests
  await page.context().storageState({ path: AUTH_FILE })
  console.log('✅ Sesión guardada.\n')
})
