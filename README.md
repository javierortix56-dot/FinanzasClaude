# Finanzas J&M (FinanzasClaude)

Aplicación de **finanzas personales compartidas** para dos usuarios (Javier y Mary), con soporte multi-moneda (ARS / COP / USD), **sincronización en tiempo real** sobre Supabase y una app móvil instalable como **PWA**. Está organizada como un **monorepo** con dos frontends independientes —uno mobile-first y uno de escritorio— que comparten un único paquete de lógica de negocio y apuntan a la misma base de datos.

> Todo lo que cargás en el celular aparece al instante en la web de escritorio, y viceversa.

---

## Tabla de contenidos

- [Descripción general](#descripción-general)
- [Características principales](#características-principales)
- [Stack tecnológico](#stack-tecnológico)
- [Arquitectura del monorepo](#arquitectura-del-monorepo)
- [Estructura del repositorio](#estructura-del-repositorio)
- [Instalación y desarrollo](#instalación-y-desarrollo)
- [Variables de entorno](#variables-de-entorno)
- [Modelo de datos](#modelo-de-datos)
- [Capa de datos y tiempo real](#capa-de-datos-y-tiempo-real)
- [Gestión de estado](#gestión-de-estado)
- [Multi-moneda](#multi-moneda)
- [Sistema de categorías](#sistema-de-categorías)
- [Patrimonio, snapshots y ahorro](#patrimonio-snapshots-y-ahorro)
- [App mobile — pantallas y flujos](#app-mobile--pantallas-y-flujos)
- [App desktop — pantallas y flujos](#app-desktop--pantallas-y-flujos)
- [PWA](#pwa)
- [Backup e importación](#backup-e-importación)
- [Despliegue](#despliegue)
- [Seguridad](#seguridad)
- [Notas de implementación](#notas-de-implementación)

---

## Descripción general

FinanzasClaude es un tracker financiero personal pensado para **dos personas que comparten sus finanzas**. Permite:

- Registrar **ingresos y egresos** en distintas monedas (ARS, COP, USD).
- **Asignar** cada egreso a un ingreso concreto para saber con qué plata se pagó cada cosa.
- Gestionar el **patrimonio** (activos y pasivos), con metas de ahorro e historial mensual de saldos.
- Visualizar **análisis** históricos: comparativas mes a mes, distribución por categoría y evolución a 6 meses.
- Definir **presupuestos** por categoría y mes.

La arquitectura es intencionalmente sencilla en cuanto a usuarios: **no hay login por persona**. Todos los datos comparten un mismo registro en Supabase y la autoría de cada movimiento se guarda en un campo (`creadoPor`). Esto hace que ambas personas vean siempre exactamente los mismos datos, sin fricción de cuentas ni permisos.

Hay **dos frontends** que consumen la misma base de datos:

| App | Pensada para | Puerto dev | Layout |
|---|---|---|---|
| **`apps/mobile`** | El día a día en el celular (PWA instalable) | `3000` | Mobile-first, ancho máx. 390px, navegación inferior + botón flotante |
| **`apps/desktop`** | Vista amplia en navegador de escritorio | `3001` | Sidebar + topbar, layout responsive con tablas |

Ambas comparten **`packages/core`** (`@finanzas/core`): tipos, capa de acceso a datos y stores de estado.

---

## Características principales

| Módulo | Funcionalidades |
|---|---|
| **Dashboard / Resumen** | Balance del mes, totales de ingresos y egresos en moneda base, conversión a USD, navegación entre meses, pills de tipos de cambio, modo privacidad (ocultar montos con blur) |
| **Movimientos** | CRUD completo, sub-pestañas ingreso/egreso, búsqueda, swipe para ejecutar / editar / eliminar / clonar, etiquetas y nota extendida, marcar como ejecutado |
| **Asignación** | Agrupación de egresos bajo el ingreso asignado, auto-asignación por fecha, selección múltiple, reasignación masiva y desasignación |
| **Patrimonio** | Activos y pasivos en USD, neto, metas de ahorro con barra de progreso, **snapshots mensuales** de saldo + aporte, gráfico apilado de aportes vs. revalorización |
| **Análisis** | Comparativa vs. mes anterior, donut por categoría con drill-down a subcategoría, gráfico de líneas a 6 meses (ingresos / egresos / balance), barras de presupuesto, pestaña Piloto (proyección) |
| **Ajustes** | Tipos de cambio con historial mensual, árbol de categorías editable (gasto e ingreso), tipos de activo/pasivo, **vínculos de ahorro**, acciones de mes (cerrar, clonar, recurrentes, borrar) y backup JSON |
| **Multi-moneda** | ARS, COP y USD con tasas manuales e historial por mes para cálculos históricos precisos |
| **Tiempo real** | Suscripciones de Supabase: cualquier cambio se refleja al instante en ambos dispositivos |
| **PWA** | Instalable en Android/iOS, service worker con cache de app-shell para lectura offline |

---

## Stack tecnológico

### Frontend (ambas apps)
- **Next.js 16.2.1** — App Router, React Server Components + Client Components, Turbopack
- **React 19.2.4**
- **TypeScript 5** — modo estricto (`strict: true`)
- **Tailwind CSS 4** — utility-first (vía `@tailwindcss/postcss`)
- **Radix UI** — primitivos accesibles (`dialog`, `dropdown-menu`, `tabs`, `toast`, `progress`, `label`, `separator`, `slot`)
- **class-variance-authority** + **clsx** + **tailwind-merge** — composición de clases (`cn()`)
- **lucide-react 0.577** — iconografía
- Gráficos hechos a mano en **SVG** (sin librerías de charting)

### Estado
- **Zustand 5.0.12** — un store por dominio, compartidos desde `@finanzas/core/store`

### Backend / Base de datos
- **Supabase** — PostgreSQL + suscripciones realtime (`@supabase/supabase-js 2.99`)

### Tooling
- **npm workspaces** (monorepo)
- **ESLint 9** + `eslint-config-next`
- **Vercel** para despliegue (un proyecto por app)

---

## Arquitectura del monorepo

```
┌──────────────────────────┐        ┌──────────────────────────┐
│   apps/mobile  (PWA)      │        │   apps/desktop  (web)     │
│   Next.js 16 · :3000      │        │   Next.js 16 · :3001      │
│   max-w 390px · bottom    │        │   sidebar + topbar        │
│   nav + FAB               │        │   tablas + responsive     │
└────────────┬─────────────┘        └─────────────┬────────────┘
             │   import @finanzas/core             │
             └──────────────┬──────────────────────┘
                            ▼
              ┌──────────────────────────────┐
              │   packages/core               │
              │   @finanzas/core              │
              │   types · lib · store         │
              │  (lógica de datos compartida) │
              └──────────────┬───────────────┘
                             │  @supabase/supabase-js (realtime)
                             ▼
              ┌──────────────────────────────┐
              │           Supabase            │
              │   PostgreSQL + Realtime       │
              │                               │
              │   movimientos · cuentas ·     │
              │   configuracion               │
              └──────────────────────────────┘
```

**Claves de la arquitectura:**

- El paquete **`@finanzas/core`** centraliza tipos TypeScript, la capa de acceso a Supabase (`lib/`) y los stores de Zustand (`store/`). **No se duplica** lógica entre apps: ambas importan del mismo paquete.
- Cada app declara `transpilePackages: ["@finanzas/core"]` y fija `turbopack.root` en la raíz del monorepo (ver `next.config.ts`), para que Next compile el paquete compartido directamente desde el código fuente TS.
- Ambas apps se conectan a la **misma base Supabase**, por lo que comparten datos en tiempo real. Un alta o edición en el celular dispara una actualización en la web de escritorio en el acto (y viceversa) gracias a las suscripciones `postgres_changes`.

---

## Estructura del repositorio

```
FinanzasClaude/
├── package.json                  # Raíz del monorepo (workspaces + scripts)
├── apps/
│   ├── mobile/                   # App móvil (PWA) — finanzas-jm
│   │   ├── next.config.ts        # transpilePackages + headers de seguridad + sw
│   │   ├── components.json       # Config shadcn/ui
│   │   ├── vercel.json
│   │   ├── public/
│   │   │   ├── sw.js              # Service worker (cache app-shell)
│   │   │   └── icon-*.png         # Iconos PWA (192, 512, maskable)
│   │   ├── scripts/
│   │   │   └── generate-icons.mjs # Generación de iconos
│   │   └── src/
│   │       ├── app/
│   │       │   ├── (app)/         # Rutas con layout de navegación inferior
│   │       │   │   ├── layout.tsx     # Bottom nav + FAB + suscripciones globales
│   │       │   │   ├── dashboard/     # Resumen + Movimientos + Asignación
│   │       │   │   ├── patrimonio/    # Activos, pasivos, snapshots, metas
│   │       │   │   ├── analisis/      # Histórico + Piloto
│   │       │   │   └── ajustes/       # Configuración
│   │       │   ├── layout.tsx     # Root layout (AuthProvider + SW registrar)
│   │       │   ├── page.tsx       # Redirige a /dashboard
│   │       │   ├── manifest.ts    # Manifiesto PWA
│   │       │   └── globals.css
│   │       └── components/
│   │           ├── transactions/ # TransactionModal, TAccountView, lista, swipe
│   │           ├── assignment/   # AssignmentTab, AssignmentGroup, ReassignModal
│   │           ├── patrimonio/   # AssetCard, AssetModal, SnapshotModal, chart
│   │           ├── analisis/     # HistoricoTab, PilotoTab, donuts, líneas, budget
│   │           ├── ajustes/      # CategoryModal
│   │           ├── ui/           # Button, Input, Toast
│   │           ├── AuthProvider.tsx
│   │           └── ServiceWorkerRegistrar.tsx
│   │
│   └── desktop/                  # App de escritorio — finanzas-jm-desktop
│       ├── next.config.ts        # transpilePackages + headers de seguridad
│       ├── vercel.json
│       └── src/
│           ├── app/
│           │   ├── (app)/         # Layout con sidebar + topbar
│           │   │   ├── layout.tsx
│           │   │   ├── dashboard/
│           │   │   ├── movimientos/
│           │   │   ├── asignaciones/
│           │   │   ├── cuentas/
│           │   │   ├── analisis/
│           │   │   └── ajustes/
│           │   ├── layout.tsx
│           │   └── page.tsx       # Redirige a /dashboard
│           └── components/
│               ├── shell/         # Sidebar, Topbar
│               ├── ui/            # Button, Card, Input, Modal, Badge, Toast
│               ├── modals/        # TransactionModal, AssetModal
│               ├── charts/        # Donut, LineChart (SVG)
│               ├── DataProvider.tsx
│               └── MoneyText.tsx
│
├── packages/
│   └── core/                     # @finanzas/core (lógica compartida)
│       ├── package.json          # exports: ./types, ./lib/*, ./store/*
│       ├── types/index.ts        # Tipos TypeScript globales
│       ├── lib/
│       │   ├── supabase.ts        # Cliente Supabase + SHARED_UUID
│       │   ├── transactions.ts    # CRUD + realtime + clonar/recurrentes
│       │   ├── assets.ts          # CRUD + realtime + snapshots
│       │   ├── settings.ts        # CRUD + realtime + migraciones
│       │   ├── budgets.ts         # Presupuestos (en configuracion.app_settings)
│       │   ├── analytics.ts       # Queries históricas multi-mes
│       │   ├── currency.ts        # Conversión multi-moneda
│       │   ├── constants.ts       # Categorías default, usuarios, formateadores
│       │   ├── backup.ts          # Export/import JSON
│       │   └── utils.ts           # cn()
│       └── store/                # Stores Zustand (auth, tx, settings, assets, budgets, ui)
│
├── finanzas-jm-spec.md           # Especificación original v2.0 (histórica — ver notas)
├── AGENTS.md / CLAUDE.md         # Notas para agentes de código
└── README.md
```

---

## Instalación y desarrollo

### Requisitos previos
- **Node.js 20+**
- **npm** (el repo usa npm workspaces)
- Un proyecto de **Supabase** con las tablas creadas (ver [Modelo de datos](#modelo-de-datos))

### Instalación

Desde la **raíz del monorepo**, una sola vez:

```bash
npm install
```

Esto instala las dependencias de las dos apps y del paquete `@finanzas/core` y enlaza los workspaces entre sí.

### Scripts (raíz del monorepo)

| Script | Qué hace |
|---|---|
| `npm run dev:mobile` | Levanta la app móvil en `http://localhost:3000` |
| `npm run dev:desktop` | Levanta la app de escritorio en `http://localhost:3001` |
| `npm run build:mobile` | Build de producción de la app móvil |
| `npm run build:desktop` | Build de producción de la app de escritorio |
| `npm run lint` | Corre ESLint en todos los workspaces que lo tengan |

> También podés trabajar dentro de cada app: `npm run dev --workspace apps/mobile`, etc.

### Desarrollo en paralelo

Para ver la sincronización en tiempo real, abrí ambas en dos terminales:

```bash
npm run dev:mobile    # terminal 1 → :3000
npm run dev:desktop   # terminal 2 → :3001
```

Cargá un movimiento en una y miralo aparecer en la otra.

---

## Variables de entorno

Cada app necesita las credenciales de Supabase. Creá un `.env.local` **dentro de cada app** (`apps/mobile/.env.local` y `apps/desktop/.env.local`) con:

```env
NEXT_PUBLIC_SUPABASE_URL=https://<tu-proyecto>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<tu-anon-key>
```

> ⚠️ Tienen que ser **exactamente las mismas** en ambas apps para que vean los mismos datos.

Si no se definen, el cliente usa valores `placeholder` y la app levanta igual (pero sin datos reales), útil para inspeccionar la UI. Las variables están expuestas al navegador por el prefijo `NEXT_PUBLIC_`, así que usá siempre la **anon key** (nunca la `service_role`), protegida por Row Level Security en Supabase.

---

## Modelo de datos

El código de dominio usa nombres en **español** (`tipo`, `monto`, `moneda`, …); la base de datos usa columnas en inglés. La capa de `lib/` traduce entre ambos mundos (funciones `rowToX` / `xToRow`).

### Tipos TypeScript (`packages/core/types/index.ts`)

```ts
type Currency = 'ARS' | 'COP' | 'USD'
type TransactionType = 'ingreso' | 'egreso'

interface Transaction {
  id?: string
  userId: string
  tipo: TransactionType
  monto: number
  moneda: Currency
  categoria: string
  descripcion: string
  nota: string
  tags: string[]
  fecha: { toDate: () => Date }   // shim de compatibilidad (estilo Firestore)
  ejecutado: boolean
  asignadoA: string | null         // id del ingreso al que se asignó el egreso
  creadoPor: string                // 'javier' | 'mary' | 'shared'
  recurrente?: boolean
  ahorroAssetId?: string | null    // activo de ahorro vinculado
}

interface AssetSnapshot {
  month: string   // 'YYYY-MM'
  aporte: number  // aporte/retiro neto del mes (+ aporte, − retiro)
  saldo: number   // saldo al cierre del mes
}

interface Asset {
  id?: string
  userId: string
  nombre: string
  tipo: string                       // 'Banco' | 'Efectivo' | 'Cripto' | 'Inversiones' | 'Ahorro' | …
  clase: 'activo' | 'pasivo'
  moneda: Currency
  saldo: number                      // saldo actual
  fechaAlta: { toDate: () => Date }
  metaObjetivo: number | null        // meta de ahorro
  metaMoneda: string | null
  snapshots: AssetSnapshot[]         // historial mensual
}

interface Settings {
  tipoCambio: { ARS_USD: number; COP_USD: number }
  historialTipoCambio: ExchangeRateRecord[]   // { mes, ARS_USD, COP_USD }
  categoriasGasto: CategoryGroup[]
  categoriasIngreso: CategoryGroup[]
  tiposActivo: string[]
  tiposPasivo: string[]
  mesesCerrados?: string[]
  ahorroLinks?: { categoriaId: string; assetId: string }[]
}

interface Budget {
  id?: string
  userId: string
  categoria: string
  mes: string      // 'YYYY-MM'
  limite: number
  moneda: string
}
```

### Tablas de Supabase

Toda la información vive en **tres tablas**. El `user_id` es siempre un UUID compartido fijo (`SHARED_UUID = 00000000-0000-0000-0000-000000000000`); la autoría individual se guarda dentro del JSON `children.creadoPor`.

#### `movimientos` (transacciones)

| Columna | Tipo | Mapea a / Notas |
|---|---|---|
| `id` | uuid | `id` |
| `user_id` | uuid | UUID compartido |
| `type` | text | `tipo` — acepta `'ingreso'/'egreso'` (nuevo) o `'inc'/'exp'` (legacy) |
| `amount` | numeric | `monto` |
| `orig_amt` | numeric | Monto original (compat. con datos pre-convertidos de la migración) |
| `currency` | text | `moneda` |
| `category` | text | `categoria` |
| `description` | text | `descripcion` |
| `executed` | bool | `ejecutado` |
| `date` | date | `fecha` |
| `deleted_at` | timestamptz | Soft delete (`null` = activo) |
| `children` | jsonb | `{ nota, tags, asignadoA, creadoPor, recurrente, ahorroAssetId }` |

#### `cuentas` (activos y pasivos)

| Columna | Tipo | Mapea a |
|---|---|---|
| `id` | uuid | `id` |
| `user_id` | uuid | UUID compartido |
| `name` | text | `nombre` |
| `kind` | text | `tipo` |
| `type` | text | `clase` (`activo` / `pasivo`) |
| `currency` | text | `moneda` |
| `init_bal` | numeric | `saldo` (saldo actual; se actualiza con el snapshot más reciente) |
| `date_created` | date | `fechaAlta` |
| `meta_objetivo` | numeric | `metaObjetivo` |
| `meta_moneda` | text | `metaMoneda` |
| `snapshots` | jsonb | `snapshots[]` — array `{ month, aporte, saldo }` |

#### `configuracion` (una única fila compartida)

| Columna | Tipo | Contiene |
|---|---|---|
| `user_id` | uuid | UUID compartido (clave de upsert) |
| `app_settings` | jsonb | `{ tipoCambio, ahorroLinks, budgets[] }` |
| `monthly_rates` | jsonb | `historialTipoCambio` (tasas por mes) |
| `transaction_cats` | jsonb | **`categoriasGasto`** (árbol de gasto) |
| `categories` | jsonb | **`categoriasIngreso`** (árbol de ingreso) |
| `account_cats` | jsonb | `{ tiposActivo, tiposPasivo }` |
| `closed_months` | jsonb | `mesesCerrados` (formato `YYYY-MM`) |

> ⚠️ **Dato importante:** los **presupuestos** (`Budget[]`) no tienen tabla propia: se guardan dentro de `configuracion.app_settings.budgets`. Y ojo con el mapeo de categorías: la columna `transaction_cats` guarda los **gastos** y la columna `categories` guarda los **ingresos**.

---

## Capa de datos y tiempo real

Toda la comunicación con Supabase está aislada en `packages/core/lib/`. Cada dominio expone una función `subscribeToX(callback)` con el mismo patrón:

1. Hace un **fetch inicial** y llama al `callback` con los datos.
2. Abre un **canal realtime** (`postgres_changes`) sobre la tabla.
3. Ante cualquier cambio, vuelve a hacer fetch y notifica.
4. Devuelve una **función de cleanup** que cierra el canal (se llama en el `return` de un `useEffect`).

| Módulo | Funciones destacadas |
|---|---|
| `transactions.ts` | `subscribeToTransactions(month)`, `addTransaction`, `updateTransaction`, `deleteTransaction` (soft delete), `markEjecutado`, `cloneMonthTransactions`, `createRecurringTransactions`, `cloneTransactionToMonth`, `moveTransactionToMonth`, `countMonthTransactions`, `deleteMonthTransactions` |
| `assets.ts` | `subscribeToAssets`, `addAsset`, `updateAsset`, `deleteAsset`, `upsertSnapshot`, `adjustAssetSaldo` |
| `settings.ts` | `getOrInitSettings`, `subscribeToSettings`, `updateSettings`, `DEFAULT_SETTINGS` (+ migración de formato viejo) |
| `budgets.ts` | `subscribeToBudgets(mes)`, `upsertBudget`, `deleteBudget` |
| `analytics.ts` | `fetchMonthTransactions(month)`, `fetchLastNMonths(n, upToMonth)` |
| `backup.ts` | `exportBackup`, `downloadBackup`, `importBackup`, `parseBackupFile` |
| `currency.ts` | `toUSD`, `toBase` |

Las consultas filtran siempre por rango de fechas del mes y por `deleted_at IS NULL`, de modo que los movimientos borrados nunca aparecen pero quedan recuperables.

---

## Gestión de estado

Zustand con un store por dominio (en `packages/core/store/`). Las suscripciones de Supabase se conectan a los stores desde los _providers_ de cada app (`AuthProvider` en mobile, `DataProvider` en desktop).

| Store | Contenido | Suscripción |
|---|---|---|
| `useAuthStore` | `monedaBase: Currency` | — |
| `useTransactionStore` | `transactions[]`, `currentMonth`, `isLoading`, `prevMonth()`, `nextMonth()` | `subscribeToTransactions(month)` |
| `useSettingsStore` | `settings`, `hideAmounts`, `toggleHideAmounts()` | `subscribeToSettings()` |
| `useAssetStore` | `assets[]`, `isLoading` | `subscribeToAssets()` |
| `useBudgetStore` | `budgets[]`, `getBudget(categoria)` | `subscribeToBudgets(month)` |
| `useUIStore` | estado del modal de transacción, `editingTransaction`, `toast` | — |

`currentMonth` es la pieza central: cambiar de mes re-dispara las suscripciones de transacciones y presupuestos, y recalcula todos los totales.

---

## Multi-moneda

La app maneja tres monedas: **ARS** (peso argentino), **COP** (peso colombiano) y **USD** (dólar).

- Los tipos de cambio se cargan **manualmente** en Ajustes (1 USD = X ARS, 1 USD = Y COP).
- Se guarda un **historial mensual** (`historialTipoCambio` / columna `monthly_rates`) para que los análisis históricos usen la tasa correcta de cada período.
- Cada usuario elige su **moneda base** (`monedaBase`), en la que se muestran los totales.

Conversión (`packages/core/lib/currency.ts`):

```ts
// Cualquier moneda → USD
toUSD(monto: number, moneda: Currency, settings: Settings): number

// USD → moneda base (o cualquier moneda destino)
toBase(monto: number, moneda: Currency, base: Currency, settings: Settings): number
```

Las conversiones son **seguras**: si una tasa es `0`, negativa o `NaN`, devuelven `0` en lugar de `Infinity`/`NaN`, así la UI no se rompe cuando todavía no configuraste los tipos de cambio.

---

## Sistema de categorías

Las categorías se organizan en una jerarquía de **dos niveles** (grupo → subcategorías), separadas entre **gasto** e **ingreso**. Cada categoría tiene `id`, `nombre`, `color` y un flag `activa`.

Defaults (en `packages/core/lib/constants.ts`):

```
GASTO
├── Esenciales   → Vivienda · Alimentación · Salud · Educación · Servicios
├── Variable     → Transporte · Entretenimiento · Ropa
├── Financiero   → Ahorro
└── Otros        → Otros

INGRESO
├── Laboral      → Sueldo · Freelance
├── Pasivo       → Inversiones
└── Otros        → Regalo · Otros
```

Desde **Ajustes** se pueden crear, editar y borrar grupos y subcategorías, cambiar su color y activarlas/desactivarlas. Todo se persiste en `configuracion` (`transaction_cats` para gasto, `categories` para ingreso).

> **Compatibilidad:** la capa de settings migra automáticamente el formato viejo (lista plana `Category[]`) al nuevo formato de árbol (`CategoryGroup[]`), convirtiendo cada categoría antigua en un grupo sin subcategorías.

---

## Patrimonio, snapshots y ahorro

El módulo de patrimonio va más allá de un saldo estático:

### Snapshots mensuales

Cada activo guarda un array de **snapshots** (`{ month, aporte, saldo }`). Desde el `SnapshotModal` registrás, para un mes:

- **Aporte / retiro**: cuánto pusiste (+) o sacaste (−) ese mes.
- **Saldo al cierre**: cuánto vale el activo al final del mes.

Con eso la app calcula la **revalorización** del mes:

```
revalorización = saldo_cierre − saldo_mes_anterior − aporte
```

Es decir, separa cuánto creció tu patrimonio por **poner plata nueva** vs. cuánto por **rendimiento** (revalorización de inversiones, cripto, etc.). El gráfico de patrimonio es un **gráfico de barras apiladas en USD** que muestra, mes a mes (últimos 6), aportes acumulados vs. revalorización acumulada. `upsertSnapshot` además sincroniza el `saldo` "actual" del activo con el del snapshot más reciente.

### Metas de ahorro

Cada cuenta puede tener una `metaObjetivo` (+ `metaMoneda`). Se muestra como barra de progreso hacia el objetivo.

### Vínculos de ahorro (`ahorroLinks`)

Desde Ajustes → **Vínculos de ahorro** podés conectar una **categoría de gasto** con un **activo**. La idea: cuando registrás un gasto de esa categoría (por ejemplo "Ahorro"), ese movimiento puede impactar el saldo del activo vinculado. `adjustAssetSaldo()` aplica el delta de forma atómica sobre el snapshot del mes, lo que permite **revertir con exactitud** el saldo si después editás o borrás la transacción vinculada.

---

## App mobile — pantallas y flujos

Mobile-first, ancho máximo **390px**, color primario **`#534AB7`** (violeta). El layout `(app)` monta una **barra de navegación inferior** con 4 destinos y un **botón flotante (FAB)** central que abre el modal de nueva transacción. El `TransactionModal` y el `Toast` están montados una sola vez a nivel layout.

Navegación inferior: **Resumen** · **Cuentas** · (FAB **+**) · **Análisis** · **Ajustes**.

### Resumen (`/dashboard`)
Header compacto con avatar J&M, navegación de mes (◀ ▶), pills con los tipos de cambio actuales y botón de **ojo** para ocultar/mostrar montos (blur, modo privacidad). Debajo, el balance del mes en moneda base + ingresos / egresos / conversión a USD.

- **Pestaña Movimientos:** buscador + `TAccountView` con sub-pestañas Ingresos/Egresos. Cada ítem soporta **swipe**: izquierda para ejecutar/desejecutar, derecha para menú de acciones (editar, clonar a otro mes, eliminar).
- **Pestaña Asignación:** agrupa los egresos bajo el ingreso al que fueron asignados. Permite **auto-asignar** (distribuye egresos al ingreso más cercano por fecha), **selección múltiple + reasignación masiva** y **desasignar**. Grupo "Sin asignar" destacado.

### Nueva transacción (FAB)
Modal para crear/editar: tipo (ingreso/egreso), categoría del árbol, monto + moneda, fecha, marcar ejecutado, asignar a un ingreso (egresos), vincular a activo de ahorro (ingresos), etiquetas y nota.

### Cuentas / Patrimonio (`/patrimonio`)
Tres tarjetas resumen (**Activos · Pasivos · Neto** en USD), gráfico apilado de aportes vs. revalorización, pestañas **Activos / Pasivos**, tarjetas de cuenta con acción "actualizar mes" (snapshot) y modal de alta/edición. Metas de ahorro con barra de progreso.

### Análisis (`/analisis`)
- **Histórico:** comparativa vs. mes anterior (balance, ingresos, egresos, nº de transacciones con su variación), donuts por categoría con **drill-down** a subcategoría, gráfico de líneas a 6 meses (ingresos/egresos/balance) y barras de progreso de presupuesto.
- **Piloto:** proyección del mes en curso (en desarrollo).

### Ajustes (`/ajustes`)
Secciones colapsables:
- **Tipos de cambio** (con historial de los últimos meses).
- **Categorías de Gasto** y **de Ingreso** (árbol editable: grupos y subcategorías, color, activar/desactivar).
- **Tipos de activo / pasivo** (listas editables).
- **Vínculos de ahorro** (categoría → activo).
- **Acciones del mes:** *Cerrar mes* (congela el tipo de cambio en el historial), *Clonar mes al siguiente*, *Crear recurrentes*, *Borrar mes*. Clonar y recurrentes **piden confirmación** si el mes destino ya tiene movimientos, para evitar duplicados.
- **Importar / Exportar** backup JSON.

---

## App desktop — pantallas y flujos

Pensada para pantalla grande: **sidebar** persistente (se oculta en pantallas chicas, `< lg`) + **topbar**. El `DataProvider` inicializa settings y abre las suscripciones de transacciones, activos y presupuestos. Comparte exactamente los mismos datos que la app móvil.

Rutas (sidebar):

| Ruta | Contenido |
|---|---|
| `/dashboard` | KPIs del mes (balance, ingresos, egresos, patrimonio), top categorías, movimientos recientes |
| `/movimientos` | Tabla con búsqueda y filtros (tipo / categoría / persona / pendientes), CRUD, marcar ejecutado |
| `/asignaciones` | Egresos agrupados por ingreso, selección múltiple, reasignar y auto-asignar |
| `/cuentas` | Activos / pasivos en USD, metas de ahorro con barra de progreso |
| `/analisis` | Comparación con mes anterior, donut por categoría, evolución a 6 meses |
| `/ajustes` | Tipos de cambio, clonar mes, crear recurrentes, vista de categorías |

Incluye atajos como ocultar/mostrar montos y navegación de mes. Los gráficos (`Donut`, `LineChart`) están hechos en **SVG puro**, sin dependencias externas.

---

## PWA

La app **mobile** está configurada como Progressive Web App:

- **Manifiesto** (`apps/mobile/src/app/manifest.ts`): nombre "Finanzas J&M", `display: standalone`, orientación `portrait`, `theme_color: #10b981`, iconos 192/512 + maskable.
- **Service worker** (`apps/mobile/public/sw.js`, cache `finanzas-jm-v3`):
  - *install*: pre-cachea el app-shell (`/`, iconos).
  - *activate*: limpia caches viejas.
  - *fetch*: **network-first** para navegación (fallback al `/` cacheado) y **cache-first** para assets estáticos (`_next/static`, imágenes, fuentes, css/js). Sólo intercepta GET del mismo origen.
- **Registro** vía `ServiceWorkerRegistrar`.

Instalar: en Android, Chrome → menú → "Agregar a pantalla de inicio". En iOS, Safari → compartir → "Agregar a inicio".

---

## Backup e importación

Desde **Ajustes → Importar / Exportar** (app móvil):

**Exportar** genera `finanzas-backup-YYYY-MM-DD.json`:

```json
{
  "version": 2,
  "exportedAt": "ISO datetime",
  "userId": "shared",
  "transactions": [ /* ... */ ],
  "assets": [ /* incluye snapshots */ ],
  "budgets": [ /* ... */ ],
  "settings": { "tipoCambio": {…}, "historialTipoCambio": […],
                "categoriasGasto": […], "categoriasIngreso": […],
                "account_cats": {…}, "mesesCerrados": […] }
}
```

**Importar** lee el JSON y **agrega** los movimientos y cuentas a la base (convierte las fechas ISO a `date`). El archivo se valida antes de procesarse (debe tener `version` y un array `transactions`).

---

## Despliegue

Recomendado: **Vercel**, con **un proyecto por app** (ambos apuntando al mismo repo y a la misma base Supabase). Cada app trae su `vercel.json` (`framework: nextjs`, build/install estándar).

**App mobile:**
1. New Project → seleccioná el repo.
2. **Root Directory:** `apps/mobile`.
3. Variables de entorno: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`.

**App desktop:**
1. New Project (segundo proyecto) → mismo repo.
2. **Root Directory:** `apps/desktop`.
3. Las **mismas** variables de entorno (misma DB → datos sincronizados).

Cada push a la rama configurada redeploya la app correspondiente; la otra queda intacta en su propio dominio.

---

## Seguridad

Headers aplicados desde `next.config.ts`:

- **Ambas apps**, a todas las rutas:
  - `X-Content-Type-Options: nosniff`
  - `X-Frame-Options: DENY`
  - `Referrer-Policy: strict-origin-when-cross-origin`
- **Mobile**, sólo para `/sw.js`:
  - `Content-Type: application/javascript; charset=utf-8`
  - `Cache-Control: no-cache, no-store, must-revalidate`
  - `Content-Security-Policy: default-src 'self'; script-src 'self'`

A nivel de datos, las credenciales públicas son la **anon key** de Supabase; la protección real debe configurarse con **Row Level Security** en el proyecto Supabase.

---

## Notas de implementación

- **Modelo de usuario compartido:** todos los registros usan un mismo `user_id` (`SHARED_UUID`). No hay autenticación por persona; la autoría se guarda en `children.creadoPor` (`'javier'` | `'mary'`).
- **Soft deletes:** los movimientos no se borran físicamente; se setea `deleted_at`. Las queries siempre filtran `deleted_at IS NULL`.
- **Historial de tasas:** las tasas se guardan por mes (`monthly_rates`) para que los análisis históricos sean precisos aunque cambie la tasa actual. *Cerrar mes* congela la tasa vigente.
- **Recurrentes y clonado:** un movimiento marcado `recurrente` puede instanciarse en el mes siguiente; *clonar mes* copia todos los movimientos. Ambas operaciones resetean `ejecutado`/`asignadoA` y ajustan el día al último día válido del mes destino. Si el destino ya tiene movimientos, la UI pide confirmación para evitar duplicados.
- **Ajuste de saldo atómico:** `adjustAssetSaldo()` aplica un delta sobre el snapshot del mes, permitiendo revertir con exactitud el saldo de un activo al editar/eliminar una transacción de ahorro vinculada.
- **Migración desde Firebase:** el proyecto nació sobre Firebase/Firestore (ver `finanzas-jm-spec.md`) y migró a Supabase. Por eso la capa de datos tolera datos legacy: `type` puede venir como `'inc'`/`'exp'`, los montos pre-convertidos a ARS se detectan comparando `orig_amt` vs. `amount`, y el campo `fecha` mantiene un shim `{ toDate() }` al estilo Firestore. El `finanzas-jm-spec.md` es **histórico**: describe el diseño original (incluido Firebase Auth), no la implementación actual.
- **Sin librerías de charts:** donuts y gráficos de líneas/barras están dibujados a mano en SVG, lo que mantiene el bundle liviano.
```
