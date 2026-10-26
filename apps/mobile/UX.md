# Auditoría UX/UI y propuestas — app mobile

Alcance: `apps/mobile` (PWA). Este documento resume el diagnóstico de la UI anterior, lo que se cambió en el rediseño y las mejoras propuestas que **no** se implementaron (quedan para decidir).

---

## 1. Diagnóstico de la versión anterior

Hallazgos verificados en el código, ordenados por impacto.

| # | Hallazgo | Dónde | Impacto |
|---|---|---|---|
| 1 | **Ocho modales con markup duplicado** y estilos distintos entre sí: radios `rounded-t-2xl` / `rounded-t-3xl`, overlays `black/40` sin blur o `black/50` con blur, handles de 9 o 10 px, cerrar con o sin fondo. | `TransactionModal`, `AssetModal`, `SnapshotModal`, `BudgetModal`, `CategoryModal`, `CuotaModal`, `ImportExtractoModal`, `ReassignModal` | Sensación de app "armada por partes"; cada cambio de estilo había que repetirlo 8 veces. |
| 2 | **Sin movimiento**: tabs, acordeones, sheets y listas cambiaban de golpe. El `animate-in fade-in` del Toast no hacía nada (el plugin `tailwindcss-animate` no está instalado). | Toda la app | Es la principal razón de que la app se sintiera "vieja". |
| 3 | **Modo privacidad inconsistente**: el ojo ocultaba montos en Resumen y Cuotas, pero no en Patrimonio, Histórico, Piloto ni el gráfico de patrimonio. | `patrimonio/page`, `AssetCard`, `HistoricoTab`, `PilotoTab`, `PatrimonioChart` | Falla la promesa del feature (se exponen montos con el ojo cerrado). |
| 4 | **Borrado sin confirmación** de grupos y subcategorías desde el árbol de Ajustes (un toque borra), cuando el resto de la app usa doble toque. | `ajustes/page` | Riesgo de pérdida de configuración por toque accidental. |
| 5 | **HTML inválido**: botón dentro de botón en la leyenda del donut (botón de presupuesto dentro de la fila). | `CategoryDonut` | Comportamiento de toque impredecible y problemas de accesibilidad. |
| 6 | **Presupuesto con categorías custom**: el sheet buscaba el nombre solo en los defaults (`getCategoryById`), así que una categoría creada por el usuario aparecía sin nombre. | `BudgetModal` | Contexto perdido al editar. |
| 7 | **Árbol de categorías remontado en cada render** (`CategoryTree` definido como componente dentro del render de la página). | `ajustes/page` | Pérdida de estado/foco y trabajo extra en cada tecla. |
| 8 | **Gráficos de líneas sin valores**: solo se veía la forma, sin poder leer cuánto fue cada mes. | `MultiLineChart` | El gráfico no responde la pregunta que motiva abrirlo. |
| 9 | **Jerarquía tipográfica plana**: casi todo entre 10 y 12 px; el balance (dato principal) en 24 px y el mes en 12 px. Botones de mes de ~20 px (muy por debajo de los 44 px recomendados para toque). | `dashboard/page` y headers | Lectura lenta; errores de toque. |
| 10 | **Búsqueda en dos pasos** (tocar la barra para que aparezca el input). | `dashboard/page` | Fricción innecesaria. |
| 11 | **Colores hardcodeados** (`#1a7a4a`, `#534AB7`, `#f87171`, …) fuera del sistema de tokens. | Varios | El modo oscuro y cualquier cambio de marca quedan a medias. |
| 12 | **Mezcla de nombres de la paleta** (`green`/`red` de Tailwind junto a hex propios) para ingresos y egresos. | Varios | Verde/rojo no exactamente iguales entre pantallas. |

---

## 2. Qué se implementó

### Sistema de diseño
- **Tokens** en `globals.css`: superficies `glass` / `glass-strong` / `sheet-surface`, `hairline`, sombras `shadow-soft` / `shadow-lift`, gradiente de marca `bg-brand`, `eyebrow` para sobretítulos. Todo con variante oscura.
- **Fondo ambiental**: tres manchas de color difuminadas con deriva lenta (CSS puro, se detiene con "Reducir movimiento").
- **Paleta semántica unificada**: ingresos `emerald`, egresos `rose`, sin asignar `amber`, marca `primary`.

### Motion (`motion` 14, antes framer-motion)
- `MotionConfig reducedMotion="user"`: toda animación respeta la preferencia del sistema.
- Presets compartidos en `components/ui/motion.ts` (resortes y curvas), para que todo tenga el mismo "feel".
- **Shared layout**: el indicador de los controles segmentados y la pestaña activa del dock se deslizan entre opciones.
- **Sheets** con entrada por resorte, overlay con blur y **arrastrar hacia abajo para cerrar**.
- **Números animados** (count-up) en balance, totales, patrimonio, KPIs y proyecciones.
- **Gráficos**: barras que crecen, donut que se dibuja por slice, líneas que se trazan.
- Listas con entrada escalonada (tope de 300 ms), acordeones con altura animada, check de "ejecutado" con rebote, toast con resorte.
- Transición de entrada entre pantallas (`(app)/template.tsx`).

