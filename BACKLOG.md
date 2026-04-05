# Backlog

Tareas pendientes ordenadas por prioridad.

---

## Pipeline

- [ ] **Alertar al usuario cuando el extractor detecta un concepto no clasificado al procesar un PDF**
  El pipeline guarda conceptos nuevos con `subcategoría = ''` y la UI los resalta con el badge "Sin categoría" para edición inline. Sin embargo, el ingestor podría emitir además un **resumen en el log** con los conceptos pendientes de clasificar al final de cada ejecución, para que el operador sepa actuar sin abrir la app.

---

## Acciones e Inversiones

### Mejoras pendientes sobre el flujo actual (Excel)

- [ ] **El acumulado de cartera debe calcularse desde la base de datos**
  Actualmente se calcula solo sobre las filas recién cargadas del Excel. Debería consultar primero lo que ya hay en `stock_transactions` y sumar encima, para que el acumulado sea correcto aunque se carguen ficheros parciales.

- [ ] **Las ventas de ESPP no aparecen en la tabla**
  Las filas con `op_type = 'TR'` de tipo ESPP no se están mostrando correctamente. Revisar el parser y la UI.

- [ ] **Incluir precio unitario de las acciones adquiridas en la tabla**
  Mostrar el precio de mercado en el momento de cada adquisición para tener el detalle completo en la vista previa.

- [ ] **Cargar datos de acciones anteriores a 2026**
  El flujo actual sólo tiene datos desde el fichero actual. Hay que procesar los ficheros históricos de E*TRADE para tener la serie completa.

- [ ] **Revisar solapamiento entre `portfolio_transactions` y `stock_transactions`**
  Una vez estabilizado el flujo, evaluar si `portfolio_transactions` puede unificarse con `stock_transactions` o eliminarse.

---

### API de E*TRADE (usuario final)

> La API REST de E*TRADE para usuarios finales ([documentación](https://apisb.etrade.com/docs/api/account/api-account-v1.html))
> usa OAuth 1.0a con tokens de corta duración (renovación diaria). No expone datos de
> beneficios (RSU vest events, ESPP grants, tax withholding) — esos datos solo están
> disponibles vía el Export del portal Benefits. Sin embargo, sí permite las siguientes
> mejoras relevantes:

- [ ] **Reemplazar Yahoo Finance por E*TRADE Quotes API para el precio de CRM**
  Usar `GET /v1/market/quote/CRM` en lugar de Yahoo Finance. Más fiable al estar ya en el
  ecosistema E*TRADE. Elimina la necesidad de fallback manual.
  _Bloqueante: requiere OAuth 1.0a → necesita un backend/proxy o flujo server-side._

- [ ] **Detectar ventas de CRM automáticamente via Transactions API**
  `GET /v1/accounts/{key}/transactions` devuelve hasta 2 años de historial con
  `transactionType`, `quantity`, `price` y `symbol`. Se podría filtrar por `symbol=CRM`
  y `transactionType=Sold` para registrar ventas sin necesidad de exportar el Excel.
  _Bloqueante: OAuth 1.0a + ventana de 2 años (el Excel cubre el histórico completo)._

- [ ] **Cartera actual en tiempo real via Portfolio API**
  `GET /v1/accounts/{key}/portfolio?view=COMPLETE&lotsRequired=true` devuelve posiciones
  actuales con precio de adquisición por lote, P&L, valor de mercado — reemplazaría la
  lógica actual de `portfolio_transactions` con datos en vivo.
  _Bloqueante: OAuth 1.0a._

- [ ] **Implementar capa de autenticación OAuth 1.0a con E*TRADE**
  Las tres tareas anteriores requieren un token OAuth. Opciones: (a) Supabase Edge Function
  como proxy que almacena tokens; (b) flujo PKCE con redirect. Esta tarea desbloquea todas
  las integraciones con la API de E*TRADE.

---

### Otras mejoras

- [ ] **Leer documentos de calendario de liberación de RSU**
  Procesar los documentos de vesting schedule (PDFs o similares) para extraer las fechas
  y cantidades de cada liberación futura de RSU. Mostrar una línea de tiempo en la app.

---

## Completado

- [x] **Sincronización Automatizada de Divisas (BDE API)** — Botón de sincronización USD/EUR eliminado; la sincronización se dispara automáticamente al subir el Excel de E*TRADE. Tabla `exchange_rates` en Supabase.
- [x] **Procesamiento Detallado de RSU y ESPP** — Parser de `BenefitHistory.xlsx` con lookback de 10 días sobre BDE, tabla `stock_transactions`, preview con errores.
- [x] **Motor de Validación y Lookback de 10 días** — Implementado en `stockTransactionsRepository.js`.
- [x] **Vista histórica (todos los años)** — Selector de año + vista agregada en `usePayrollData.js`.
- [x] **Diagrama Sankey de distribución mensual** — `SankeyChart.jsx` con 3 columnas, datos reales del mes seleccionado via `computeSankeyFromConcepts`.
- [x] **Rediseño UI** — Sidebar fijo + topbar, renombrado a NóminaClara, eliminados tabs de Simuladores.
- [x] **Migrar categorías de conceptos a Supabase** — Tabla `concept_categories` (`supabase/concept_categories.sql`). El extractor carga reglas desde Supabase con fallback al JSON local.
- [x] **Editor inline de conceptos desconocidos** — Badge "Sin categoría" + lápiz en hover; guarda cambios en `payrolls` y en `concept_categories` para clasificación automática futura.
- [x] **Selector de mes en Mi Nómina** — Siempre visible cuando hay un año seleccionado; deshabilitado si no hay meses disponibles.
