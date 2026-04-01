# Backlog

Tareas pendientes ordenadas por prioridad. Marcar con `[x]` cuando estén completadas.

---

## Pipeline

- [ ] **Alertar al usuario cuando el extractor detecta un concepto no clasificado**
  Actualmente los conceptos desconocidos se guardan con `Subcategoría = "No clasificado"` sin ninguna señal visible. El ingestor debería emitir un aviso (log + resumen al final de cada ejecución) listando los conceptos nuevos para que el usuario pueda añadirlos a `subcategorias.json`.

- [ ] **Actualizar `subcategorias.json` para incluir la categoría por regla**
  El JSON actual solo define `match` → `subcategory`. Añadir un campo `category` opcional por entrada (e.g. `"Ingreso"`, `"Devengo"`) para que el extractor pueda determinar la categoría directamente desde el catálogo, en lugar de inferirla por signo del importe. Esto haría el sistema más robusto ante conceptos que tienen categoría no estándar.

## Frontend

- [x] **Corregir los porcentajes de crecimiento/decrecimiento en las tarjetas**
  Los valores de tendencia (flecha arriba/abajo en las StatCard) no están siendo calculados correctamente. Revisar `utils/trends.js` y cómo se pasan los datos a cada tarjeta para asegurarse de que el YoY refleja el campo correcto y el año anterior existe en los datos.

- [ ] **Añadir vista histórica (agregado de todos los años)**
  Actualmente el selector de año filtra a un único ejercicio. Añadir una opción "Todos los años" que muestre métricas acumuladas o promediadas, y que el gráfico de evolución muestre el histórico completo sin filtro de año.

## Acciones e Inversiones

- [ ] **Sincronizar datos de cartera desde la hoja de Google de Iñaki**
  El script de Iñaki deposita datos de RSU y ESPP en una hoja de Google Sheets. Crear un proceso de ingesta que lea esa hoja (Google Sheets API) y almacene los datos en Supabase. La tabla debería registrar tipo de acción (RSU/ESPP), cantidad, fecha de adquisición/liberación, precio de compra y valor actual. Con esto la app podría mostrar el número de acciones en cartera, su valor total y la rentabilidad acumulada.

- [ ] **Leer documentos de calendario de liberación de RSU**
  Procesar los documentos de vesting schedule (PDFs o similares) para extraer automáticamente las fechas y cantidades de cada liberación futura de RSU. Los datos deberían guardarse en Supabase y la app debería mostrar una línea de tiempo con los próximos eventos de vesting.

- [ ] **Permitir precio manual de CRM cuando la API no está disponible**
  Si la petición al API de Yahoo Finance falla (o devuelve error), mostrar al usuario un campo para introducir manualmente el precio de la acción de Salesforce (CRM) y calcular con ese valor hasta que el precio automático vuelva a estar disponible. El valor introducido debería persistir en `localStorage` para no pedirlo en cada visita.

## Base de datos

- [x] **Convertir `payroll_metrics_mv` de vista materializada a vista regular**
  La vista materializada requiere un `REFRESH` manual o programado tras cada ingesta. Una vista regular (`CREATE VIEW`) recalcula en tiempo real y simplifica el pipeline al eliminar el paso de refresco. Evaluar el impacto en rendimiento antes de migrar (el volumen de datos es bajo, la vista regular debería ser suficiente).
