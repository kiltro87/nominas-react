# Pipeline — Ingesta de Nóminas

Procesa PDFs de nómina desde Google Drive, los clasifica e inserta en Supabase.
Para la documentación completa del sistema consulta el [README raíz](../README.md).

---

## Archivos principales

| Archivo | Función |
|---|---|
| `extractor.py` | Extrae texto/tablas del PDF, detecta período, clasifica líneas y construye filas. Divide automáticamente conceptos con IRPF embebido (e.g. `TRIBUTACION I.R.P.F.33,17`) en una fila de importe y una fila `% IRPF` separada. |
| `drive_ingestor.py` | Orquesta Drive → extracción → Supabase; renombra y mueve PDFs |
| `Categorias de conceptos.json` | Catálogo editable concepto → categoría + subcategoría |
| `nominas_app/services/supabase_client.py` | Cliente REST Supabase (select, insert, paginación) |
| `nominas_app/services/config_loader.py` | Carga `config.json` o secrets de entorno |

> Los KPIs **no se calculan en Python**. El pipeline inserta filas en la tabla `payrolls` y Supabase se encarga de agregar todo a través de la vista `payroll_metrics_mv`. `kpi_builder.py` y las herramientas de migración desde Google Sheets (`migrate_sheets_to_supabase.py`, `sheets_client.py`) ya no forman parte del proyecto.

---

## Setup rápido

```bash
pip install -r requirements.txt
```

Crea `config.json` (no subir al repo):

```json
{
  "credentials_path": "credentials.json",
  "drive_folder_id": "ID_CARPETA_DRIVE",
  "supabase_url": "https://<project>.supabase.co",
  "supabase_service_role_key": "<service_role_key>",
  "supabase_schema": "public"
}
```

---

## Uso

```bash
# Ingesta completa
python drive_ingestor.py --config config.json

# Limitar a N PDFs (para pruebas)
python drive_ingestor.py --config config.json --limit 5

# Tests
python -m pytest -q
```

---

## Operaciones habituales

### Reprocesar un PDF concreto

```sql
DELETE FROM public.control WHERE file_id = '<id>';
```

Luego vuelve a ejecutar la ingesta. El `file_id` está visible en la tabla `control` de Supabase.

### Añadir o corregir la clasificación de un concepto

Edita `Categorias de conceptos.json`. Cada entrada tiene tres campos: `concepto` (token de búsqueda), `categoria` (`"Ingreso"` o `"Deducción"`) y `subcategoria`. El campo `rules_version` en `control` registra con qué versión del catálogo se clasificó cada archivo, lo que permite auditar cambios.

### Actualizar la materialized view manualmente

```sql
REFRESH MATERIALIZED VIEW public.payroll_metrics_mv;
```

La ingesta lo hace automáticamente al terminar. Solo es necesario si insertas datos de otra forma.

---

## Deduplicación

La ingesta evita reprocesar el mismo archivo de dos maneras:
- **Por `file_id`** — mismo archivo en Drive, aunque haya cambiado de carpeta
- **Por `md5_drive`** — mismo contenido con distinto nombre o ID (evita duplicados lógicos)
