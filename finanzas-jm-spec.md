# Finanzas J&M — Especificación v2.0

## Descripción
App de finanzas personales mobile-first para dos personas (Javier y Mary). Permite registrar ingresos y gastos, asignar egresos a ingresos específicos, controlar patrimonio, manejar múltiples monedas y visualizar el estado financiero con gráficos.

## Stack técnico
- Frontend: Next.js 15 con App Router + TypeScript
- UI: Tailwind CSS + shadcn/ui
- Estado global: Zustand
- Base de datos: Firebase Firestore
- Auth: Firebase Auth
- Deploy: Vercel
- Versionado: GitHub

## Usuarios
Dos cuentas fijas: Javier y Mary. Cada uno inicia sesión con su email. Pueden ver los datos del otro (finanzas compartidas). Cada transacción tiene un campo "creadoPor" que indica quién la registró.

## Monedas
La app maneja tres monedas: ARS (peso argentino), COP (peso colombiano) y USD (dólar). Los tipos de cambio son manuales y se configuran en Ajustes. Se guarda un historial de tipos de cambio por mes para que los cálculos históricos sean precisos.

## Pantallas

### 1. Dashboard (Resumen)
**Header:**
- Avatar J&M + saludo con nombre del usuario logueado
- Navegación de mes (◀ mes ▶)
- Botón ocultar/mostrar cifras (modo privado con blur)

**Sección balance:**
- Balance del mes en moneda base
- Conversión aproximada a USD
- Tarjetas Ingresos / Gastos lado a lado (verde / rojo)
- Tipos de cambio actuales como píldoras (USD/ARS · USD/COP)

**Pestaña Movimientos:**
- Buscador siempre visible
- Sub-pestañas Ingresos / Egresos
- Cada item muestra: concepto, persona, fecha, categoría, monto
- Swipe izquierda (←): marcar como ejecutado (pagado si egreso, recibido si ingreso)
- Swipe derecha (→): menú con opciones Editar / Eliminar / Desasignar

**Pestaña Asignación:**
- Barra de progreso: asignado vs pendiente
- Egresos agrupados por ingreso al que fueron asignados
- Cada grupo es expandible/contraíble
- Selección múltiple al tocar un egreso → barra de acción con Reasignar / Cancelar
- Grupo "Sin asignar" destacado en naranja
- Botón Auto-asignar: asigna todos los egresos pendientes al ingreso más cercano en fecha
- Botón Desasignar: desasigna todos los egresos del ingreso seleccionado

### 2. Cuentas y Patrimonio
- Resumen: Activos Totales / Pasivos Totales / Neto (todo en USD)
- Gráfico de barras: evolución del patrimonio por mes
- Tabs Activos / Pasivos
- Lista de cuentas: nombre, tipo (banco/efectivo/cripto/inversiones/ahorro), moneda, saldo, conversión a USD
- Tocar cuenta → modal de edición
- Modal editar/crear cuenta: nombre, clase (activo/pasivo), tipo, moneda, saldo inicial, fecha de alta
- [NUEVO] Metas de ahorro: cada cuenta puede tener un objetivo (monto + moneda). Se muestra como barra de progreso: "USD $90 de USD $1.000"

### 3. Análisis

**Pestaña Histórico:**

Sección 1 — Resumen vs mes anterior:
- Balance, Ingresos, Gastos, Transacciones con flecha de variación (↑ verde / ↓ rojo)

Sección 2 — Torta por categoría:
- Pestañas internas: Gastos por categoría / Ingresos por categoría
- Donut chart + leyenda con % y monto por categoría
- Al tocar una categoría: muestra detalle de subcategorías sin cambiar de pantalla
- [NUEVO] Presupuestos: barra de progreso con gastado vs límite mensual

Sección 3 — Gráficos de líneas:
- Ingresos vs Egresos (con líneas de Ahorro y Balance)
- Evolución de gastos por categoría
- Evolución de ingresos por fuente

