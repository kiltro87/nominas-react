# Payroll Intelligence

Dashboard personal para analizar nóminas de Salesforce España: salario bruto/neto, IRPF, retenciones, ESPP, RSU y plan de pensiones.

**Producción:** https://kiltro87.github.io/nominas-react/

---

## Cómo funciona

```
Google Drive (PDFs de nóminas)
        │
        ▼  pipeline/drive_ingestor.py  (GitHub Actions · 1 vez/mes)
Supabase PostgreSQL
├── nominas      — una fila por concepto de nómina
├── control      — registro de qué PDFs se han procesado
└── payroll_metrics_mv — vista que agrega KPIs para la app
        │
        ▼  app/  React + Vite  (GitHub Actions · en cada push)
GitHub Pages → https://kiltro87.github.io/nominas-react/
```

- Los cambios en `pipeline/**` solo ejecutan el workflow de ingesta.
- Los cambios en `app/**` solo ejecutan el workflow de deploy.

---

## Estructura del repositorio

```
nominas-react/
├── app/                          ← Frontend React (Vite + Tailwind)
│   ├── src/
│   │   ├── components/           ← ProgressBar, StatCard
│   │   ├── data/payrollData.js   ← Mock con datos de demo
│   │   ├── hooks/
│   │   │   ├── usePayrollData.js     ← Carga datos (Supabase o mock)
│   │   │   ├── useStockPrice.js      ← Precio CRM en tiempo real
│   │   │   └── useSupabaseAuth.js    ← Autenticación
│   │   ├── services/
│   │   │   ├── payrollRepository.js  ← Consulta payroll_metrics_mv
│   │   │   └── supabaseClient.js     ← Cliente Supabase JS
│   │   ├── utils/
│   │   │   ├── format.js         ← formatCurrency, formatPercent
│   │   │   ├── irpf.js           ← Tramos IRPF Madrid 2024
│   │   │   └── trends.js         ← Variación interanual
│   │   └── App.jsx               ← Componente raíz
│   ├── public/404.html           ← Redirección SPA para GitHub Pages
│   ├── .env.example
│   └── vite.config.js
│
├── pipeline/                     ← Ingesta Python: Drive → Supabase
│   ├── extractor.py              ← Extrae y clasifica conceptos del PDF
│   ├── drive_ingestor.py         ← Orquesta Drive → extracción → Supabase
│   ├── subcategorias.json        ← Catálogo editable de conceptos
│   ├── requirements.txt
│   └── tests/
│
├── supabase/
│   ├── schema.sql                ← Tablas nominas + control
│   └── payroll_dashboard_mv.sql  ← Vista de KPIs
│
└── .github/workflows/
    ├── deploy.yml                ← Build y deploy de la app
    └── ingesta_nominas.yml       ← Tests y ejecución del pipeline
```

---

## Configuración inicial (una sola vez)

### 1. Supabase

**Crear el proyecto:**

1. Crea un proyecto en https://supabase.com/dashboard
2. Guarda:
   - **Project URL** → `https://<ref>.supabase.co`
   - **anon public key** → para la app React
   - **service role key** → para el pipeline Python (nunca exponerla en el frontend)

**Ejecutar el esquema SQL** en Supabase → SQL Editor:

```sql
-- Paso 1: crea las tablas
-- (pega el contenido de supabase/schema.sql)

-- Paso 2: crea la vista de KPIs
-- (pega el contenido de supabase/payroll_dashboard_mv.sql)
```

> `payroll_metrics_mv` es una vista regular: recalcula automáticamente en cada consulta, sin necesidad de refresh manual.

**Configurar URLs de autenticación** en Supabase → Authentication → URL Configuration:

| Campo | Valor |
|---|---|
| Site URL | `https://kiltro87.github.io/nominas-react/` |
| Redirect URLs | `https://kiltro87.github.io/nominas-react/**` |

Para desarrollo local añade también `http://localhost:5173/**`.

---

### 2. Google Drive (para el pipeline de ingesta)

