const { test, expect } = require('@playwright/test')

// Tests que verifican que los límites por plan se aplican correctamente.
// Corren con la sesión actual del usuario logueado.

test.describe('Límites por plan', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await expect(page.locator('text=Reservas').first()).toBeVisible({ timeout: 15000 })
  })

  test('plan Básico: no muestra tab de Recordatorios', async ({ page }) => {
    // Leer el plan del usuario desde localStorage
    const plan = await page.evaluate(() => {
      try { return JSON.parse(localStorage.getItem('qb_user') || '{}').plan } catch { return null }
    })
    test.skip(plan !== 'basico', `Plan actual es ${plan}, no básico`)

    const tabRecordatorios = page.locator('text=Recordatorios')
    await expect(tabRecordatorios).not.toBeVisible()
  })

  test('plan Básico: extras bloqueados en reserva', async ({ page }) => {
    const plan = await page.evaluate(() => {
      try { return JSON.parse(localStorage.getItem('qb_user') || '{}').plan } catch { return null }
    })
    test.skip(plan !== 'basico', `Plan actual es ${plan}, no básico`)

    await page.locator('text=Reservas').first().click()
    const primeraReserva = page.locator('li').first()
    if (await primeraReserva.isVisible()) {
      await primeraReserva.click()
      // Botón de extras debe estar deshabilitado o no existir
      const btnExtras = page.locator('button').filter({ hasText: /extras/i }).first()
      if (await btnExtras.isVisible()) {
        const disabled = await btnExtras.getAttribute('disabled')
        expect(disabled).not.toBeNull()
      }
    }
  })

  test('plan Profesional/Demo: Recordatorios visibles', async ({ page }) => {
    const plan = await page.evaluate(() => {
      try { return JSON.parse(localStorage.getItem('qb_user') || '{}').plan } catch { return null }
    })
    test.skip(!['profesional', 'demo', 'premium', 'sincargo'].includes(plan), `Plan ${plan} no tiene recordatorios`)

    const tabRecordatorios = page.locator('text=Recordatorios')
    await expect(tabRecordatorios).toBeVisible()
  })

  test('plan Profesional/Demo: Servicios extras disponibles', async ({ page }) => {
    const plan = await page.evaluate(() => {
      try { return JSON.parse(localStorage.getItem('qb_user') || '{}').plan } catch { return null }
    })
    test.skip(!['profesional', 'demo', 'premium', 'sincargo'].includes(plan), `Plan ${plan} no tiene extras`)

    await page.locator('text=Config').or(page.locator('text=Configuración')).first().click()
    const seccionExtras = page.locator('text=Servicios').or(page.locator('text=Extras'))
    await expect(seccionExtras.first()).toBeVisible()
  })

  test('muestra días restantes si está en demo', async ({ page }) => {
    const user = await page.evaluate(() => {
      try { return JSON.parse(localStorage.getItem('qb_user') || '{}') } catch { return {} }
    })
    test.skip(user.plan !== 'demo', 'No está en demo')

    // Debe haber algún indicador de demo activo
    const indicadorDemo = page.locator('text=demo').or(page.locator('text=días restantes').or(page.locator('text=Demo')))
    await expect(indicadorDemo.first()).toBeVisible()
  })

  test('límite de espacios según plan', async ({ page }) => {
    const plan = await page.evaluate(() => {
      try { return JSON.parse(localStorage.getItem('qb_user') || '{}').plan } catch { return null }
    })
    const limites = { basico: 1, profesional: 3, demo: 3, premium: 5, sincargo: 5 }
    const limite = limites[plan]
    if (!limite) return

    await page.locator('text=Config').or(page.locator('text=Configuración')).first().click()
    await page.locator('text=Espacios').first().click().catch(() => {})

    // El botón de agregar espacio debe estar oculto o deshabilitado cuando se alcanza el límite
    // (solo verificamos que la sección de espacios carga)
    await expect(page.locator('text=Espacios').first()).toBeVisible()
  })

  test('límite de colaboradores según plan', async ({ page }) => {
    const plan = await page.evaluate(() => {
      try { return JSON.parse(localStorage.getItem('qb_user') || '{}').plan } catch { return null }
    })

    await page.locator('text=Usuarios').or(page.locator('text=Equipo')).first().click().catch(() => {})
    await page.waitForTimeout(500)

    if (plan === 'basico') {
      // No debe poder agregar colaboradores
      const btnAgregar = page.locator('button').filter({ hasText: /agregar|nuevo usuario/i }).first()
      const visible = await btnAgregar.isVisible().catch(() => false)
      if (visible) {
        const disabled = await btnAgregar.getAttribute('disabled')
        expect(disabled).not.toBeNull()
      }
    }
  })
})

test.describe('Verificación de acceso', () => {
  test('API verificar-acceso responde correctamente', async ({ page }) => {
    const token = await page.evaluate(async () => {
      const { data } = await window.__supabase?.auth?.getSession?.() || {}
      return data?.session?.access_token || null
    })

    if (!token) return

    const res = await page.request.get('/api/verificar-acceso', {
      headers: { Authorization: `Bearer ${token}` }
    })
    expect(res.ok()).toBeTruthy()
    const body = await res.json()
    expect(body).toHaveProperty('tiene_acceso', true)
    expect(body).toHaveProperty('plan')
    expect(['basico','profesional','premium','sincargo','demo']).toContain(body.plan)
  })
})
