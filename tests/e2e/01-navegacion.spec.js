const { test, expect } = require('@playwright/test')

test.describe('Navegación general', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await expect(page.locator('text=Reservas').or(page.locator('text=Inicio'))).toBeVisible({ timeout: 15000 })
  })

  test('carga el dashboard de inicio', async ({ page }) => {
    await expect(page).toHaveTitle(/Quincho|Eventos/i)
    // Debe mostrar algún contenido del dashboard
    const dashboard = page.locator('text=Próximas').or(page.locator('text=Hoy')).or(page.locator('text=Reservas'))
    await expect(dashboard.first()).toBeVisible()
  })

  test('navega a Reservas', async ({ page }) => {
    await page.locator('text=Reservas').first().click()
    await expect(page.locator('text=Nueva Reserva').or(page.locator('text=+ Reserva').or(page.locator('button').filter({ hasText: /reserva/i })))).toBeVisible()
  })

  test('navega a Calendario', async ({ page }) => {
    await page.locator('text=Calendario').first().click()
    // El calendario muestra el mes actual
    const meses = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']
    const mesVisible = page.locator(`text=/${meses.join('|')}/`)
    await expect(mesVisible.first()).toBeVisible()
  })

  test('navega a Clientes', async ({ page }) => {
    await page.locator('text=Clientes').first().click()
    await expect(page.locator('text=Nuevo Cliente').or(page.locator('text=+ Cliente')).or(page.locator('text=Buscar'))).toBeVisible()
  })

  test('navega a Gastos', async ({ page }) => {
    await page.locator('text=Gastos').first().click()
    await expect(page.locator('text=Nuevo Gasto').or(page.locator('text=+ Gasto')).or(page.locator('text=Sin gastos'))).toBeVisible()
  })

  test('navega a Reportes', async ({ page }) => {
    await page.locator('text=Reportes').first().click()
    await expect(page.locator('text=Ingresos').or(page.locator('text=Ganancia').or(page.locator('text=Reporte')))).toBeVisible()
  })

  test('navega a Recordatorios', async ({ page }) => {
    await page.locator('text=Recordatorios').first().click()
    await expect(page.locator('text=Nuevo Recordatorio').or(page.locator('text=Sin recordatorios')).or(page.locator('text=Hoy'))).toBeVisible()
  })

  test('navega a Configuración', async ({ page }) => {
    await page.locator('text=Config').or(page.locator('text=Configuración')).first().click()
    await expect(page.locator('text=Espacios').or(page.locator('text=Precios').or(page.locator('text=Servicios')))).toBeVisible()
  })
})
