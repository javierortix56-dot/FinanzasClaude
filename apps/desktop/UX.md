# Desktop — auditoría UX y rediseño

Rediseño de la app desktop con el mismo sistema visual que mobile (glass + motion),
paridad de las funciones aprobadas en mobile y corrección de bugs. **El libro en T de
Movimientos (columnas Ingresos | Egresos con resaltado de partidas vinculadas) se
mantiene igual**: solo cambió su estética y animaciones.

## 1. Hallazgos de la auditoría

### Bugs (corregidos)

| # | Problema | Impacto | Corrección |
|---|----------|---------|------------|
| 1 | `AssetModal` enviaba `snapshots: []` también al **editar** | Editar una cuenta borraba todo su historial mensual (sparkline, revalorización, proyección de meta) | Se conservan los snapshots existentes; al crear se agrega el snapshot del mes de alta (igual que mobile) |
| 2 | Borrar un egreso con destino de ahorro no revertía el saldo de la cuenta | Patrimonio inflado | `deleteTransactionsWithUndo` revierte el ajuste (y lo reaplica al deshacer) |
| 3 | El modal de movimientos no sincronizaba el destino de ahorro | Desktop y mobile movían saldos distinto | Misma lógica de delta que mobile al crear/editar |
| 4 | Tipos de cambio vacíos o inválidos se guardaban como `0` | Conversiones infinitas en toda la app | Validación `> 0`, botón deshabilitado si no hay cambios o el valor es inválido |
| 5 | Análisis: dos fetch sin cancelar | Al cambiar de mes rápido se mezclaban datos de meses distintos | Un solo fetch cancelable con marca `loadedFor` |
| 6 | Piloto proyectaba siempre con la fecha de hoy | En meses pasados/futuros la proyección era absurda | Mes cerrado = 100 %, mes futuro = 0 %, mes actual = día/total |
| 7 | Donut mostraba el total con `formatAmount` | Se veía el monto con el modo privacidad activo | El centro usa `MoneyText` (respeta el blur) |
| 8 | "Sin asignar" contaba solo `asignaciones.length === 0` | Egresos vinculados a un ingreso borrado (huérfanos) desaparecían de todo grupo | Se consideran sin asignar en cabecera, barra lateral y Asignaciones |
| 9 | Auto-asignar elegía solo por cercanía de fecha | Podía cargar todo sobre un ingreso chico | `planAutoAssign` compartido (capacidad + fecha) |
| 10 | Diálogos `confirm()` nativos | Bloqueantes, sin tema, sin teclado consistente | Borrado inmediato con **Deshacer** (⌘Z) o `ConfirmDialog` in-app |
| 11 | Modal casero sin foco atrapado ni `aria` | Accesibilidad | Radix Dialog + Motion |
| 12 | Colores de gráficos fijos (`#16a34a`…) | No acompañaban el modo oscuro | Tokens `var(--income)`, `var(--expense)`, `var(--primary)` |
| 13 | El tema de la barra superior se inicializaba desde `localStorage` en el render | Posible desajuste de hidratación y desincronización con Ajustes | `useSyncExternalStore` con suscripción compartida |

### Fricciones de uso

- No había forma de registrar el saldo mensual de una cuenta desde desktop (solo mobile).
- El alta de movimientos no permitía asignar a un ingreso ni elegir destino de ahorro.
- Categorías como `<select>` largo de "Grupo · Sub" sin íconos.
- Sin atajos de teclado, sin feedback de deshacer, sin estados vacíos ni skeletons.

## 2. Qué se implementó

**Sistema visual**: tokens glass (`glass`, `glass-strong`, `sheet-surface`, `bg-brand`, `eyebrow`),
fondo ambiental animado, modo claro/oscuro/sistema sin parpadeo, respeto de
`prefers-reduced-motion` y `prefers-reduced-transparency`.

**Motion**: entrada escalonada de tarjetas, indicadores con `layoutId` (sidebar, tabs,
segmentados), count-up de montos, gráficos que se dibujan, filas que salen con animación al
borrarse, menús y modales con resorte, acordeones con altura animada.

**Por vista**

| Vista | Cambios |
|-------|---------|
| Dashboard | Hero de balance con sparkline 6 meses, tasa de ahorro, insights en lenguaje natural, presupuestos, donut sincronizado con la leyenda, recientes clicables |
| Movimientos | Libro en T intacto; columnas glass, íconos de categoría, filtros segmentados, menú contextual animado (editar / marcar / eliminar), borrar con deshacer, Esc limpia la selección, contador de partidas vinculadas |
| Asignaciones | Barra de capacidad por ingreso (verde/ámbar/rojo), auto-asignar inteligente con deshacer, barra de selección animada, reasignar mostrando lo libre de cada ingreso, desasignar grupo, etiqueta "dividido" |
| Análisis | Tabs segmentados, comparativas con delta, insights, donut + leyenda con íconos, evolución con colores del tema, Piloto con avance del mes y semáforo de egresos/ingresos |
| Cuentas | Tarjetas por cuenta con sparkline del historial, revalorización del último mes, meta con proyección de fecha, composición del patrimonio, **Actualizar saldo** (snapshot mensual) |
| Ajustes | Selector de tema, validación de tipos de cambio, confirmación in-app al clonar, categorías con íconos en acordeón |
| Modal de movimiento | Calculadora en el monto (`1500+320`), moneda segmentada, chips de categoría con íconos, sugerencias de concepto, asignación a ingreso con disponible, destino de ahorro, interruptores, ⌘/Ctrl+Enter |

**Atajos**: `N` nuevo movimiento · `←/→` mes · `H` privacidad · `⌘/Ctrl+Z` deshacer · `?` ayuda.

**Código compartido en `packages/core`**: `calc`, `autoAssign`, `undo`, `categoryIcons`,
`insights`; `upsertSnapshot` ahora actualiza el store al instante.

## 3. Propuestas (no implementadas)

1. **Paleta de comandos (⌘K)**: buscar movimientos, saltar a mes, crear con texto ("super 15000 ayer").
2. **Edición de categorías en desktop** (hoy es de solo lectura; requiere drag & drop para ordenar).
3. **Cuotas en desktop** (la vista existe solo en mobile).
4. **Cerrar mes / backup / notificaciones** con paridad de mobile.
5. **Asignación por arrastre**: soltar un egreso sobre un ingreso en Asignaciones.
6. **Navegación por teclado en el libro**: ↑/↓ entre filas, Enter para editar, Espacio para marcar.
7. **Selección múltiple en Movimientos** para marcar/borrar en lote.
8. **Exportar CSV/Excel** del mes o del rango filtrado.
9. **Vista de detalle de cuenta** con gráfico de saldo y tabla de snapshots editable.
10. **Dividir un egreso entre dos ingresos** desde el modal (hoy se conserva la división existente, pero solo se crea en mobile).