### Componentes nuevos (`components/ui/`)
| Componente | Reemplaza |
|---|---|
| `Sheet` | Los 8 modales (Radix Dialog + Motion; foco, Escape y aria se mantienen) |
| `Segmented` | Tabs con borde inferior y grupos de botones toggle (moneda, persona, tipo) |
| `Money` / `useAnimatedNumber` | `formatAmount` + `blur-sm` repetidos; ahora respeta privacidad en todos lados |
| `PageHeader`, `MonthSwitcher`, `PrivacyToggle` | Headers ad hoc de cada pantalla |
| `Collapse`, `ProgressBar`, `Card` | Acordeones, barras y tarjetas sueltas |

### Pantallas
- **Resumen**: hero de balance con gradiente, ingresos/egresos y % gastado; dock flotante con FAB integrado; búsqueda directa; filas de la cuenta T como tarjetas con acento de color de categoría.
- **Asignación**: grupos como tarjetas con expansión animada, % usado como chip, barra de selección múltiple flotante (portal) sobre el dock.
- **Patrimonio**: hero de neto con barra activos/pasivos, gráfico en tarjeta, cuentas como tarjetas con icono tintado, meta con barra en gradiente.
- **Análisis**: KPIs con chip de variación, insights con icono, donut con drill-down animado, líneas con selección de mes, top 5 con barra relativa.
- **Cuotas**: acciones primarias claras, barras de compromiso que crecen, tarjetas con progreso.
- **Ajustes**: tarjeta de perfil, secciones agrupadas estilo iOS (General / Organización / Datos) con iconos de color y resumen del valor actual en cada fila.
- **Login y splash** con la nueva identidad.

### Correcciones de UX incluidas (sin cambiar funcionalidades)
- Privacidad aplicada en todas las pantallas (hallazgo 3).
- Doble toque para borrar grupos/subcategorías en Ajustes (hallazgo 4).
- HTML válido en la leyenda del donut (hallazgo 5).
- Nombre correcto de categorías custom en Presupuesto (hallazgo 6).
- Árbol de categorías sin remontes (hallazgo 7).
- Tocar un mes en los gráficos de líneas muestra sus valores (hallazgo 8).
- Los sheets ya no cambian de contenido mientras se cierran (antes el título saltaba a "Nuevo movimiento" durante el cierre).

---

## 3. Propuestas — estado

Todas las propuestas quedaron implementadas excepto una, descartada a pedido: la **vista de lista cronológica** como alternativa a la cuenta T. El esquema de cuentas T (columnas Ingresos | Egresos) se mantiene sin cambios; solo se le sumaron gestos e íconos a las filas.

| Propuesta | Estado | Dónde |
|---|---|---|
| Swipe en filas (derecha = ejecutado, izquierda = eliminar) | ✅ | `TAccountView` (dentro de cada columna; la estructura T no cambia) |
| "Deshacer" en lugar de doble toque | ✅ | `lib/undo.ts` + toast con acción. Cubre: eliminar movimiento, selección múltiple, cuenta, cuota, categoría/subcategoría, presupuesto, borrar mes, desasignar (todo y por grupo), reasignar y auto-asignar. Restaura el mismo registro (mismo id). |
| Hero colapsable al scrollear | ✅ | `dashboard/page` (se compacta al desplazar cualquiera de las listas; tocarlo lo expande) |
| Monto con calculadora | ✅ | `lib/calc.ts` (parser propio, sin `eval`) + fila de operadores en el sheet de movimiento |
| Zonas táctiles ≥ 44 px | ✅ | Utilidad `hit-44` (amplía el área sin cambiar el tamaño visual) en checks, chevrons de mes, header y árbol de categorías |
| ~~Vista de lista cronológica~~ | ❌ Descartada | Se conserva la cuenta T |
| Ajustes como sub-páginas | ✅ | Navegación push con deslizar-para-volver |
| Reordenar categorías por arrastre | ✅ | `CategoryTree` (grupos y subcategorías, `Reorder` de Motion) |
| Ícono por categoría | ✅ | Campo opcional `icono` en `Category` (se guarda en el JSON de configuración, sin migración) + selector en el sheet de categoría; defaults por id |
| Sparkline en cada cuenta | ✅ | `AssetCard` |
| Cuotas agrupadas por tarjeta + total del mes | ✅ | `CuotasTab` |
| Insights en lenguaje natural | ✅ | `HistoricoTab` → "Lo más importante" (variación por grupo, ahorro, proyección de cierre, presupuestos superados, pagos pendientes) |
| Presupuestos visibles en Resumen | ✅ | `BudgetRings` (anillos bajo el hero, solo si hay presupuestos) |
| Selector de tema manual | ✅ | Ajustes → Apariencia (`data-theme` + script anti-parpadeo) |
| Transición con elemento compartido | ✅ | Detalle de cuenta: la tarjeta se expande (`layoutId`) con evolución, meta e historial |
| Vibración háptica | ✅ | `lib/haptics.ts` (Android; en iOS no hace nada) |
| Introducción de 4 pasos | ✅ | Primera vez por dispositivo; se reabre en Ajustes → Cuenta |

### Riesgos a vigilar
- **Rendimiento del blur**: `backdrop-filter` es costoso en Android de gama baja. Ya hay fallback sólido con "Reducir transparencia" del sistema; si igual se nota lag, bajar el blur de `glass` (22 px → 12 px).
- **Contraste**: los sobretítulos pasaron a `gray-500`; algunos textos secundarios de 10–11 px siguen en `gray-400` (≈ 3:1).
- **"Borrar mes" + Deshacer**: restaura los movimientos que estaban cargados en pantalla para ese mes (los que trae el realtime), que en la práctica son todos.
