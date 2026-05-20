# FinanzasClaude

Tracker de finanzas personales compartido para dos usuarios (Javier y Mary). Soporta múltiples monedas (ARS, COP, USD), sincronización en tiempo real vía Supabase, y tiene dos interfaces: una app mobile PWA y un dashboard web desktop.

---

## Estructura del monorepo

```
FinanzasClaude/
├── apps/
│   ├── mobile/          # PWA Next.js — interfaz mobile (max-width 390px)
│   └── desktop/         # Dashboard web — interfaz desktop
└── packages/
    └── core/            # Lógica compartida (lib, store, types)
```

El monorepo usa **npm workspaces**. El paquete `@finanzas/core` es importado por ambas apps con path alias.

---

## Stack

| Capa | Tecnología |
|---|---|
| Framework | Next.js 16 (App Router) |
| UI | React 19 + TypeScript 5 + Tailwind CSS 4 |
| Estado | Zustand 5 |
| Base de datos | Supabase (PostgreSQL + Realtime) |
| Iconos | Lucide React |
| Deploy | Vercel (un proyecto por app) |

---

## Apps

### `apps/desktop`

Dashboard web de escritorio. Pantalla principal del uso diario.

**Rutas:**

| Ruta | Descripción |
|---|---|
| `/dashboard` | Resumen del mes: stats compactas, cuenta T editable, top categorías con drill-down |
| `/asignaciones` | Agrupa egresos bajo el ingreso al que están asignados |
| `/cuentas` | Activos, pasivos y patrimonio neto |
| `/analisis` | Comparativa histórica, donuts por categoría, gráfico lineal 6 meses |
| `/ajustes` | Tasas de cambio, árbol de categorías, acciones de mes, backup |
| `/movimientos` | Listado completo paginado (acceso por "Ver todos", no está en el nav) |

**Funcionalidades del dashboard:**
- Stats bar compacta: Balance / Ingresos / Egresos con delta vs mes anterior
- **Cuenta T** (Ingresos | Egresos): click en fila abre edición; barra de búsqueda inline; botones `+ Ingreso` / `+ Egreso`
- Egresos muestran chip del ingreso asignado cuando aplica
- Movimientos ejecutados aparecen tachados
- **Top categorías**: donut interactivo con click en segmento para drill al segundo nivel (subcategorías); tabs Egresos / Ingresos

### `apps/mobile`

PWA instalable en Android/iOS. Interfaz touch-first con navegación inferior y FAB central para crear transacciones.

---

## `packages/core`

Lógica compartida entre ambas apps.

```
packages/core/
├── lib/
│   ├── analytics.ts      # Queries históricas multi-mes
│   ├── assets.ts         # CRUD + suscripción cuentas
│   ├── backup.ts         # Export/import JSON
│   ├── budgets.ts        # CRUD presupuestos
│   ├── constants.ts      # Categorías default, CHART_PALETTE, helpers
│   ├── currency.ts       # Conversión multi-moneda (toBase)
│   ├── settings.ts       # CRUD + suscripción configuración
│   ├── supabase.ts       # Cliente Supabase singleton
│   ├── transactions.ts   # CRUD + suscripción movimientos
│   └── utils.ts          # cn() (clsx + tailwind-merge)
├── store/
│   ├── useAuthStore.ts         # monedaBase: Currency
│   ├── useAssetStore.ts        # assets[]
│   ├── useBudgetStore.ts       # budgets[]
│   ├── useSettingsStore.ts     # settings, hideAmounts
│   ├── useTransactionStore.ts  # currentMonth, transactions[]
│   └── useUIStore.ts           # modales, toasts
└── types/
    └── index.ts          # Transaction, Asset, Settings, Category, etc.
```

---

## Modelo de datos

### `Transaction`

