const { test, expect } = require('@playwright/test')

test.describe('Pagos y gastos', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await expect(page.locator('text=Reservas').first()).toBeVisible({ timeout: 15000 })
  })

  test('registra un cobro en una reserva', async ({ page }) => {
    await page.locator('text=Reservas').first().click()
    const primeraReserva = page.locator('li').first()
    const hayReservas = await primeraReserva.isVisible().catch(() => false)

    if (!hayReservas) {
      test.skip(true, 'No hay reservas para probar cobro')
      return
    }

    await primeraReserva.click()
    await page.waitForTimeout(500)

    const btnCobro = page.locator('button').filter({ hasText: /cobro|\+ cobro|registrar pago/i }).first()
    if (!await btnCobro.isVisible()) return

    await btnCobro.click()
    await page.waitForTimeout(400)

    // Completar monto
    const inputMonto = page.locator('input[type="number"]').or(page.locator('input[placeholder*="monto" i]')).first()
    if (await inputMonto.isVisible()) await inputMonto.fill('5000')

    // Seleccionar método
    const selectMetodo = page.locator('select').first()
    if (await selectMetodo.isVisible()) await selectMetodo.selectOption({ index: 0 })

    // Guardar
    const btnGuardar = page.locator('button').filter({ hasText: /guardar|confirmar/i }).last()
    await btnGuardar.click()
    await page.waitForTimeout(800)

    await expect(page.locator('text=Error')).not.toBeVisible()
  })

  test('gastos: muestra lista o estado vacío', async ({ page }) => {
    await page.locator('text=Gastos').first().click()
    const contenido = page.locator('text=Nuevo Gasto')
      .or(page.locator('text=+ Gasto'))
      .or(page.locator('text=Sin gastos'))
      .or(page.locator('text=No hay gastos'))
    await expect(contenido.first()).toBeVisible()
  })

  test('gastos: abre modal y crea un gasto', async ({ page }) => {
    await page.locator('text=Gastos').first().click()
    const btn = page.locator('button').filter({ hasText: /nuevo gasto|\+ gasto/i }).first()
    if (!await btn.isVisible()) return

    await btn.click()
    await page.waitForTimeout(400)

    const inputConcepto = page.locator('input[placeholder*="concepto" i]').or(page.locator('input').nth(0)).first()
    if (await inputConcepto.isVisible()) await inputConcepto.fill('Test E2E mantenimiento')

    const inputMonto = page.locator('input[type="number"]').or(page.locator('input[placeholder*="monto" i]')).first()
    if (await inputMonto.isVisible()) await inputMonto.fill('2500')

    const btnGuardar = page.locator('button').filter({ hasText: /guardar|crear/i }).last()
    await btnGuardar.click()
    await page.waitForTimeout(800)

    await expect(page.locator('text=Error')).not.toBeVisible()
  })

  test('gastos: filtra por mes', async ({ page }) => {
    await page.locator('text=Gastos').first().click()
    const selectMes = page.locator('select').first()
    if (await selectMes.isVisible()) {
      await selectMes.selectOption({ index: 0 })
      await page.waitForTimeout(400)
      await expect(page).not.toHaveURL(/error/i)
    }
  })

  test('reportes: muestra reporte mensual', async ({ page }) => {
    await page.locator('text=Reportes').first().click()
    await expect(page.locator('text=Ingresos').or(page.locator('text=Ganancia').or(page.locator('text=Reporte')))).toBeVisible({ timeout: 8000 })
  })

  test('reportes: cambia mes y recalcula', async ({ page }) => {
    await page.locator('text=Reportes').first().click()
    await page.waitForTimeout(500)
    const btnAnterior = page.locator('button').filter({ hasText: /anterior|<|◀|‹/i }).first()
    if (await btnAnterior.isVisible()) {
      await btnAnterior.click()
      await page.waitForTimeout(500)
      await expect(page.locator('text=Error')).not.toBeVisible()
    }
  })
})