1. Ve a [console.cloud.google.com](https://console.cloud.google.com) y selecciona tu proyecto
2. **APIs y servicios → Biblioteca** → busca **Google Drive API** → Habilitar
3. **APIs y servicios → Credenciales → Crear credenciales → Cuenta de servicio**
   - Asígnale un nombre (p.ej. `nominas-ingesta`) y termina el asistente
4. Haz clic en la cuenta de servicio creada → **Claves → Añadir clave → Crear clave nueva → JSON**
   - Se descarga un fichero JSON — guárdalo como `pipeline/credentials.json`
5. En Google Drive, abre la carpeta de nóminas → **Compartir** → pega el email de la cuenta de servicio (termina en `@<proyecto>.iam.gserviceaccount.com`) → rol **Editor**

---

### 3. Secrets de GitHub

Ve a **Settings → Secrets and variables → Actions** y añade:

| Secret | Valor | Dónde encontrarlo |
|---|---|---|
| `VITE_SUPABASE_URL` | URL del proyecto | Supabase → Settings → API → Project URL |
| `VITE_SUPABASE_ANON_KEY` | Clave pública | Supabase → Settings → API → `anon public` |
| `SUPABASE_SERVICE_ROLE_KEY` | Clave privada del servidor | Supabase → Settings → API → `service_role` |
| `GOOGLE_CREDENTIALS_JSON` | Contenido completo del JSON | Fichero descargado en el paso anterior (pega el texto, no el nombre) |
| `DRIVE_FOLDER_ID` | ID de la carpeta de Drive con nóminas | URL de la carpeta: `drive.google.com/drive/folders/<ID>` |
| `PORTFOLIO_FILE_ID` | ID del Excel de cartera en Drive | URL del fichero: `drive.google.com/file/d/<ID>/view` |

> `VITE_SUPABASE_URL` lo usan tanto la app React como el pipeline Python (evita duplicar el secret).

---

### 4. Activar GitHub Pages

En **Settings → Pages**:
- Source: **Deploy from a branch**
- Branch: `gh-pages` / `/ (root)`

El primer push a `main` que toque `app/**` desplegará la app automáticamente.

---

## Desarrollo local

### App React

```bash
cd app
npm install
cp .env.example .env   # añade VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY
npm run dev            # http://localhost:5173
```

Sin credenciales la app arranca en **modo mock** con datos de demo.

**Scripts disponibles:**

```bash
npm run dev       # servidor de desarrollo
npm run build     # build de producción
npm run check     # lint + tests + build (igual que CI)
npm test          # tests en modo watch
npm run lint      # solo ESLint
```

### Pipeline Python

```bash
cd pipeline
pip install -r requirements.txt
```

Crea `pipeline/config.json` (no subir al repo, está en `.gitignore`):

```json
{
  "credentials_path": "credentials.json",
  "drive_folder_id": "ID_DE_TU_CARPETA_DRIVE",
  "supabase_url": "https://<ref>.supabase.co",
  "supabase_service_role_key": "<service_role_key>",
  "supabase_schema": "public"
}
```

Ejecutar ingesta:

```bash
python drive_ingestor.py --config config.json

# Limitar a N PDFs para pruebas:
python drive_ingestor.py --config config.json --limit 5
```

Ejecutar tests:

```bash
python -m pytest -q
```

---

## Cómo funciona la ingesta

**Qué escribe en Supabase:**
- `nominas` — año, mes, concepto, importe, categoría, subcategoría
- `control` — registro de cada PDF (file_id, md5, estado, fecha)

**Deduplicación:**
- Por `file_id` — el mismo archivo no se reprocesa aunque se lance la ingesta varias veces
- Por `md5_drive` — si se sube el mismo PDF con otro nombre, se detecta y se omite

**Organización automática en Drive:**
Cada PDF procesado se renombra a `Nómina <Mes> <Año>.pdf` y se mueve a una subcarpeta anual (`/2025`, `/2026`…).

**Procesado incremental:**
Solo busca archivos modificados desde la última ejecución registrada en `control`.

**Clasificación de conceptos:**
`subcategorias.json` mapea cada concepto de nómina a una subcategoría. Si un concepto nuevo no aparece en el catálogo, se guarda con subcategoría `"No clasificado"` para revisión manual.

**Reprocesar un PDF concreto:**

```sql
-- En Supabase → SQL Editor
DELETE FROM public.control WHERE file_id = '<id_del_archivo>';
```

Luego ejecuta la ingesta de nuevo.

---

## Cartera de Valores (ESPP / RSU)

### Configuración

La pestaña **Inversiones** de la app muestra los datos del Excel de cartera generado por el script de procesado de PDFs de eTrade. Para sincronizarlo:

1. Localiza el ID del fichero Excel en Google Drive (URL: `drive.google.com/file/d/<ID>/view`)
2. Añade el secret `PORTFOLIO_FILE_ID` en GitHub → Settings → Secrets and variables → Actions

### Ejecutar la ingesta de cartera

1. Ve a **GitHub → Actions → Ingesta Nominas Drive to Supabase → Run workflow**
2. Activa la opción **"Sincronizar cartera de valores"** → Run workflow

El job `portfolio` descarga el Excel, descarta duplicados y hace upsert en la tabla `portfolio_transactions`.

### Estructura del Excel esperado

| Columna | Descripción |
|---|---|
| `FILE_NAME` | Nombre del PDF origen (clave de deduplicación) |
| `RELEASE_PURCHASE_TRADE_DATE` | Fecha de la operación |
| `QUANTITY` | Nº de acciones (negativo en ventas) |
| `STOCK_PRICE` | Precio en USD |
| `NET_AMOUNT` | Importe neto en USD |
| `AEAT_Tipo_Operacion` | `AD` (adquisición) o `TR` (venta) |
| `AEAT_Fecha` | Fecha en formato dd/mm/yyyy |
| `AEAT_Num_Titulos` | Nº de títulos (siempre positivo) |
| `Conversion_Rate` | Tipo de cambio USD/EUR |
| `AEAT_Importe_Euro` | Importe convertido a EUR |
| `CUMULATIVE_QUANTITY` | Acciones acumuladas en cartera tras la operación |

---

## Automatización

El workflow `ingesta_nominas.yml` se ejecuta:
- El **día 1 de cada mes** a las 08:00 UTC
- **Manualmente** desde Actions → `Ingesta Nominas Drive to Supabase` → Run workflow
- En cada push a `main` con cambios en `pipeline/**`

El workflow `deploy.yml` se ejecuta en cada push a `main` con cambios en `app/**`.

---

## Gestión de usuarios

**Crear usuario:** Supabase → Authentication → Users → Add user.

**Establecer o cambiar contraseña** desde la pantalla de login:
1. Haz clic en **"¿No tienes contraseña o la olvidaste?"**
2. Introduce tu email → recibes un enlace
3. Al hacer clic en el enlace la app muestra el formulario de nueva contraseña

**Métodos de acceso:**

| Método | Cuándo usarlo |
|---|---|
| Email + contraseña | Acceso habitual |
| Magic link | Primera vez o si olvidaste la contraseña |
