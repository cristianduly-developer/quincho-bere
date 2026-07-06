const { test, expect } = require('@playwright/test')

test.describe('Configuración y espacios', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await expect(page.locator('text=Config').or(page.locator('text=Configuración')).first()).toBeVisible({ timeout: 15000 })
    await page.locator('text=Config').or(page.locator('text=Configuración')).first().click()
    await page.waitForTimeout(500)
  })

  test('muestra sección de precios base', async ({ page }) => {
    await expect(page.locator('text=Precio').or(page.locator('text=Turno').or(page.locator('text=Semana')))).toBeVisible()
  })

  test('muestra lista de espacios', async ({ page }) => {
    const espacios = page.locator('text=Espacios').first()
    if (await espacios.isVisible()) await espacios.click()
    await expect(page.locator('text=Espacio').or(page.locator('text=nuevo espacio').or(page.locator('text=Sin espacios')))).toBeVisible()
  })

  test('crea un espacio nuevo (si el plan lo permite)', async ({ page }) => {
    const plan = await page.evaluate(() => {
      try { return JSON.parse(localStorage.getItem('qb_user') || '{}').plan } catch { return 'demo' }
    })
    const limites = { basico: 1, profesional: 3, demo: 3, premium: 5, sincargo: 5 }
    const limite = limites[plan] || 3

    const espacios = page.locator('text=Espacios').first()
    if (await espacios.isVisible()) await espacios.click()

    const btnNuevo = page.locator('button').filter({ hasText: /nuevo espacio|agregar espacio/i }).first()
    if (!await btnNuevo.isVisible()) return

    await btnNuevo.click()
    await page.waitForTimeout(400)

    const inputNombre = page.locator('input[placeholder*="nombre" i]').or(page.locator('input').first()).first()
    if (await inputNombre.isVisible()) await inputNombre.fill(`Espacio Test ${Date.now()}`)

    const inputCapacidad = page.locator('input[type="number"]').first()
    if (await inputCapacidad.isVisible()) await inputCapacidad.fill('50')

    const btnGuardar = page.locator('button').filter({ hasText: /guardar|crear/i }).last()
    await btnGuardar.click()
    await page.waitForTimeout(800)

    await expect(page.locator('text=Error')).not.toBeVisible()
  })

  test('muestra catálogo de servicios extras', async ({ page }) => {
    const plan = await page.evaluate(() => {
      try { return JSON.parse(localStorage.getItem('qb_user') || '{}').plan } catch { return 'demo' }
    })
    test.skip(plan === 'basico', 'Plan básico no tiene servicios extras')

    const btnServicios = page.locator('text=Servicios').or(page.locator('text=Extras')).first()
    if (await btnServicios.isVisible()) await btnServicios.click()
    await expect(page.locator('text=Servicio').or(page.locator('text=Extra').or(page.locator('text=Precio')))).toBeVisible()
  })

  test('crea un bloqueo de fecha', async ({ page }) => {
    const btnBloqueo = page.locator('button').filter({ hasText: /bloqueo|bloquear/i }).first()
    if (!await btnBloqueo.isVisible()) return

    await btnBloqueo.click()
    await page.waitForTimeout(400)

    const manana = new Date()
    manana.setDate(manana.getDate() + 7)
    const inputFecha = page.locator('input[type="date"]').first()
    if (await inputFecha.isVisible()) await inputFecha.fill(manana.toISOString().slice(0, 10))

    const btnGuardar = page.locator('button').filter({ hasText: /guardar|bloquear/i }).last()
    await btnGuardar.click()
    await page.waitForTimeout(800)

    await expect(page.locator('text=Error')).not.toBeVisible()
  })
})

test.describe('Recordatorios', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    const plan = await page.evaluate(() => {
      try { return JSON.parse(localStorage.getItem('qb_user') || '{}').plan } catch { return null }
    })
    if (plan === 'basico') {
      test.skip(true, 'Plan básico no tiene recordatorios')
    }
    const tabRec = page.locator('text=Recordatorios')
    if (!await tabRec.isVisible()) test.skip(true, 'Tab recordatorios no visible')
    await tabRec.click()
    await page.waitForTimeout(400)
  })

  test('muestra tab de recordatorios', async ({ page }) => {
    await expect(page.locator('text=Recordatorio').or(page.locator('text=Hoy').or(page.locator('text=Próximos')))).toBeVisible()
  })

  test('crea un recordatorio', async ({ page }) => {
    const btnNuevo = page.locator('button').filter({ hasText: /nuevo recordatorio|agregar/i }).first()
    if (!await btnNuevo.isVisible()) return

    await btnNuevo.click()
    await page.waitForTimeout(400)

    // Tipo
    const selectTipo = page.locator('select').first()
    if (await selectTipo.isVisible()) await selectTipo.selectOption({ index: 1 })

    // Fecha
    const manana = new Date()
    manana.setDate(manana.getDate() + 1)
    const inputFecha = page.locator('input[type="date"]').first()
    if (await inputFecha.isVisible()) await inputFecha.fill(manana.toISOString().slice(0, 10))

    const btnGuardar = page.locator('button').filter({ hasText: /guardar|crear/i }).last()
    await btnGuardar.click()
    await page.waitForTimeout(800)

    await expect(page.locator('text=Error')).not.toBeVisible()
  })
})
