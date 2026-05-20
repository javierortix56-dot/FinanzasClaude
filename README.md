# FinanzasClaude

Aplicación de finanzas personales compartida para dos usuarios (Javier y Mary), con soporte multi-moneda, sincronización en tiempo real y modo PWA instalable. Diseñada mobile-first con una variante desktop como app web independiente.

---

## Tabla de contenidos

- [Descripción general](#descripción-general)
- [Características principales](#características-principales)
- [Stack tecnológico](#stack-tecnológico)
- [Arquitectura del proyecto](#arquitectura-del-proyecto)
- [Modelo de datos](#modelo-de-datos)
- [Variables de entorno](#variables-de-entorno)
- [Instalación y desarrollo](#instalación-y-desarrollo)
- [Estructura de carpetas](#estructura-de-carpetas)
- [Pantallas y flujos](#pantallas-y-flujos)
- [Gestión de estado](#gestión-de-estado)
- [Multi-moneda](#multi-moneda)
- [Sistema de categorías](#sistema-de-categorías)
- [App desktop](#app-desktop)
- [PWA](#pwa)
- [Backup e importación](#backup-e-importación)
- [Despliegue](#despliegue)

---

## Descripción general

FinanzasClaude es un tracker financiero personal construido sobre Next.js 16 (App Router) + Supabase. Permite a dos usuarios registrar ingresos y gastos en distintas monedas (ARS, COP, USD), asignar gastos a ingresos, gestionar patrimonio (activos/pasivos) y visualizar análisis históricos.

La arquitectura es intencionalmente sencilla: un único registro en Supabase comparte todos los datos entre ambos usuarios. No hay sistema de autenticación por usuario — la pertenencia de cada transacción se registra en el campo `creadoPor`.

---

## Características principales

| Módulo | Funcionalidades |
|---|---|
| **Dashboard** | Balance mensual, ingresos/egresos, cambio de mes, toggle ejecutado, tasa de cambio en tiempo real |
| **Movimientos** | CRUD completo, swipe para ejecutar/editar/eliminar, búsqueda, asignación a ingreso, vinculación a cuenta ahorro, etiquetas y notas |
| **Asignación** | Agrupación egresos → ingreso, auto-asignación, reasignación masiva, desasignación |
| **Patrimonio** | Activos y pasivos, metas de ahorro con barra de progreso, gráfico de evolución 6 meses |
| **Análisis** | Comparativa mensual, donuts por categoría con drilldown, gráfico lineal 6 meses, presupuestos por categoría |
| **Ajustes** | Tasas de cambio por mes, árbol de categorías editable, acciones de mes (clonar, cerrar, recurrentes), backup JSON |
| **PWA** | Service worker, instalable en Android/iOS, funciona offline para lectura |

---

## Stack tecnológico

### Frontend
- **Next.js 16.2.1** — App Router, React Server Components + Client Components
- **React 19.2.4**
- **TypeScript 5** — modo estricto
- **Tailwind CSS 4** — utility-first, mobile-first (max-width 390px)
- **shadcn/ui** — componentes Radix UI primitivos
- **Lucide React 0.577** — iconografía

### Estado global
- **Zustand 5.0.12** — stores independientes por dominio

### Backend / Base de datos
- **Supabase** — PostgreSQL + suscripciones en tiempo real
- **Supabase JS Client** — `@supabase/supabase-js`

### Despliegue
- **Vercel** — mobile y desktop como proyectos separados

---

## Arquitectura del proyecto

```
┌─────────────────────────────────────────────────────┐
│                     Vercel (mobile)                 │
│              Next.js 16 — App Router                │
│         max-width: 390px  /  PWA enabled            │
└───────────────────────┬─────────────────────────────┘
                        │ Supabase JS (realtime)
┌───────────────────────▼─────────────────────────────┐
│                     Supabase                        │
│   PostgreSQL  ─  Realtime  ─  Row Level Security    │
│                                                     │
│  Tablas: movimientos / cuentas / configuracion      │
└───────────────────────┬─────────────────────────────┘
                        │ misma DB
┌───────────────────────▼─────────────────────────────┐
│                    Vercel (desktop)                 │
│            Next.js 16 — App Router                  │
│              Interfaz web de escritorio             │
└─────────────────────────────────────────────────────┘
```

Ambas apps (mobile y desktop) se conectan a la **misma base de datos Supabase** y reciben actualizaciones en tiempo real a través de suscripciones de canal. Cualquier cambio realizado en la app mobile se refleja instantáneamente en la desktop y viceversa.

---

## Modelo de datos

### Tabla `movimientos` (transacciones)

| Campo | Tipo | Descripción |
|---|---|---|
| `id` | UUID | Identificador único |
| `user_id` | UUID | UUID compartido (todos los usuarios) |
| `type` | `'inc' \| 'exp'` | Tipo: ingreso o egreso |
| `amount` | number | Monto en moneda original |
| `orig_amt` | number | Monto original (compatibilidad legacy) |
| `currency` | `'ARS' \| 'COP' \| 'USD'` | Moneda de la transacción |
| `category` | string | Categoría (ej: `"Alimentación"`) |
| `description` | string | Descripción libre |
| `date` | date | Fecha de la transacción |
| `executed` | boolean | Si fue ejecutado/confirmado |
| `deleted_at` | timestamp | Soft delete (null = activo) |
| `children` | jsonb | Metadatos extendidos (ver abajo) |

**Campo `children` (jsonb):**
```json
{
  "nota": "Nota adicional",
  "tags": ["tag1", "tag2"],
  "asignadoA": "uuid-de-ingreso-o-null",
  "creadoPor": "javier",
  "recurrente": false,
  "ahorroAssetId": "uuid-cuenta-ahorro-o-null",
  "ahorroDelta": 150000
}
```

### Tabla `cuentas` (activos y pasivos)

| Campo | Tipo | Descripción |
|---|---|---|
| `id` | UUID | Identificador único |
| `user_id` | UUID | UUID compartido |
| `name` | string | Nombre de la cuenta |
| `kind` | string | Tipo: `banco`, `efectivo`, `cripto`, `inversiones`, `ahorro`, etc. |
| `type` | `'activo' \| 'pasivo'` | Clase contable |
| `currency` | `'ARS' \| 'COP' \| 'USD'` | Moneda |
| `init_bal` | number | Saldo actual (mutable) |
| `date_created` | date | Fecha de creación |
| `meta_objetivo` | number | Meta de ahorro (opcional) |
| `meta_moneda` | string | Moneda de la meta |

### Tabla `configuracion` (settings)

Una única fila por aplicación. Contiene:

```typescript
{
  user_id: UUID,
  app_settings: {
    tipoCambio: { ARS_USD: number, COP_USD: number },
    budgets: Budget[]
  },
  monthly_rates: ExchangeRateRecord[],   // historial de tasas por mes
  transaction_cats: CategoryGroup[],      // árbol de categorías de movimientos
  account_cats: {
    tiposActivo: string[],
    tiposPasivo: string[]
  },
  closed_months: string[]                // meses cerrados (formato "YYYY-MM")
}
```

---

## Variables de entorno

Crea un archivo `.env.local` en la raíz del proyecto (app mobile) con:

```env
NEXT_PUBLIC_SUPABASE_URL=https://<tu-proyecto>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<tu-anon-key>
```

Para la app **desktop**, crea `.env.local` dentro de `desktop/` con los mismos valores (apuntan a la misma base de datos).

> Las variables `NEXT_PUBLIC_FIREBASE_*` están definidas en el código pero **no se utilizan** en la implementación actual.

---

## Instalación y desarrollo

### Requisitos previos
- Node.js 20+
- npm / pnpm / yarn
- Cuenta en Supabase con las tablas creadas

### App mobile (principal)

```bash
# Instalar dependencias
npm install

# Iniciar servidor de desarrollo
npm run dev
# → http://localhost:3000

# Build de producción
npm run build
npm start

# Lint
npm run lint
```

### App desktop

```bash
cd desktop

npm install
npm run dev
# → http://localhost:3001
```

---

## Estructura de carpetas

```
FinanzasClaude/
├── src/
│   ├── app/
│   │   ├── (app)/                    # Rutas con layout de navegación inferior
│   │   │   ├── layout.tsx            # Bottom nav + FAB central
│   │   │   ├── dashboard/page.tsx    # Pantalla principal
│   │   │   ├── patrimonio/page.tsx   # Activos y pasivos
│   │   │   ├── analisis/page.tsx     # Análisis histórico
│   │   │   └── ajustes/page.tsx      # Configuración
│   │   ├── layout.tsx                # Root layout (fuentes, AuthProvider)
│   │   ├── page.tsx                  # Redirige a /dashboard
│   │   ├── manifest.ts               # Manifiesto PWA
│   │   └── test-currency/page.tsx    # Página de prueba de conversión
│   ├── components/
│   │   ├── transactions/
│   │   │   ├── TransactionModal.tsx  # Modal CRUD de transacciones
│   │   │   ├── TAccountView.tsx      # Vista con tabs ingreso/egreso
│   │   │   ├── TransactionList.tsx   # Lista con búsqueda
│   │   │   ├── TransactionItem.tsx   # Fila individual
│   │   │   ├── SwipeableItem.tsx     # Gestos de swipe
│   │   │   └── AhorrarBalanceModal.tsx
│   │   ├── assignment/
│   │   │   ├── AssignmentTab.tsx     # UI principal de asignación
│   │   │   ├── AssignmentGroup.tsx   # Grupo colapsable ingreso → egresos
│   │   │   └── ReassignModal.tsx     # Reasignación masiva
│   │   ├── patrimonio/
│   │   │   ├── AssetModal.tsx        # Modal CRUD de cuentas
│   │   │   ├── AssetCard.tsx         # Tarjeta de cuenta
│   │   │   ├── PatrimonioChart.tsx   # Gráfico evolución 6 meses
│   │   │   └── AhorroTab.tsx         # Metas de ahorro
│   │   ├── analisis/
│   │   │   ├── HistoricoTab.tsx      # Análisis histórico
│   │   │   ├── SummaryComparison.tsx # KPIs delta vs mes anterior
│   │   │   ├── CategoryDonut.tsx     # Donut con drilldown
│   │   │   ├── DonutChart.tsx        # Primitiva SVG donut
│   │   │   ├── MultiLineChart.tsx    # Gráfico lineal SVG 6 meses
│   │   │   ├── PilotoTab.tsx         # Proyección (en desarrollo)
│   │   │   └── BudgetModal.tsx       # Crear/editar presupuesto
│   │   ├── ajustes/
│   │   │   └── CategoryModal.tsx     # Editor árbol de categorías
│   │   ├── AuthProvider.tsx          # Inicialización de settings
│   │   ├── ServiceWorkerRegistrar.tsx
│   │   └── ui/
│   │       ├── button.tsx
│   │       ├── input.tsx
│   │       └── toast.tsx
│   ├── store/
│   │   ├── useAuthStore.ts           # Moneda base seleccionada
│   │   ├── useTransactionStore.ts    # Mes actual + lista de transacciones
│   │   ├── useSettingsStore.ts       # Settings globales + hideAmounts
│   │   ├── useAssetStore.ts          # Lista de cuentas
│   │   ├── useBudgetStore.ts         # Presupuestos del mes
│   │   └── useUIStore.ts             # Estados de modales + toasts
│   ├── lib/
│   │   ├── supabase.ts               # Cliente Supabase
│   │   ├── transactions.ts           # CRUD + suscripción movimientos
│   │   ├── assets.ts                 # CRUD + suscripción cuentas
│   │   ├── settings.ts               # CRUD + suscripción configuracion
│   │   ├── budgets.ts                # CRUD presupuestos
│   │   ├── analytics.ts              # Queries históricas multi-mes
│   │   ├── currency.ts               # Conversión multi-moneda
│   │   ├── constants.ts              # Categorías default, usuarios, formateadores
│   │   ├── backup.ts                 # Export/import JSON
│   │   └── utils.ts                  # cn() (clsx + tailwind-merge)
│   └── types/
│       └── index.ts                  # Tipos TypeScript globales
├── public/
│   ├── sw.js                         # Service worker
│   └── icon-*.png                    # Iconos PWA
├── desktop/                          # App desktop (monorepo)
│   └── src/ ...                      # Estructura espejo
├── next.config.ts                    # Security headers, config Next.js
├── components.json                   # Config shadcn/ui
├── tsconfig.json
└── finanzas-jm-spec.md               # Especificación completa v2.0
```

---

## Pantallas y flujos

### Dashboard (`/dashboard`)

Pantalla principal con balance neto del mes. Muestra:
- Tarjetas de ingreso total / egreso total con conversión a moneda base
- Pills de tasas de cambio (ARS/USD, COP/USD) editables en línea
- Toggle para ocultar montos (modo privacidad)
- Navegación entre meses (← →)

**Tab Movimientos:** Lista de transacciones del mes con swipe izquierda para ejecutar/desejecutar y swipe derecha para menú de acciones (editar, clonar, eliminar). Incluye buscador.

**Tab Asignación:** Agrupa los egresos bajo el ingreso al que fueron asignados. Permite:
- Auto-asignar: distribuye egresos por fecha al ingreso más cercano con capacidad
- Selección múltiple + reasignación masiva a otro ingreso
- Desasignar todos los egresos de un ingreso

### FAB (botón flotante central)

El botón `+` en la barra de navegación inferior abre el `TransactionModal` para crear una nueva transacción. El modal permite:
1. Seleccionar tipo (Ingreso / Egreso)
2. Elegir categoría del árbol jerárquico
3. Ingresar monto y seleccionar moneda (ARS, COP, USD)
4. Seleccionar fecha
5. Marcar como ejecutado
6. Asignar a un ingreso (solo egresos)
7. Vincular a cuenta de ahorro (solo ingresos)
8. Agregar etiquetas y nota

### Patrimonio (`/patrimonio`)

- **Tab Activos:** Lista de cuentas activas (banco, efectivo, cripto, inversiones, ahorro) con saldo en moneda original y conversión a USD
- **Tab Pasivos:** Lista de deudas y obligaciones
- **Tab Metas:** Cuentas de ahorro con barra de progreso hacia la meta definida
- **Gráfico:** Evolución del patrimonio neto en los últimos 6 meses (SVG)

### Análisis (`/analisis`)

- **Tab Histórico:**
  - Comparativa vs mes anterior: delta de balance, ingresos, egresos y cantidad de transacciones
  - Donuts interactivos: distribución por categoría de egresos e ingresos con drilldown a subcategoría al hacer tap
  - Gráfico lineal: ingresos, egresos y balance de los últimos 6 meses
  - Barras de progreso de presupuesto por categoría
- **Tab Piloto:** Proyección del mes en curso (en desarrollo)

### Ajustes (`/ajustes`)

- **Tasas de cambio:** Editor de ARS/USD y COP/USD con historial mensual
- **Categorías:** Árbol expandible con grupos y subcategorías; agregar, renombrar, activar/desactivar
- **Tipos de cuenta:** Listas editables de tipos de activo y pasivo
- **Acciones de mes:**
  - Clonar mes: copia transacciones recurrentes al mes siguiente
  - Crear recurrentes: instancia transacciones marcadas como recurrentes
  - Cerrar mes: congela tasas y bloquea el mes
  - Eliminar mes: elimina todas las transacciones del mes actual
- **Backup:** Exportar / importar JSON con todos los datos

---

## Gestión de estado

Zustand con un store por dominio:

| Store | Contenido | Suscripción Supabase |
|---|---|---|
| `useAuthStore` | `monedaBase: Currency` | No |
| `useTransactionStore` | `currentMonth`, `transactions[]`, navegación de mes | `subscribeToTransactions(month)` |
| `useSettingsStore` | `settings`, `hideAmounts` | `subscribeToSettings()` |
| `useAssetStore` | `assets[]` | `subscribeToAssets()` |
| `useBudgetStore` | `budgets[]` | `subscribeToBudgets(month)` |
| `useUIStore` | Estados de modales, `editingTransaction`, `toasts[]` | No |

Todas las suscripciones de Supabase retornan una función de cleanup que se llama en `useEffect` al desmontar el componente, garantizando que no queden listeners activos.

---

## Multi-moneda

La app soporta tres monedas: **ARS** (Peso argentino), **COP** (Peso colombiano) y **USD** (Dólar estadounidense).

Las tasas se configuran manualmente en Ajustes y se almacenan con historial mensual para que los análisis históricos usen la tasa correcta de cada período.

### Funciones de conversión (`src/lib/currency.ts`)

```typescript
// Convierte cualquier moneda a USD
toUSD(amount: number, currency: Currency, rates: ExchangeRateRecord[]): number

// Convierte USD a la moneda base del usuario
toBase(amountUSD: number, base: Currency, rates: ExchangeRateRecord[]): number
```

Las conversiones son seguras: si la tasa es 0 o inválida, retornan 0 en lugar de lanzar un error.

---

## Sistema de categorías

Las categorías están organizadas en una jerarquía de dos niveles:

```
Gasto
├── Esenciales
│   ├── Alquiler
│   ├── Servicios
│   └── Alimentación
├── Variable
│   ├── Salidas
│   └── Ropa
├── Financiero
│   └── Inversiones
└── Otros

Ingreso
├── Laboral
│   ├── Sueldo
│   └── Freelance
├── Pasivo
└── Otros
```

Las categorías default están en `src/lib/constants.ts`. El usuario puede agregar, renombrar y activar/desactivar categorías desde Ajustes. Las personalizaciones se persisten en la tabla `configuracion` de Supabase.

---

## App desktop

Dentro del directorio `desktop/` existe una segunda aplicación Next.js que comparte la misma base de datos Supabase:

```bash
cd desktop
npm install
npm run dev   # → http://localhost:3001
```

La app desktop tiene su propio `package.json`, `tsconfig.json` y `next.config.ts`. Los archivos de `lib/`, `store/` y `types/` son copias (no importaciones compartidas) para mantener la independencia de despliegue.

Se despliega en un proyecto Vercel separado pero apunta al mismo Supabase, por lo que Javier y Mary pueden usar la interfaz mobile o desktop indistintamente con datos siempre sincronizados.

---

## PWA

La app mobile está configurada como Progressive Web App:

- **Manifiesto**: `src/app/manifest.ts` — nombre, iconos, colores, orientación portrait
- **Service Worker**: `public/sw.js` — cache de assets estáticos para lectura offline
- **Iconos**: `public/icon-*.png` en múltiples resoluciones

Para instalar en Android: abrir en Chrome → menú → "Agregar a pantalla de inicio". En iOS: Safari → compartir → "Agregar a inicio".

---

## Backup e importación

Desde Ajustes → Backup se puede exportar e importar todos los datos en formato JSON:

**Exportar:** Genera un archivo `finanzas-backup-YYYY-MM-DD.json` con:
```json
{
  "version": "1.0",
  "exportedAt": "ISO datetime",
  "transactions": [...],
  "assets": [...],
  "budgets": [...],
  "settings": { ... }
}
```

**Importar:** Carga el JSON y sobreescribe los datos actuales. Las fechas se convierten de strings ISO a objetos Date correctamente.

---

## Despliegue

### Vercel (recomendado)

**App mobile:**
1. Conectar el repositorio a Vercel
2. Root directory: `/` (raíz del repo)
3. Framework preset: Next.js
4. Agregar variables de entorno: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`

**App desktop:**
1. Crear un segundo proyecto Vercel
2. Root directory: `desktop/`
3. Mismas variables de entorno (misma DB Supabase)

### Security headers

`next.config.ts` aplica los siguientes headers de seguridad en producción:
- `Content-Security-Policy`
- `X-Frame-Options: DENY`
- `X-Content-Type-Options: nosniff`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Permissions-Policy`

---

## Notas de implementación

- **Shared user model**: todos los datos usan un UUID compartido fijo como `user_id`. La autoría individual se registra en `children.creadoPor` (`'javier'` | `'mary'`).
- **Soft deletes**: las transacciones nunca se eliminan físicamente; se marca `deleted_at` con timestamp.
- **Historial de tasas**: las tasas de cambio se almacenan por mes en `monthly_rates` para garantizar precisión en análisis históricos aunque cambien las tasas actuales.
- **Ajuste de saldo atómico**: `adjustAssetSaldo()` suma/resta un delta al saldo existente de forma segura, usado por la funcionalidad de ahorro para permitir reversión exacta al eliminar una transacción vinculada.
- **Transacciones recurrentes**: una transacción marcada `recurrente: true` puede instanciarse en el mes siguiente preservando categoría, monto y descripción.
- **Meses cerrados**: una vez cerrado un mes, sus tasas quedan congeladas y no se puede agregar ni editar transacciones en ese período.
