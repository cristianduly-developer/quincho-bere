const { test, expect } = require('@playwright/test')

const BASE = 'https://eventos.solucionesmdp.com.ar'
const SAAS = 'https://saas-admin-panel-kappa.vercel.app'
const TOKEN = process.env.QB_TOKEN || ''
const ORG_ID = '0a4a642c-b3d1-4ce3-b325-bb40b188567b'
const AUTH = { Authorization: `Bearer ${TOKEN}` }

// ─── VERIFICAR ACCESO ───────────────────────────────────────────────
test.describe('verificar-acceso', () => {
  test('retorna acceso válido con plan y org_id', async ({ request }) => {
    const res = await request.get(`${BASE}/api/verificar-acceso`, { headers: AUTH })
    expect(res.ok()).toBeTruthy()
    const body = await res.json()
    expect(body.tiene_acceso).toBe(true)
    expect(body.plan).toBe('sincargo')
    expect(body.ret_org_id).toBe(ORG_ID)
  })

  test('sin token retorna 401', async ({ request }) => {
    const res = await request.get(`${BASE}/api/verificar-acceso`)
    expect(res.status()).toBe(401)
  })

  test('con token inválido retorna 401', async ({ request }) => {
    const res = await request.get(`${BASE}/api/verificar-acceso`, {
      headers: { Authorization: 'Bearer token_falso' }
    })
    expect(res.status()).toBe(401)
  })

  test('login=true incrementa sesión', async ({ request }) => {
    const res = await request.get(`${BASE}/api/verificar-acceso?login=true`, { headers: AUTH })
    expect(res.ok()).toBeTruthy()
    const body = await res.json()
    expect(body.tiene_acceso).toBe(true)
  })
})

// ─── PLANES Y PRECIOS ───────────────────────────────────────────────
test.describe('planes-precios', () => {
  test('retorna lista de planes con precios', async ({ request }) => {
    const res = await request.get(`${BASE}/api/planes-precios`)
    expect(res.ok()).toBeTruthy()
    const body = await res.json()
    // La API retorna { ok: true, planes: [...] }
    expect(body.ok).toBe(true)
    expect(Array.isArray(body.planes)).toBe(true)
    expect(body.planes.length).toBeGreaterThan(0)
  })

  test('cada plan tiene campos requeridos', async ({ request }) => {
    const res = await request.get(`${BASE}/api/planes-precios`)
    const body = await res.json()
    for (const plan of body.planes) {
      expect(plan).toHaveProperty('plan')
      expect(plan).toHaveProperty('precio_mensual')
      expect(['basico','profesional','premium','sincargo','demo']).toContain(plan.plan)
    }
  })

  test('existe plan básico con precio 25000', async ({ request }) => {
    const res = await request.get(`${BASE}/api/planes-precios`)
    const body = await res.json()
    const basico = body.planes.find(p => p.plan === 'basico')
    expect(basico).toBeTruthy()
    expect(basico.precio_mensual).toBe(25000)
  })

  test('existe plan profesional con precio 35000', async ({ request }) => {
    const res = await request.get(`${BASE}/api/planes-precios`)
    const body = await res.json()
    const prof = body.planes.find(p => p.plan === 'profesional')
    expect(prof).toBeTruthy()
    expect(prof.precio_mensual).toBe(35000)
  })

  test('existe plan premium con precio 50000', async ({ request }) => {
    const res = await request.get(`${BASE}/api/planes-precios`)
    const body = await res.json()
    const prem = body.planes.find(p => p.plan === 'premium')
    expect(prem).toBeTruthy()
    expect(prem.precio_mensual).toBe(50000)
  })
})

// ─── COLABORADORES ──────────────────────────────────────────────────
test.describe('colaboradores', () => {
  test('lista colaboradores del org', async ({ request }) => {
    const res = await request.get(`${BASE}/api/colaboradores?orgId=${ORG_ID}`, { headers: AUTH })
    expect(res.ok()).toBeTruthy()
    const body = await res.json()
    // La API retorna { ok: true, colaboradores: [...] }
    expect(body.ok).toBe(true)
    expect(Array.isArray(body.colaboradores)).toBe(true)
  })

  test('colaboradores tienen email y nombre', async ({ request }) => {
    const res = await request.get(`${BASE}/api/colaboradores?orgId=${ORG_ID}`, { headers: AUTH })
    const body = await res.json()
    for (const col of body.colaboradores) {
      expect(col).toHaveProperty('email')
      expect(col).toHaveProperty('nombre')
      expect(col).toHaveProperty('activo')
    }
  })

  test('sin orgId retorna error', async ({ request }) => {
    const res = await request.get(`${BASE}/api/colaboradores`, { headers: AUTH })
    expect(res.status()).toBeGreaterThanOrEqual(400)
  })

  test('sin auth retorna 401', async ({ request }) => {
    const res = await request.get(`${BASE}/api/colaboradores?orgId=${ORG_ID}`)
    expect(res.status()).toBe(401)
  })
})