**Pestaña Piloto:**
- Proyección de ingresos, gastos y balance del mes en curso

### 4. Ajustes

**Sección Perfil:** Nombre y email, editable

**Sección Tipos de cambio:**
- USD/ARS y USD/COP editables manualmente
- [NUEVO] Historial de tipos de cambio por mes

**Sección Categorías (expandibles):**
- Categorías de gasto / ingreso: agregar, editar, activar/desactivar
- Tipos de activo / pasivo: agregar, editar

**Sección Navegación:**
- Clonar mes: duplica estructura de categorías y recurrentes
- Recurrentes: crea automáticamente movimientos recurrentes

**Sección Datos:** Importar / Exportar

**Sección Peligro:**
- Cerrar mes: congela datos + guarda tipo de cambio vigente
- Borrar mes: elimina todos los datos del mes (requiere confirmación)

### 5. Detalle de movimiento [NUEVO]
- Todos los campos editables: tipo, monto, moneda, categoría, descripción, fecha, persona
- [NUEVO] Campo nota extendida
- [NUEVO] Etiquetas / tags
- Ingreso al que está asignado (si aplica), editable
- Estado: ejecutado / pendiente (toggle)

## Modelo de datos Firestore

```
users/{userId}
  nombre: string
  email: string
  monedaBase: 'ARS' | 'COP' | 'USD'

transactions/{transactionId}
  userId: string
  tipo: 'ingreso' | 'egreso'
  monto: number
  moneda: 'ARS' | 'COP' | 'USD'
  categoria: string
  descripcion: string
  nota: string                    // [NUEVO] nota extendida
  tags: string[]                  // [NUEVO] etiquetas
  fecha: timestamp
  ejecutado: boolean
  asignadoA: string | null        // transactionId del ingreso
  creadoPor: string               // userId

assets/{assetId}
  userId: string
  nombre: string
  tipo: 'banco' | 'efectivo' | 'cripto' | 'inversiones' | 'ahorro'
  clase: 'activo' | 'pasivo'
  moneda: 'ARS' | 'COP' | 'USD'
  saldo: number
  fechaAlta: timestamp
  metaObjetivo: number | null     // [NUEVO]
  metaMoneda: string | null       // [NUEVO]

settings/{userId}
  tipoCambio:
    ARS_USD: number
    COP_USD: number
  historialTipoCambio: [          // [NUEVO]
    { mes: string, ARS_USD: number, COP_USD: number }
  ]
  categoriasGasto: [{ id, nombre, color, activa }]
  categoriasIngreso: [{ id, nombre, color, activa }]
  tiposActivo: string[]
  tiposPasivo: string[]

budgets/{budgetId}               // [NUEVO]
  userId: string
  categoria: string
  mes: string                    // formato 'YYYY-MM'
  limite: number
  moneda: string
```

## Diseño
- Mobile-first, ancho máximo 390px, navegación inferior con 4 tabs + botón "+" flotante central
- Paleta: púrpura (#534AB7) principal, verde ingresos, rojo gastos, naranja sin asignar
- Las cifras sensibles se ocultan con blur al tocar el botón del ojo en el header

## Orden de construcción
1. Setup: Next.js 15 + TypeScript + Tailwind + shadcn/ui + Firebase + GitHub + Vercel
2. Auth: login de Javier y Mary con Firebase Auth
3. Transacciones: agregar, listar, editar, eliminar (CRUD completo)
4. Dashboard: resumen del mes, movimientos con pestañas, ocultar cifras
5. Asignación: lógica ingreso → egreso, auto-asignar, grupos expandibles
6. Cuentas y Patrimonio: lista de cuentas, modal edición, metas de ahorro
7. Análisis: torta con subcategorías, presupuestos, gráficos de líneas
8. Detalle de movimiento: notas, tags, estado ejecutado
9. Ajustes: categorías, tipos de cambio con historial, clonar mes, recurrentes
10. Importar / Exportar · Swipe actions · Piloto / proyecciones
