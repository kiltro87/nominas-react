# Backlog

Tareas pendientes ordenadas por prioridad.

---

## Pipeline

- [ ] **Alertar al usuario cuando el extractor detecta un concepto no clasificado**
  Actualmente los conceptos desconocidos se guardan con `Subcategoría = "No clasificado"` sin ninguna señal visible. El ingestor debería emitir un aviso (log + resumen al final de cada ejecución) listando los conceptos nuevos para que el usuario pueda añadirlos a `Categorias de conceptos.json`.

## Frontend

## Acciones e Inversiones

- [ ] **Auto-sincronizar BDE al subir el Excel de acciones**
  Cuando el usuario suba un BenefitHistory.xlsx, disparar automáticamente la sincronización de tipos de cambio del BDE antes de procesar el fichero, para garantizar que `exchange_rates` tiene cobertura para todas las fechas del Excel. Si la sync falla, advertir al usuario pero permitir continuar.

- [ ] **Revisar solapamiento entre `portfolio_transactions` y `stock_transactions`**
  Una vez estabilizado el flujo de US2-5, evaluar si `portfolio_transactions` (ingesta actual via pipeline Python) puede migrarse o unificarse con `stock_transactions`. Documentar la decisión y eliminar la tabla redundante si procede.

- [ ] **Leer documentos de calendario de liberación de RSU**
  Procesar los documentos de vesting schedule (PDFs o similares) para extraer automáticamente las fechas y cantidades de cada liberación futura de RSU. Los datos deberían guardarse en Supabase y la app debería mostrar una línea de tiempo con los próximos eventos de vesting.

- [ ] **Permitir precio manual de CRM cuando la API no está disponible**
  Si la petición al API de Yahoo Finance falla (o devuelve error), mostrar al usuario un campo para introducir manualmente el precio de la acción de Salesforce (CRM) y calcular con ese valor hasta que el precio automático vuelva a estar disponible. El valor introducido debería persistir en `localStorage` para no pedirlo en cada visita.