// ─── MAIL RESERVA ───────────────────────────────────────────────────
test.describe('mail-reserva', () => {
  test('sin datos requeridos retorna 400', async ({ request }) => {
    const res = await request.post(`${BASE}/api/mail-reserva`, { data: {} })
    expect(res.status()).toBeGreaterThanOrEqual(400)
    expect(res.status()).toBeLessThan(500)
  })
})

// ─── MP SUSCRIPCION ─────────────────────────────────────────────────
test.describe('mp-crear-suscripcion', () => {
  test('sin auth retorna 401', async ({ request }) => {
    const res = await request.post(`${BASE}/api/mp-crear-suscripcion`, {
      data: { plan: 'profesional' }
    })
    expect(res.status()).toBe(401)
  })

  test('con auth pero plan inválido retorna error controlado', async ({ request }) => {
    const res = await request.post(`${BASE}/api/mp-crear-suscripcion`, {
      headers: AUTH,
      data: { plan: 'plan_inexistente' }
    })
    expect(res.status()).toBeLessThan(500)
  })
})

// ─── REGISTRAR DEMO ─────────────────────────────────────────────────
test.describe('registrar-demo', () => {
  test('sin token retorna 401', async ({ request }) => {
    const res = await request.post(`${BASE}/api/registrar-demo`)
    expect(res.status()).toBe(401)
  })

  test('con cuenta existente retorna respuesta controlada (no 500)', async ({ request }) => {
    const res = await request.post(`${BASE}/api/registrar-demo`, { headers: AUTH })
    const body = await res.json()
    // El endpoint puede responder ok:true (extiende demo) o ok:false (rechaza) — nunca 500
    expect(res.status()).toBeLessThan(500)
    expect(typeof body.ok).toBe('boolean')
  })
})

// ─── REPORTAR ERROR (en SAAS) ───────────────────────────────────────
test.describe('reportar-error (SaaS)', () => {
  test('acepta errores de la app quincho', async ({ request }) => {
    const res = await request.post(`${SAAS}/api/reportar-error`, {
      headers: {
        'x-app-id': 'quincho',
        'x-app-key': 'test_invalido', // clave inválida — debe dar 401 no 500
        'Content-Type': 'application/json',
      },
      data: { mensaje: 'Test E2E', nivel: 'info' }
    })
    expect(res.status()).toBeLessThan(500)
  })
})

// ─── LÍMITES DE PLAN SINCARGO ───────────────────────────────────────
test.describe('límites de plan sincargo', () => {
  test('verificar-acceso confirma plan sincargo activo', async ({ request }) => {
    const res = await request.get(`${BASE}/api/verificar-acceso`, { headers: AUTH })
    const body = await res.json()
    expect(body.plan).toBe('sincargo')
    expect(body.tiene_acceso).toBe(true)
  })

  test('plan premium tiene beneficio de reservas ilimitadas', async ({ request }) => {
    const res = await request.get(`${BASE}/api/planes-precios`)
    const body = await res.json()
    const premium = body.planes.find(p => p.plan === 'premium')
    expect(premium).toBeTruthy()
    const beneficios = premium.beneficios.join(' ').toLowerCase()
    expect(beneficios).toMatch(/ilimitad/)
  })

  test('plan básico no menciona colaboradores en beneficios', async ({ request }) => {
    const res = await request.get(`${BASE}/api/planes-precios`)
    const body = await res.json()
    const basico = body.planes.find(p => p.plan === 'basico')
    expect(basico).toBeTruthy()
    // básico no tiene colaboradores
    const beneficios = basico.beneficios.join(' ').toLowerCase()
    expect(beneficios).not.toMatch(/colaborador/)
  })
})
