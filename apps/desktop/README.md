# Finanzas J&M — Desktop

Versión **web de escritorio** de la app de finanzas. Comparte la misma base de datos Supabase que la app móvil, así que todo lo que cargues en uno se ve al instante en el otro.

## Cómo abrirla

Una vez deployada en Vercel, simplemente abrís el link (`https://...vercel.app`) desde cualquier navegador. Sin instalar nada.

## Stack

- Next.js 16 (App Router) + TypeScript
- Tailwind CSS v4
- Zustand para estado global
- Supabase (Postgres + realtime) — **mismo proyecto que la app móvil**
- Vercel para deploy

## Variables de entorno

Configurá estas dos variables en Vercel (o en `.env.local` para desarrollo):

```
NEXT_PUBLIC_SUPABASE_URL=https://<tu-proyecto>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<tu-anon-key>
```

> ⚠️ Tienen que ser **exactamente las mismas** que usa la app móvil para que ambas vean los mismos datos.

## Desarrollo local

Este paquete es parte de un **monorepo npm**. Instalá las dependencias **una sola vez desde la raíz** y arrancá la app de escritorio con el script del monorepo:

```bash
# desde la raíz del repositorio
npm install
npm run dev:desktop          # arranca en http://localhost:3001
```

Antes de arrancar, creá `apps/desktop/.env.local` con las variables de Supabase (ver más arriba).

(El `3001` es para no chocar con la mobile que corre en `3000`.)

## Deploy a Vercel

Esta carpeta `apps/desktop/` se despliega como **un proyecto Vercel separado** (apuntando al mismo repositorio):

1. En Vercel: New Project → seleccioná el repo `FinanzasClaude`.
2. En **Root Directory**, poné `apps/desktop`.
3. En **Environment Variables** copiá las dos `NEXT_PUBLIC_SUPABASE_*` desde el proyecto de la app móvil.
4. Deploy.

Cada push a la rama configurada actualiza la web. Tu app móvil sigue intacta en su propio dominio.

## Funcionalidades

- **Dashboard**: KPIs del mes (balance, ingresos, egresos, patrimonio), top categorías, movimientos recientes.
- **Movimientos**: tabla con búsqueda, filtros (tipo / categoría / persona / pendientes), creación, edición, eliminación, marcar ejecutado.
- **Asignaciones**: agrupado por ingreso, selección múltiple, reasignar y auto-asignar.
- **Cuentas y patrimonio**: activos / pasivos en USD, metas de ahorro con barra de progreso.
- **Análisis**: comparación con mes anterior, donut por categoría, evolución 6 meses (ingresos / egresos / balance).
- **Ajustes**: tipos de cambio, clonar mes, crear recurrentes, vista de categorías.
- **Atajos**: ocultar/mostrar montos, navegación de mes, layout responsive con sidebar persistente en pantallas grandes.

## Estructura

```
apps/desktop/
├── src/
│   ├── app/
│   │   ├── (app)/              ← layout con sidebar + topbar
│   │   │   ├── dashboard/
│   │   │   ├── movimientos/
│   │   │   ├── asignaciones/
│   │   │   ├── cuentas/
│   │   │   ├── analisis/
│   │   │   └── ajustes/
│   │   ├── globals.css
│   │   ├── layout.tsx
│   │   └── page.tsx (redirige a /dashboard)
│   └── components/
│       ├── shell/              ← Sidebar, Topbar
│       ├── ui/                 ← Button, Card, Input, Modal, Badge, Toast
│       ├── modals/             ← TransactionModal, AssetModal
│       ├── charts/             ← Donut, LineChart (SVG sin librerías)
│       ├── DataProvider.tsx
│       └── MoneyText.tsx
├── package.json
├── next.config.ts
├── tsconfig.json
├── postcss.config.mjs
├── eslint.config.mjs
└── vercel.json
```

> **Data layer compartido**: la lógica de datos (acceso a Supabase, tipos y stores Zustand) **no vive acá**: se importa del paquete `@finanzas/core` (`packages/core/`), el mismo que usa la app móvil. Así, un cambio en la capa de datos impacta ambas apps a la vez, sin duplicar código. Por eso vas a ver imports como `@finanzas/core/lib/transactions`, `@finanzas/core/store/useTransactionStore`, etc. El `next.config.ts` declara `transpilePackages: ["@finanzas/core"]` para compilarlo desde el código fuente.
