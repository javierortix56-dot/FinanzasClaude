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

```bash
cd desktop
npm install
cp .env.example .env.local   # y completar las variables
npm run dev                  # arranca en http://localhost:3001
```

(El `3001` es para no chocar con la mobile que corre en `3000`.)

## Deploy a Vercel

Esta carpeta `desktop/` se despliega como **un proyecto Vercel separado** del repo (apuntando al mismo repositorio):

1. En Vercel: New Project → seleccioná el repo `FinanzasClaude`.
2. En **Root Directory**, poné `desktop`.
3. En **Environment Variables** copiá las dos `NEXT_PUBLIC_SUPABASE_*` desde el proyecto de la app móvil.
4. Deploy.

Cada push a la rama `main` (o la que elijas) actualiza la web. Tu app móvil sigue intacta en su propio dominio.

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
desktop/
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
│   ├── components/
│   │   ├── shell/              ← Sidebar, Topbar
│   │   ├── ui/                 ← Button, Card, Input, Modal, Badge, Toast
│   │   ├── modals/             ← TransactionModal, AssetModal
│   │   ├── charts/             ← Donut, LineChart (SVG sin librerías)
│   │   ├── DataProvider.tsx
│   │   └── MoneyText.tsx
│   ├── lib/                    ← copia del data layer (supabase, transactions, assets, settings, …)
│   ├── store/                  ← stores Zustand
│   └── types/
├── package.json
├── next.config.ts
├── tsconfig.json
├── postcss.config.mjs
├── eslint.config.mjs
└── vercel.json
```

> **Nota sobre el data layer**: por ahora `desktop/src/lib`, `desktop/src/types` y `desktop/src/store` son **copias** de `src/lib`, `src/types` y `src/store` de la app móvil. Si en el futuro la lógica de datos cambia mucho en una de las dos, conviene migrar a un monorepo (`pnpm workspaces` o similar) con un paquete compartido. Para esta primera versión, copiar es lo más simple y robusto.
