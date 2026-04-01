# Backlog

Tareas pendientes ordenadas por prioridad. Marcar con `[x]` cuando estén completadas.

---

## Pipeline

- [ ] **Alertar al usuario cuando el extractor detecta un concepto no clasificado**
  Actualmente los conceptos desconocidos se guardan con `Subcategoría = "No clasificado"` sin ninguna señal visible. El ingestor debería emitir un aviso (log + resumen al final de cada ejecución) listando los conceptos nuevos para que el usuario pueda añadirlos a `subcategorias.json`.

- [ ] **Actualizar `subcategorias.json` para incluir la categoría por regla**
  El JSON actual solo define `match` → `subcategory`. Añadir un campo `category` opcional por entrada (e.g. `"Ingreso"`, `"Devengo"`) para que el extractor pueda determinar la categoría directamente desde el catálogo, en lugar de inferirla por signo del importe. Esto haría el sistema más robusto ante conceptos que tienen categoría no estándar.

## Base de datos

- [ ] **Convertir `payroll_metrics_mv` de vista materializada a vista regular**
  La vista materializada requiere un `REFRESH` manual o programado tras cada ingesta. Una vista regular (`CREATE VIEW`) recalcula en tiempo real y simplifica el pipeline al eliminar el paso de refresco. Evaluar el impacto en rendimiento antes de migrar (el volumen de datos es bajo, la vista regular debería ser suficiente).
