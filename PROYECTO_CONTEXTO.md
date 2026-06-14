# El Quincho de Bere — Documentación Técnica Completa

> Mar del Plata, Argentina  
> Aplicación PWA de gestión de eventos y espacio

---

## ÍNDICE

1. [Descripción general](#1-descripción-general)
2. [Stack tecnológico](#2-stack-tecnológico)
3. [Estructura de archivos](#3-estructura-de-archivos)
4. [Base de datos — Tablas Supabase](#4-base-de-datos--tablas-supabase)
5. [Autenticación y Login](#5-autenticación-y-login)
6. [Control de acceso y roles](#6-control-de-acceso-y-roles)
7. [Flujo de datos](#7-flujo-de-datos)
8. [Módulos de la aplicación](#8-módulos-de-la-aplicación)
9. [Lógica de negocio crítica](#9-lógica-de-negocio-crítica)
10. [Reportes y Finanzas](#10-reportes-y-finanzas)
11. [Seguridad — medidas implementadas](#11-seguridad--medidas-implementadas)
12. [PWA y Service Worker](#12-pwa-y-service-worker)
13. [Problemas resueltos — historial](#13-problemas-resueltos--historial)
14. [Puntuación de auditoría técnica](#14-puntuación-de-auditoría-técnica)
15. [Pendientes y mejoras futuras](#15-pendientes-y-mejoras-futuras)

---

## 1. Descripción general

Aplicación web progresiva (PWA) para la gestión integral del espacio de eventos "El Quincho de Bere". Permite administrar reservas, clientes, pagos, gastos operativos, servicios extras, tareas internas, bloqueos de fechas y recordatorios.

- **URL producción:** https://quincho-bere.vercel.app
- **Repositorio:** GitHub → Vercel (deploy automático desde rama `main`)
- **Rama de trabajo:** `master` → merge a `main` para deploy
- **Archivo principal:** `App.jsx` (~3400 líneas, arquitectura monolítica single-file)

---

## 2. Stack tecnológico

| Capa | Tecnología |
|---|---|
| Frontend | React 18 + JSX |
| Backend / DB | Supabase (PostgreSQL) |
| Auth | Supabase Auth — Google OAuth con PKCE |
| Build | Vite 5 |
| PWA | vite-plugin-pwa + Workbox |
| Deploy | Vercel |
| Estilos | CSS-in-JS (inline styles, sin librería) |
| PDF | window.open + HTML/CSS generado en cliente |
| Dependencias | `@supabase/supabase-js` (npm), `react`, `react-dom` |
| Dev | `@vitejs/plugin-react`, `sharp`, `vite-plugin-pwa` |

**Nota:** `recharts` fue removida (era unused, sumaba 38 paquetes innecesarios). Supabase se migró de CDN esm.sh a npm para eliminar dependencia externa en runtime.

---

## 3. Estructura de archivos

```
quincho-bere/
├── App.jsx              # Toda la lógica y UI (single-file architecture)
├── index.html           # Entry point
├── vite.config.js       # Config Vite + PWA + Workbox
├── package.json         # Dependencias
├── vercel.json          # Headers HTTP de seguridad
└── public/
    ├── icon-192.png
    ├── icon-512.png
    └── icon-512.svg
```

### Estructura interna de App.jsx

```
App.jsx
├── ErrorBoundary (class component)
├── CONSTANTS (STATUS, TURNOS, PAYMENT_METHODS, EXPENSE_CATS, DEFAULT_CONFIG...)
├── UTILS (genId, escHtml, fmtCurrency, fmtDate, clientName...)
├── SUPABASE CLIENT (createClient + wrapper sb{getAll, upsert, remove})
├── PDF HELPERS (printReserva, printRecibo, printReporte, buildDoc...)
├── UI COMPONENTS (AccesoDenegado, LogoSVG, modales, formularios...)
│   ├── GoogleLoginScreen
│   ├── SideMenu
│   ├── CalendarioView
│   ├── ReservasView
│   ├── ClientesView
│   ├── GastosView          ← envuelto en ErrorBoundary
│   ├── ReportesView        ← envuelto en ErrorBoundary
│   ├── ConfigView
│   ├── UsuariosView
│   └── ...otros modales
└── App() → export default   # Componente principal con todo el estado
```

---

## 4. Base de datos — Tablas Supabase

### Tablas principales

| Tabla | Descripción | Campos clave |
|---|---|---|
| `clientes` | Base de clientes | `id`, `nombre`, `apellido`, `whatsapp`, `email`, `localidad`, `notas_internas`, `creado_en` |
| `reservas` | Reservas de eventos | `id`, `cliente_id`, `recurso_id`, `fecha`, `turno`, `horario`, `horario_fin`, `cant_invitados`, `monto_pactado`, `estado`, `notas`, `creado_por`, `creado_en` |
| `pagos` | Cobros por reserva | `id`, `reserva_id`, `monto`, `fecha`, `metodo`, `notas`, `creado_por`, `comprobante` |
| `gastos` | Gastos operativos | `id`, `concepto`, `monto`, `fecha`, `categoria`, `metodo`, `creado_por` |
| `extras_reserva` | Servicios extras vinculados a reserva | `id`, `reserva_id`, `servicio_id`, `descripcion`, `cantidad`, `precio_historico` |
| `servicios_extras` | Catálogo de servicios disponibles | `id`, `descripcion`, `precio_actual`, `activo` |
| `recursos` | Espacios/salones | `id`, `nombre`, `capacidad_max` |
| `tareas` | Tareas operativas internas | `id`, `descripcion`, `estado`, `fecha_registro` |
| `bloqueos` | Fechas bloqueadas sin reserva | `id`, `fecha`, `turno`, `motivo`, `creado_por` |
| `recordatorios` | Alertas programadas | `id`, `reserva_id`, `cliente_id`, `tipo`, `nota`, `fecha_alerta`, `hora_alerta`, `estado` |
| `config` | Configuración de precios | `id="main"`, `precios` (JSON) |
| `usuarios` | Ficha del personal | `id`, `nombre`, `apellido`, `email`, `whatsapp`, `puesto`, `rol`, `estado`, `permiso_root`, `ver_finanzas`, `modificar_caja`, `gestion_operativa` |
| `perfiles_usuarios` | Control de acceso OAuth | `id`, `email`, `rol`, `activo`, `nombre` |

### Convención de nombres

- DB usa **snake_case** (`cliente_id`, `monto_pactado`)
- App usa **camelCase** (`clienteId`, `montoPactado`)
- El mapeo ocurre en el startup useEffect al leer los datos

### Estados de reserva

```
pendiente → senada → confirmada → finalizada
                  ↘ cancelada
```

| Estado | Color | Descripción |
|---|---|---|
| `pendiente` | Gris | Sin señal ni confirmación |
| `senada` | Azul | Con seña pagada |
| `confirmada` | Verde | Confirmada para el evento |
| `finalizada` | Azul oscuro | Evento pasado, cerrado |
| `cancelada` | Rojo | Cancelada |

### Turnos disponibles

| Turno | Horario | Descripción |
|---|---|---|
| `dia` | 11:00 – 17:00 | Turno día |
| `noche` | 19:00 – 23:59 | Turno tarde/noche |
| `completo` | 11:00 – 23:00 | Día completo |

### Precios por defecto (configurables)

```json
{
  "dia_semana": { "dia": 80000, "noche": 100000, "completo": 160000 },
  "dia_finde":  { "dia": 120000, "noche": 150000, "completo": 250000 }
}
```

### RLS (Row Level Security)

RLS está activo en Supabase. Las políticas controlan qué datos puede leer/escribir cada usuario autenticado.

---

## 5. Autenticación y Login

### Flujo completo de login (usuario nuevo)

```
Usuario hace clic "Iniciar sesión con Google"
    ↓
supabase.auth.signInWithOAuth({ provider: "google", redirectTo: "https://quincho-bere.vercel.app" })
    ↓
Google OAuth con PKCE (manejado por Supabase SDK)
    ↓
Redirect de vuelta a la app con access_token en el hash URL
    ↓
onAuthStateChange("SIGNED_IN") dispara handleUser(authUser)
    ↓
handleUser consulta: perfiles_usuarios WHERE email = ? AND activo = true
    ↓
[NO ENCONTRADO] → setError("no autorizada") + supabase.auth.signOut()
[ENCONTRADO]    → guarda en localStorage("qb_user") → onLogin(user) → App carga
    ↓
Hash OAuth limpiado de la URL (window.history.replaceState)
```

### Flujo de startup (app ya instalada, recarga)

```
App abre → startup useEffect
    ↓
PASO 1: supabase.auth.getSession()
    ↓
[Sin sesión Supabase] → borra localStorage → muestra GoogleLoginScreen
[Con sesión]          → continúa
    ↓
Verifica email en localStorage === email de sesión Supabase
[No coincide] → borra localStorage
    ↓
PASO 2: consulta perfiles_usuarios WHERE email = ? AND activo = true
[No encontrado / deshabilitado] → borra localStorage + signOut → login
[Encontrado]                    → setCurrentUser con rol actualizado
    ↓
PASO 3: carga 11 tablas en paralelo (Promise.all)
    ↓
setLoaded(true)
```

### Auto-logout por inactividad

- **Tiempo:** 30 minutos sin actividad
- **Implementación:** `lastActivityRef` (useRef) actualizado en cada interacción
- **Detección en background:** `document.addEventListener('visibilitychange')` — al volver a la app verifica si pasaron 30 min
- **Por qué visibilitychange:** los navegadores móviles suspenden `setInterval` cuando la pantalla está apagada o la app está en background

### Detección de sesión expirada

```js
supabase.auth.onAuthStateChange((event) => {
  if(event === "SIGNED_OUT") {
    // limpia localStorage + alerta al usuario
  }
});
```

### Logout manual

Limpia: Supabase session + `localStorage("qb_user")` + setCurrentUser(null)

---

## 6. Control de acceso y roles

### Roles

| Rol | Acceso |
|---|---|
| `Administrador` | Todo: Gastos, Reportes, Config, Usuarios, operativa completa |
| `Empleado` | Inicio, Calendario, Reservas, Clientes, Tareas |

### Variable `isAdmin`

```js
// Definida en el scope de App() — CRÍTICO que esté aquí
const isAdmin = currentUser?.rol === "Administrador";
```

### Permisos granulares (usuarios no-admin)

| Permiso | Campo en DB | Descripción |
|---|---|---|
| `verFinanzas` | `ver_finanzas` | Ver montos y pagos |
| `modificarCaja` | `modificar_caja` | Registrar/editar pagos |
| `gestionOperativa` | `gestion_operativa` | Gestión completa de reservas |
| `permisoRoot` | `permiso_root` | Acceso root (sin uso actual) |

### Tabs protegidas

```js
{tab==="gastos"   && (isAdmin ? <ErrorBoundary><GastosView/></ErrorBoundary>   : <AccesoDenegado/>)}
{tab==="reportes" && (isAdmin ? <ErrorBoundary><ReportesView/></ErrorBoundary> : <AccesoDenegado/>)}
{tab==="config"   && (isAdmin ? <ConfigView/>   : <AccesoDenegado/>)}
{tab==="usuarios" && (isAdmin ? <UsuariosView/> : <AccesoDenegado/>)}
```

### Datos protegidos

- `usuarios` y `perfiles_usuarios`: solo se cargan desde Supabase si `rol === "Administrador"`

---

## 7. Flujo de datos

### Lectura (startup)

11 queries en paralelo con `Promise.all`:
`clientes`, `reservas`, `pagos`, `gastos`, `recursos`, `extras_reserva`, `servicios_extras`, `tareas`, `usuarios` (solo admin), `bloqueos`, `recordatorios`

Luego en serie: `config` desde tabla `config` (para tener auth antes de leer precios).

### Escritura (optimistic updates)

```
Usuario hace cambio
    ↓
Estado local actualizado inmediatamente (optimistic)
    ↓
sb.upsert(tabla, datos)
    ↓
[Error] → rollback al estado anterior + alert al usuario
[OK]    → estado queda como estaba
```

**Advertencia técnica:** `saveR/saveP/saveG` hacen upsert de TODO el array, no solo el registro modificado. Hoy con pocas reservas es correcto; a futuro se debería migrar a updates individuales por ID.

### Wrapper `sb`

```js
const sb = {
  getAll(table)        → select("*").order("creado_en")
  upsert(table, rows)  → upsert(array)
  remove(table, id)    → delete().eq("id", id)
}
```

### Mapeo de campos

DB → App al leer (camelCase):
```js
// Ejemplo reservas:
{ id, clienteId: x.cliente_id, recursoId: x.recurso_id, fecha: x.fecha?.slice(0,10),
  turno, montoPactado: Number(x.monto_pactado), estado, ... }
```

App → DB al escribir (snake_case):
```js
// Ejemplo mapReserva:
{ id, cliente_id, recurso_id, fecha, turno, monto_pactado, estado, ... }
```

---

## 8. Módulos de la aplicación

### Inicio
- Dashboard con próximas reservas del día/semana
- Alertas de recordatorios activos
- Rating de eventos pasados sin calificar (ratingQueue)

### Calendario
- Vista mensual con reservas por día
- Click en día → lista de reservas del día (dayModal)
- Click en fecha libre → nueva reserva (pre-cargada con fecha)
- Indicadores visuales por estado y turno

### Reservas
- Lista paginada con filtros (estado, turno, texto)
- Detalle completo: cliente, extras, pagos, saldo
- Acciones: crear, editar, cancelar, finalizar
- Impresión: Ficha del evento (printReserva) + Recibo (printRecibo)
- Calificación post-evento (1-5 estrellas)

### Clientes
- CRUD completo
- Historial de reservas por cliente
- Búsqueda por nombre/teléfono/email

### Gastos (solo Administrador)
- CRUD de gastos operativos
- Categorías: Mantenimiento, Limpieza, Servicios, Insumos, Otros
- Filtro por mes

### Reportes (solo Administrador)
- Vista mensual: ingresos cobrados, gastos, ganancia neta
- Por cobrar (saldo pendiente de reservas activas)
- Gastos por categoría
- Exportar reporte PDF mensual (printReporte)

### Configuración (solo Administrador)
- Precios por tipo de día y turno (editables)
- Catálogo de servicios extras con precio actual
- Espacios/recursos disponibles
- Bloqueos de fechas

### Usuarios (solo Administrador)
- Gestión de perfiles del equipo
- Activar/desactivar acceso (`activo` en `perfiles_usuarios`)
- Asignación de permisos granulares
- **Nota:** PIN fue removido del sistema

### Tareas
- Lista de tareas operativas internas
- Estados: pendiente / completada

### Recordatorios
- Alertas programadas vinculadas a reservas o clientes
- Detección automática al abrir la app

---

## 9. Lógica de negocio crítica

### Auto-cierre de reservas

```js
// Corre al cargar (loaded=true) + cada minuto (checkTick)
// Usa REFS para evitar loop infinito (saveR actualiza estado → efecto re-corre → saveR → ...)
useEffect(() => {
  if(!loaded) return;
  const res = reservasRef.current;  // ← ref, no estado directo
  const toClose = res.filter(r => {
    if(!['confirmada','senada','pendiente'].includes(r.estado)) return false;
    if(r.fecha < todayStr) return true;  // fecha pasada
    if(r.fecha === todayStr && r.horarioFin && curTime >= r.horarioFin) return true;  // horario cumplido
    return false;
  });
  if(toClose.length > 0) saveR(res.map(r => toClose.some(x=>x.id===r.id) ? {...r, estado:'finalizada'} : r));
}, [loaded, checkTick]);
```

### Detección de conflictos de turno

```js
// Consulta directa a Supabase (no confía en estado local)
const {data:dbConflicts} = await supabase.from("reservas")
  .select("id,cliente_id,turno")  // ← turno incluido (bug previo: no estaba)
  .eq("fecha", data.fecha)
  .neq("estado","cancelada");
const conflict = dbConflicts?.find(r => r.turno===data.turno || r.turno==="completo" || data.turno==="completo");
```

### Guardas en pagos y extras

```js
// No se puede registrar pago en reserva cancelada/finalizada
const resCheck = reservas.find(r => r.id===data.reservaId);
if(resCheck && ['cancelada','finalizada'].includes(resCheck.estado)){
  alert("No se puede registrar un pago en una reserva " + resCheck.estado + ".");
  return;
}
```

### Cálculos financieros (columnas virtuales)

```js
const getTotalExtras = (rid, extrasReserva) => extrasReserva.filter(e=>e.reservaId===rid).reduce((s,e)=>s+(e.precioHistorico*e.cantidad),0);
const getTotalPagado = (rid, pagos)         => pagos.filter(p=>p.reservaId===rid).reduce((s,p)=>s+p.monto,0);
const getSaldo       = (res, extrasReserva, pagos) => (res.montoPactado + getTotalExtras(res.id,extrasReserva)) - getTotalPagado(res.id,pagos);
```

### Delete cascade de reservas

```js
// Elimina pagos y extras asociados en paralelo antes de eliminar la reserva
const [{error:ep},{error:ee}] = await Promise.all([
  supabase.from("pagos").delete().eq("reserva_id", id),
  supabase.from("extras_reserva").delete().eq("reserva_id", id),
]);
```

### Generación de IDs

```js
const genId = () => crypto.randomUUID();  // UUIDs únicos, sin dependencias
```

---

## 10. Reportes y Finanzas

### Reporte mensual (ReportesView)

Calcula para el mes seleccionado:

| Métrica | Cálculo |
|---|---|
| **Ingresos cobrados** | Suma de `pagos.monto` del mes |
| **Gastos operacionales** | Suma de `gastos.monto` del mes |
| **Ganancia neta** | Ingresos − Gastos |
| **Por cobrar** | Suma de saldos pendientes de reservas activas del mes |
| **Eventos activos** | Count de reservas confirmadas/señadas del mes |
| **Gastos por categoría** | Agrupación de gastos por `categoria` |

### PDF de reportes

```js
function printReporte(month, year, ingresos, gastos, ganancia, catData, confirmadas, porCobrar)
```
Genera HTML con CSS embebido, abre en nueva ventana para imprimir/guardar como PDF.

### PDF de reserva (Ficha de evento)

Incluye: cliente, evento (fecha/turno/horario/invitados), extras detallados, resumen de cobros, saldo pendiente/pagado.

### PDF de recibo

Comprobante formal de pago con: cliente, monto, método, fecha, firma prestador/cliente.

**Seguridad PDF:** todos los campos de usuario usan `escHtml()` para prevenir HTML injection.

---

## 11. Seguridad — medidas implementadas

### Autenticación

| Medida | Estado |
|---|---|
| Google OAuth con PKCE | ✅ |
| Triple verificación al startup (sesión + email + activo en DB) | ✅ |
| Verificación `activo=true` en login fresco (handleUser) | ✅ (fix 2025-06) |
| Auto-logout 30 min inactividad | ✅ |
| Detección background con `visibilitychange` | ✅ |
| Limpieza de hash OAuth en URL | ✅ |
| `onAuthStateChange` para sesión expirada | ✅ |

### Autorización

| Medida | Estado |
|---|---|
| RLS activo en Supabase | ✅ |
| Tabs admin-only bloqueadas en cliente | ✅ |
| `isAdmin` en scope correcto de App | ✅ (bug previo: estaba en SideMenu) |
| Datos sensibles (usuarios/perfiles) solo para admins | ✅ |
| Guardas en pagos/extras de reservas canceladas | ✅ |

### Inyección y XSS

| Medida | Estado |
|---|---|
| `escHtml()` en todos los campos de PDF | ✅ |
| Validación MIME type en uploads (JPG/PNG/WEBP/GIF/PDF) | ✅ |
| Extensión derivada del MIME, no del nombre del archivo | ✅ |
| `window.open` con null check + mensaje al usuario si bloqueado | ✅ |

### Headers HTTP (vercel.json)

```
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
X-XSS-Protection: 1; mode=block
Referrer-Policy: strict-origin-when-cross-origin
Strict-Transport-Security: max-age=31536000; includeSubDomains
Permissions-Policy: camera=(), microphone=(), geolocation=()
```

### Dependencias

- Supabase desde `npm` (no CDN externo) → sin riesgo de CDN compromise
- Sin dependencias de UI pesadas (recharts removida)

---

## 12. PWA y Service Worker

### vite.config.js

```js
workbox: {
  skipWaiting: true,      // nueva versión activa inmediatamente
  clientsClaim: true,     // toma control de todas las tabs abiertas
  cacheId: 'qb-v3',
  globPatterns: ['**/*.{js,css,html,ico,png,svg}'],
  runtimeCaching: [{
    urlPattern: /^https:\/\/pmohyepcqfvkwijmljee\.supabase\.co\/.*/i,
    handler: 'NetworkFirst',   // intenta red primero, cae a caché si offline
    options: { cacheName: 'supabase-cache-v3', networkTimeoutSeconds: 10 },
  }],
}
```

### Manifest PWA

- Nombre: "El Quincho de Bere"
- `display: standalone` (sin barra de navegador)
- `orientation: portrait`
- `theme_color: #C4602B` (naranja/marrón)
- Íconos: 192px y 512px

### Problema conocido con PWA

Los navegadores móviles cachean agresivamente. Si se deployó un fix y el usuario no ve los cambios, debe limpiar manualmente el caché del navegador. El `skipWaiting + clientsClaim` ayuda pero no elimina el problema 100%.

---

## 13. Problemas resueltos — historial

### Pantalla en blanco en Gastos/Reportes (solo móvil)

**Síntoma:** En PC funcionaba, en celular quedaba en blanco.  
**Causa raíz:** `isAdmin` estaba definido dentro del componente `SideMenu`, no en el scope de `App`. Al usarlo en `App` para renderizar condicional de tabs, era `undefined` → siempre `false` → siempre renderizaba `<AccesoDenegado/>`. El componente se renderizaba fuera del viewport visible (scroll arriba).  
**Fix:** Mover `const isAdmin = currentUser?.rol === "Administrador"` al body de `App()`.

### Auto-logout no disparaba en móvil

**Síntoma:** El usuario dejaba la app todo el día, volvía y seguía sin pedir login.  
**Causa raíz:** Los navegadores móviles suspenden `setInterval` cuando la pantalla está apagada o la app está en background. El timer de 30 min nunca llegaba.  
**Fix:** `document.addEventListener('visibilitychange')` — al volver a la app verifica si `Date.now() - lastActivityRef.current > INACTIVITY_MS` y hace logout si corresponde.

### Loop infinito en auto-cierre de reservas

**Síntoma:** La app enviaba requests infinitos a Supabase.  
**Causa raíz:** El useEffect de auto-cierre tenía `[reservas, recordatorios]` en el array de dependencias. `saveR()` actualiza el estado `reservas` → re-dispara el effect → saveR → ...  
**Fix:** Usar `reservasRef` y `recordatoriosRef` (useRef sincronizados con useEffect), y cambiar dependencias a `[loaded, checkTick]`.

### Conflicto de turnos no detectado

**Síntoma:** Se podían crear dos reservas el mismo día y turno.  
**Causa raíz:** La query de conflictos era `.select("id,cliente_id")` — sin el campo `turno`. Por eso `r.turno` era siempre `undefined`.  
**Fix:** `.select("id,cliente_id,turno")`.

### Usuario deshabilitado podía entrar (login fresco)

**Síntoma:** Un usuario con `activo=false` en Supabase podía hacer OAuth y entrar.  
**Causa raíz:** `handleUser` consultaba `perfiles_usuarios WHERE email = ?` sin `.eq("activo",true)`. El check de `activo=true` solo existía en la verificación de sesión existente (startup), no en el login inicial.  
**Fix:** Agregar `.eq("activo", true)` en la query de `handleUser` + mensaje de error actualizado.

### Supabase cargado desde CDN externo

**Síntoma (potencial):** Si esm.sh o el CDN fallaba, la app no cargaba.  
**Fix:** Migrar a `npm install @supabase/supabase-js` → bundleado con el build de Vite.

### Recharts incluida sin usar

**Síntoma:** Build pesado, 38 paquetes extra.  
**Fix:** Remover de `package.json`.

---

## 14. Puntuación de auditoría técnica

*Auditoría realizada en sesión de desarrollo (Junio 2025)*

| Área | Puntuación | Estado |
|---|---|---|
| **Integridad** | 7.5/10 | Bien — pendiente upsert masivo y audit trail |
| **Seguridad** | 8/10 | Bien — bug activo/true resuelto |
| **Flujo de datos** | 7/10 | Bien — config stale 1-2s, base64 en pagos |
| **Login** | 8.5/10 | Muy bien — triple verificación + visibilitychange |
| **Promedio** | **7.75/10** | |

---

## 15. Pendientes y mejoras futuras

### Técnico (a futuro, no urgente)

| Item | Prioridad | Detalle |
|---|---|---|
| Upsert masivo → update individual | Media | `saveR` hace upsert de TODAS las reservas cuando cambia una |
| Audit trail (`modificado_en`) | Baja | No hay registro de quién editó qué ni cuándo |
| FK constraints en Supabase | Baja | Configurar en el dashboard de Supabase, no en código |
| Base64 en pagos | Baja | Verificar si el bucket de Storage está configurado; si no, las fotos se guardan como base64 en DB |

### No se hará (decisión tomada)

- Redirect URL de OAuth en desarrollo: solo molesta en local, no afecta producción
- Config stale 1-2s: impacto nulo en uso real de un solo admin

---

## Datos de conexión Supabase

```
URL:  https://pmohyepcqfvkwijmljee.supabase.co
KEY:  sb_publishable_syUaThUY-PaE_8fNcR4e6w_azyDZryB  (publishable/anon key)
```

> La `anon key` es pública por diseño — la seguridad real está en las políticas RLS de Supabase, no en ocultar la key.

---

*Documento generado: Junio 2025*  
*App version: post-auditoría completa*
