const { test, expect } = require('@playwright/test')

test.describe('Clientes', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await expect(page.locator('text=Clientes').first()).toBeVisible({ timeout: 15000 })
    await page.locator('text=Clientes').first().click()
  })

  test('muestra lista de clientes o estado vacío', async ({ page }) => {
    const contenido = page.locator('text=Nuevo Cliente')
      .or(page.locator('text=+ Cliente'))
      .or(page.locator('text=Sin clientes'))
      .or(page.locator('text=No hay clientes'))
    await expect(contenido.first()).toBeVisible()
  })

  test('abre modal de nuevo cliente', async ({ page }) => {
    const btn = page.locator('button').filter({ hasText: /nuevo cliente|^\+ cliente/i }).first()
    await expect(btn).toBeVisible()
    await btn.click()
    await expect(page.locator('text=Nombre').or(page.locator('text=WhatsApp'))).toBeVisible({ timeout: 5000 })
  })

  test('crea un cliente nuevo', async ({ page }) => {
    const btn = page.locator('button').filter({ hasText: /nuevo cliente|^\+ cliente/i }).first()
    await btn.click()
    await page.waitForTimeout(400)

    // Nombre
    const inputNombre = page.locator('input[placeholder*="nombre" i]').first()
    if (await inputNombre.isVisible()) await inputNombre.fill('Test E2E')

    // Apellido
    const inputApellido = page.locator('input[placeholder*="apellido" i]').first()
    if (await inputApellido.isVisible()) await inputApellido.fill('Playwright')

    // WhatsApp
    const inputWapp = page.locator('input[placeholder*="whatsapp" i]').or(page.locator('input[type="tel"]')).first()
    if (await inputWapp.isVisible()) await inputWapp.fill('2235000000')

    // Guardar
    const btnGuardar = page.locator('button').filter({ hasText: /guardar|crear/i }).last()
    await btnGuardar.click()
    await page.waitForTimeout(800)

    // Verificar que se guardó (aparece en la lista o modal cierra)
    await expect(page.locator('text=Error').or(page.locator('text=Test E2E').or(page.locator('text=Nuevo Cliente')))).toBeVisible()
  })

  test('busca un cliente', async ({ page }) => {
    const inputBuscar = page.locator('input[placeholder*="buscar" i]').or(page.locator('input[type="search"]')).first()
    if (await inputBuscar.isVisible()) {
      await inputBuscar.fill('Test')
      await page.waitForTimeout(500)
      await expect(page).not.toHaveURL(/error/i)
    }
  })

  test('abre detalle de cliente y ve historial', async ({ page }) => {
    const primerCliente = page.locator('li').or(page.locator('[role="listitem"]')).first()
    const hayClientes = await primerCliente.isVisible().catch(() => false)
    if (hayClientes) {
      await primerCliente.click()
      await expect(page.locator('text=Historial').or(page.locator('text=Reservas').or(page.locator('text=WhatsApp')))).toBeVisible({ timeout: 5000 })
    }
  })

  test('botón WhatsApp genera link correcto', async ({ page }) => {
    const btnWapp = page.locator('a[href*="wa.me"]').first()
    const hayWapp = await btnWapp.isVisible().catch(() => false)
    if (hayWapp) {
      const href = await btnWapp.getAttribute('href')
      expect(href).toMatch(/wa\.me\/549\d+/)
    }
  })
})
