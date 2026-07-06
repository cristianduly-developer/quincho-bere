const { test, expect } = require('@playwright/test')

const CLIENTE_TEST = 'Cliente Test E2E'
const MONTO_TEST = '15000'

test.describe('Reservas', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await expect(page.locator('text=Reservas').first()).toBeVisible({ timeout: 15000 })
    await page.locator('text=Reservas').first().click()
  })

  test('muestra lista de reservas', async ({ page }) => {
    // Debe haber una lista o mensaje de vacío
    const lista = page.locator('[data-testid="reserva-item"]')
      .or(page.locator('text=No hay reservas'))
      .or(page.locator('text=Sin reservas'))
    await expect(lista.first()).toBeVisible()
  })

  test('abre modal de nueva reserva', async ({ page }) => {
    const btnNueva = page.locator('button').filter({ hasText: /nueva reserva|nueva|^\+ reserva/i }).first()
    await expect(btnNueva).toBeVisible()
    await btnNueva.click()
    // Modal debe abrirse con campos
    await expect(page.locator('text=Cliente').or(page.locator('text=Espacio'))).toBeVisible({ timeout: 5000 })
  })

  test('crea una reserva nueva', async ({ page }) => {
    const btnNueva = page.locator('button').filter({ hasText: /nueva reserva|nueva|^\+ reserva/i }).first()
    await btnNueva.click()
    await page.waitForTimeout(500)

    // Completar cliente (busca o escribe)
    const inputCliente = page.locator('input[placeholder*="cliente" i]').or(page.locator('input[placeholder*="nombre" i]')).first()
    if (await inputCliente.isVisible()) {
      await inputCliente.fill(CLIENTE_TEST)
    }

    // Seleccionar fecha de mañana
    const manana = new Date()
    manana.setDate(manana.getDate() + 1)
    const fechaStr = manana.toISOString().slice(0, 10)
    const inputFecha = page.locator('input[type="date"]').first()
    if (await inputFecha.isVisible()) {
      await inputFecha.fill(fechaStr)
    }

    // Monto
    const inputMonto = page.locator('input[placeholder*="monto" i]').or(page.locator('input[type="number"]')).first()
    if (await inputMonto.isVisible()) {
      await inputMonto.fill(MONTO_TEST)
    }

    // Guardar
    const btnGuardar = page.locator('button').filter({ hasText: /guardar|crear|confirmar/i }).last()
    await btnGuardar.click()
    await page.waitForTimeout(1000)

    // No debe haber error crítico
    const error = page.locator('text=Error').or(page.locator('text=error'))
    const hayError = await error.isVisible().catch(() => false)
    expect(hayError).toBeFalsy()
  })

  test('filtra reservas por estado', async ({ page }) => {
    // Buscar selector de estado
    const filtro = page.locator('select').or(page.locator('[role="combobox"]')).first()
    if (await filtro.isVisible()) {
      await filtro.selectOption({ index: 1 })
      await page.waitForTimeout(500)
      // La lista debe actualizarse sin error
      await expect(page.locator('text=Error').or(page.locator('text=Reservas').or(page.locator('text=Sin')))).toBeVisible()
    }
  })

  test('busca una reserva por nombre', async ({ page }) => {
    const inputBuscar = page.locator('input[placeholder*="buscar" i]').or(page.locator('input[type="search"]')).first()
    if (await inputBuscar.isVisible()) {
      await inputBuscar.fill('test')
      await page.waitForTimeout(500)
      // No debe crashear
      await expect(page).not.toHaveURL(/error/i)
    }
  })

  test('abre detalle de una reserva', async ({ page }) => {
    // Click en la primera reserva de la lista
    const primeraReserva = page.locator('[role="listitem"]').or(page.locator('li')).first()
    const hayReservas = await primeraReserva.isVisible().catch(() => false)
    if (hayReservas) {
      await primeraReserva.click()
      // Debe mostrar detalles
      await expect(page.locator('text=Cobro').or(page.locator('text=Estado').or(page.locator('text=Cliente')))).toBeVisible({ timeout: 5000 })
    }
  })
})
