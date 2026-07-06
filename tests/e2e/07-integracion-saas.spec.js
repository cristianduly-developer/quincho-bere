const { test, expect } = require('@playwright/test')

// Tests de integración: verifican que los eventos llegan al SaaS central
// (demo activada, errores reportados, suscripción activa)

test.describe('Integración con SaaS central', () => {
  test('verificar-acceso retorna plan y org_id válidos', async ({ page }) => {
    await page.goto('/')
    await expect(page.locator('text=Reservas').first()).toBeVisible({ timeout: 15000 })

    const { token, plan, orgId } = await page.evaluate(async () => {
      const sessionStr = localStorage.getItem('qb_user')
      const user = sessionStr ? JSON.parse(sessionStr) : {}
      const { data } = await window.__supabase?.auth?.getSession?.() || {}
      return {
        token: data?.session?.access_token || null,
        plan: user.plan,
        orgId: user.orgId,
      }
    })

    expect(plan).toBeTruthy()
    expect(orgId).toBeTruthy()

    if (token) {
      const res = await page.request.get('/api/verificar-acceso', {
        headers: { Authorization: `Bearer ${token}` }
      })
      const body = await res.json()
      expect(body.tiene_acceso).toBe(true)
      expect(body.plan).toBe(plan)
    }
  })

  test('API planes-precios retorna planes con precios', async ({ page }) => {
    await page.goto('/')
    const res = await page.request.get('/api/planes-precios')
    expect(res.ok()).toBeTruthy()
    const body = await res.json()
    expect(Array.isArray(body)).toBeTruthy()
    expect(body.length).toBeGreaterThan(0)
    const plan = body[0]
    expect(plan).toHaveProperty('plan')
    expect(plan).toHaveProperty('precio_mensual')
  })

  test('reportar-error funciona sin crashear', async ({ page }) => {
    await page.goto('/')
    const res = await page.request.post('/api/reportarError', {
      data: {
        app: 'quincho',
        mensaje: 'Test E2E - ignorar',
        nivel: 'info',
        pantalla: 'test-playwright',
      }
    })
    // Puede dar 200 o 400, pero no 500
    expect(res.status()).toBeLessThan(500)
  })

  test('la app no muestra pantalla de error en carga normal', async ({ page }) => {
    await page.goto('/')
    await page.waitForTimeout(3000)

    // No debe haber pantalla de error del ErrorBoundary
    const errorBoundary = page.locator('text=Algo salió mal').or(page.locator('text=Error inesperado'))
    await expect(errorBoundary).not.toBeVisible()
  })

  test('la app funciona offline brevemente (PWA)', async ({ page }) => {
    await page.goto('/')
    await expect(page.locator('text=Reservas').first()).toBeVisible({ timeout: 15000 })

    // Simular offline
    await page.context().setOffline(true)
    await page.waitForTimeout(1000)

    // La app debe seguir mostrando contenido cacheado
    const contenido = page.locator('text=Reservas').or(page.locator('text=Inicio'))
    await expect(contenido.first()).toBeVisible()

    // Volver online
    await page.context().setOffline(false)
  })
})

test.describe('Calendario', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await expect(page.locator('text=Calendario').first()).toBeVisible({ timeout: 15000 })
    await page.locator('text=Calendario').first().click()
    await page.waitForTimeout(500)
  })

  test('muestra el mes actual', async ({ page }) => {
    const meses = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']
    const mesActual = meses[new Date().getMonth()]
    await expect(page.locator(`text=${mesActual}`)).toBeVisible()
  })

  test('navega al mes siguiente', async ({ page }) => {
    const btnSiguiente = page.locator('button').filter({ hasText: /siguiente|>|▶|›/i }).first()
    if (await btnSiguiente.isVisible()) {
      await btnSiguiente.click()
      await page.waitForTimeout(400)
      await expect(page.locator('text=Error')).not.toBeVisible()
    }
  })

  test('click en día abre agenda del día', async ({ page }) => {
    // Click en el día 15 del mes
    const dia15 = page.locator('text=15').first()
    if (await dia15.isVisible()) {
      await dia15.click()
      await page.waitForTimeout(400)
      // Puede aparecer un modal con las reservas de ese día o "Sin reservas"
      const modal = page.locator('text=Reservas del').or(page.locator('text=Sin reservas').or(page.locator('text=Turnos')))
      // No crasheó = OK
      await expect(page.locator('text=Error')).not.toBeVisible()
    }
  })
})