```typescript
{
  id?: string
  userId: string            // UUID compartido fijo ("shared")
  tipo: 'ingreso' | 'egreso'
  monto: number
  moneda: 'ARS' | 'COP' | 'USD'
  categoria: string         // ID de subcategoría
  descripcion: string
  nota: string
  tags: string[]
  fecha: FechaCompat        // { toDate: () => Date }
  ejecutado: boolean        // true = confirmado/pagado
  asignadoA: string | null  // ID del ingreso al que se asigna este egreso
  creadoPor: string         // 'javier' | 'mary'
  recurrente?: boolean
  ahorroAssetId?: string | null
}
```

### `Asset` (cuentas)

```typescript
{
  id?: string
  userId: string
  nombre: string
  tipo: string              // 'banco' | 'efectivo' | 'cripto' | 'inversiones' | ...
  clase: 'activo' | 'pasivo'
  moneda: Currency
  saldo: number
  fechaAlta: FechaCompat
  metaObjetivo: number | null
  metaMoneda: string | null
  snapshots: AssetSnapshot[] // historial mensual de saldo
}
```

### `Settings` (configuración, 1 fila en Supabase)

```typescript
{
  tipoCambio: { ARS_USD: number; COP_USD: number }
  historialTipoCambio: ExchangeRateRecord[]
  categoriasGasto: CategoryGroup[]    // árbol: grupo → subcategorías
  categoriasIngreso: CategoryGroup[]
  tiposActivo: string[]
  tiposPasivo: string[]
  mesesCerrados?: string[]            // 'YYYY-MM'
  ahorroLinks?: AhorroLink[]
}
```

---

## Multi-moneda

ARS, COP y USD. Las tasas se configuran manualmente por mes en Ajustes para que los análisis históricos usen la tasa correcta de cada período.

```typescript
// packages/core/lib/currency.ts
toBase(amount, fromCurrency, toCurrency, settings): number
```

---

## Sistema de categorías

Jerarquía de dos niveles: **Grupo → Subcategoría**. Defaults en `constants.ts`, personalizables desde Ajustes.

```
Gastos                          Ingresos
├── Esenciales                  ├── Laboral
│   ├── Vivienda                │   ├── Sueldo
│   ├── Alimentación            │   └── Freelance
│   ├── Salud                   ├── Pasivo
│   ├── Educación               │   └── Inversiones
│   └── Servicios               └── Otros
├── Variable                        ├── Regalo
│   ├── Transporte                  └── Otros
│   ├── Entretenimiento
│   └── Ropa
├── Financiero
│   └── Ahorro
└── Otros
```

**`CHART_PALETTE`**: 10 colores cualitativos distintos definidos en `constants.ts`, usados en todos los gráficos de donut ordenados por ranking de slice.

---

## Variables de entorno

Crear `.env.local` en `apps/desktop/` y `apps/mobile/`:

```env
NEXT_PUBLIC_SUPABASE_URL=https://<proyecto>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon-key>
```

Ambas apps apuntan a la misma base de datos Supabase.

---

## Desarrollo local

```bash
# Instalar desde la raíz del monorepo
npm install

# App desktop (localhost:3001)
npm run dev:desktop

# App mobile (localhost:3000)
npm run dev:mobile
```

---

## Despliegue (Vercel)

Crear **dos proyectos** Vercel apuntando al mismo repositorio:

| Proyecto | Root directory | Variables de entorno |
|---|---|---|
| `finanzas-desktop` | `apps/desktop` | `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` |
| `finanzas-mobile` | `apps/mobile` | igual |

---

## Notas de implementación

- **Shared user model**: `userId` es un UUID compartido fijo. La autoría individual va en `creadoPor` (`'javier'` | `'mary'`).
- **Soft deletes**: las transacciones no se eliminan físicamente, se marca `deleted_at`.
- **Historial de tasas**: guardado por mes para análisis históricos precisos aunque cambien las tasas actuales.
- **Meses cerrados**: una vez cerrado un mes, sus tasas quedan congeladas y no se permiten ediciones.
- **Transacciones recurrentes**: se pueden instanciar al mes siguiente desde Ajustes → Acciones de mes.
- **Asignación**: cada egreso puede asignarse a un ingreso específico para control de flujo; la página Asignaciones muestra el desglose y permite auto-asignar por proximidad de fecha.
