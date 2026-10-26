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

## 3. Propuestas (no implementadas)

Priorizadas por impacto / esfuerzo. Esfuerzo: S ≈ horas, M ≈ 1-2 días, L ≈ más.

### Prioridad alta

| Propuesta | Por qué | Esfuerzo |
|---|---|---|
| **Swipe en filas** (derecha = ejecutado, izquierda = eliminar) con `drag="x"` de Motion | Las dos acciones más frecuentes sin abrir el sheet. El README menciona swipe, pero hoy no existe en el código. | M |
| **Deshacer en lugar de doble toque** (toast con "Deshacer" 5 s) | Patrón más rápido y seguro que "tocá de nuevo para confirmar", que hoy aparece en 7 lugares. | M |
| **Hero colapsable** al scrollear la lista | Recupera ~120 px de lista en pantallas chicas sin perder el balance de vista. | S |
| **Teclado de monto con calculadora** (`1500+320`) | Carga más rápida de tickets divididos; evita usar la calculadora del teléfono. | M |
| **Tamaños táctiles ≥ 44 px** en chevrons de mes, checks de fila y acciones del árbol de categorías (hoy 16–32 px) | Accesibilidad y menos errores de toque. | S |

### Prioridad media

| Propuesta | Por qué | Esfuerzo |
|---|---|---|
| **Vista de lista cronológica** como alternativa a la cuenta T (toggle), agrupada por día con encabezados fijos | La cuenta T en 390 px deja columnas de ~180 px: las descripciones largas se cortan. Mantener la T como opción. | M |
| **Ajustes como sub-páginas** (navegación push) en vez de acordeones | Las secciones de Categorías y Vínculos crecen mucho dentro de un acordeón; una página propia permite buscar y reordenar. | M |
| **Reordenar categorías por arrastre** (`Reorder` de Motion) | Hoy el orden es el de creación. | S |
| **Icono por categoría** (además del color) | Escaneo más rápido de la lista; el color solo no alcanza para daltonismo. | M |
| **Sparkline en cada cuenta** de Patrimonio usando los snapshots | Muestra la tendencia sin ir al gráfico general. | S |
| **Cuotas agrupadas por tarjeta** + total por tarjeta del mes | Coincide con cómo llega el resumen del banco. | S |
| **Insights en lenguaje natural** en Análisis ("Gastaste 23 % más en Variable que en septiembre") | Convierte los gráficos en conclusiones accionables. | M |
| **Presupuestos visibles en Resumen** (anillos por categoría con límite) | Hoy solo se ven dentro de Análisis → Por categoría. | M |

### Prioridad baja / exploratorias

| Propuesta | Por qué | Esfuerzo |
|---|---|---|
| **Selector de tema manual** (claro / oscuro / sistema) | Hoy solo sigue al sistema. Los tokens ya lo permiten. | S |
| **View Transitions** entre pantallas con elemento compartido (p. ej. tarjeta de cuenta → detalle) | Continuidad espacial; requiere pantalla de detalle de cuenta. | L |
| **Vibración háptica** en acciones clave (`navigator.vibrate`) | Solo funciona en Android; iOS Safari no lo soporta. | S |
| **Onboarding corto** de 3 pantallas (asignación, cuotas, privacidad) | Útil si se suma otro usuario. | M |

### Riesgos a vigilar
- **Rendimiento del blur**: `backdrop-filter` es costoso en Android de gama baja. Si se nota lag, bajar el blur de `glass` (22 px → 12 px) o reemplazarlo por un fondo sólido en `@media (prefers-reduced-transparency)`.
- **Contraste**: `text-gray-400` sobre superficies glass queda cerca de 3:1. Vale para texto secundario grande, pero conviene revisar los textos de 10–11 px.
