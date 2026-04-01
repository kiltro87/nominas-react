# Payroll Intelligence

Dashboard personal para analizar nóminas de Salesforce España: IRPF, retenciones, ESPP, RSU, plan de pensiones y evolución mensual.

**URL de producción:** https://kiltro87.github.io/nominas-react/

---

## Tabla de contenidos

1. [Arquitectura](#arquitectura)
2. [Estructura del repositorio](#estructura-del-repositorio)
3. [Configuración de Supabase](#configuración-de-supabase)
4. [Pipeline Python (ingesta)](#pipeline-python-ingesta)
5. [App React (frontend)](#app-react-frontend)
6. [Despliegue en GitHub Pages](#despliegue-en-github-pages)
7. [Gestión de usuarios](#gestión-de-usuarios)

---

## Arquitectura

```
Google Drive
└── PDFs de nóminas
        │
        ▼  (GitHub Actions — ingesta_nominas.yml)
pipeline/drive_ingestor.py
        │  extrae, clasifica e inserta filas
        ▼
Supabase PostgreSQL
├── tabla: nominas
├── tabla: control  (deduplicación y auditoría)
└── view:  payroll_metrics_mv  (agrega KPIs para la app)
        │
        ▼  (GitHub Actions — deploy.yml)
app/  React + Vite
        │  lee solo la MV, nunca escribe
        ▼
GitHub Pages  →  https://kiltro87.github.io/nominas-react/
```

Cada parte se despliega de forma independiente:
- Cambios en `pipeline/**` activan solo el workflow de ingesta.
- Cambios en `app/**` activan solo el workflow de deploy de la React app.

---

## Estructura del repositorio

```
nominas-react/
├── app/                          ← React frontend (Vite + Tailwind)
│   ├── public/
│   │   └── 404.html              ← Redirección SPA para GitHub Pages
│   ├── src/
│   │   ├── components/           ← ProgressBar, StatCard
│   │   ├── data/payrollData.js   ← Dataset mock (fallback sin Supabase)
│   │   ├── hooks/
│   │   │   ├── usePayrollData.js     ← Carga Supabase vs mock
│   │   │   ├── useStockPrice.js      ← Precio CRM en tiempo real
│   │   │   └── useSupabaseAuth.js    ← Auth: login, magic link, reset password
│   │   ├── services/
│   │   │   ├── payrollRepository.js  ← Consulta payroll_metrics_mv
│   │   │   └── supabaseClient.js     ← Singleton Supabase JS
│   │   ├── utils/
│   │   │   ├── format.js         ← formatCurrency, formatPercent
│   │   │   ├── irpf.js           ← Tramos IRPF Madrid 2024
│   │   │   └── trends.js         ← Comparativa año anterior
│   │   └── App.jsx               ← Componente raíz + todas las vistas
│   ├── .env.example
│   ├── vite.config.js
│   └── package.json
│
├── pipeline/                     ← Python: ingesta Drive → Supabase
│   ├── extractor.py              ← Extrae texto/tablas del PDF, clasifica y divide conceptos
│   ├── drive_ingestor.py         ← Orquesta Drive → extracción → Supabase
│   ├── subcategorias.json        ← Catálogo concepto → subcategoría (editable)
│   ├── requirements.txt
│   ├── runtime.txt
│   ├── nominas_app/
│   │   └── services/
│   │       ├── supabase_client.py    ← Cliente REST Supabase (Python)
│   │       └── config_loader.py     ← Carga config/secrets
│   └── tests/
│       ├── test_extractor_core.py
│       └── test_drive_ingestor.py
│
├── supabase/                     ← SQL completo del esquema
│   ├── schema.sql                ← Tablas nominas + control + índices
│   └── payroll_dashboard_mv.sql  ← Materialized view de KPIs
│
├── .github/
│   └── workflows/
│       ├── deploy.yml            ← Build + deploy React (se activa con cambios en app/)
│       └── ingesta_nominas.yml   ← Tests + ingesta Python (se activa con cambios en pipeline/)
│
└── README.md
```

---

## Configuración de Supabase

### 1. Crear el proyecto

1. Crea un proyecto en https://supabase.com/dashboard
2. Anota el **Project URL** y:
   - **anon public key** → para la app React
   - **service role key** → para el pipeline Python (nunca exponer en el frontend)

### 2. Ejecutar el esquema SQL

En el SQL Editor de Supabase, ejecuta en orden:

```sql
-- 1. Tablas base
-- Contenido de supabase/schema.sql
```

```sql
-- 2. Materialized view de KPIs
-- Contenido de supabase/payroll_dashboard_mv.sql
```

Para refrescar la MV manualmente tras insertar datos:

```sql
REFRESH MATERIALIZED VIEW public.payroll_metrics_mv;
```

> El pipeline Python refresca la MV automáticamente tras cada ingesta.

### 3. Configurar URLs de autenticación

En **Authentication → URL Configuration**:

| Campo | Valor |
|---|---|
| Site URL | `https://kiltro87.github.io/nominas-react/` |
| Redirect URLs | `https://kiltro87.github.io/nominas-react/**` |

Para desarrollo local añade también `http://localhost:5173/**`.

---

## Pipeline Python (ingesta)

### Configuración local

#### 1. Instalar dependencias

```bash
cd pipeline
pip install -r requirements.txt
```

#### 2. Credenciales Google Drive

1. Ve a [console.cloud.google.com](https://console.cloud.google.com) y selecciona tu proyecto
2. **APIs y servicios → Biblioteca** → busca **Google Drive API** → Habilitar
3. **APIs y servicios → Credenciales → Crear credenciales → Cuenta de servicio**
   - Asígnale un nombre (p.ej. `nominas-ingesta`) y termina el asistente
4. Haz clic en la cuenta de servicio creada → **Claves → Añadir clave → Crear clave nueva → JSON**
   - Se descarga un fichero JSON — guárdalo como `pipeline/credentials.json`
5. Copia el **email** de la cuenta de servicio (termina en `@<proyecto>.iam.gserviceaccount.com`)
6. En Google Drive, abre la carpeta de nóminas → **Compartir** → pega ese email → rol **Editor**

#### 3. Fichero de configuración

Crea `pipeline/config.json` (no subir al repo):

```json
{
  "credentials_path": "credentials.json",
  "drive_folder_id": "ID_DE_TU_CARPETA_DRIVE",
  "supabase_url": "https://<project-ref>.supabase.co",
  "supabase_service_role_key": "<service_role_key>",
  "supabase_schema": "public"
}
```

#### 4. Ejecutar ingesta

```bash
cd pipeline
python drive_ingestor.py --config config.json

# Limitar a N PDFs para pruebas:
python drive_ingestor.py --config config.json --limit 5
```

#### 5. Ejecutar tests

```bash
cd pipeline
python -m pytest -q
```

> **Nunca subas al repo** `credentials.json` ni `config.json` — están en `.gitignore`.

### Comportamiento de la ingesta

**Qué escribe en Supabase:**
- Tabla `nominas` — año, mes, concepto, importe, categoría, subcategoría, file_id, file_name
- Tabla `control` — registro de cada PDF procesado con estado, md5, ruta en Drive y versión de reglas

**Deduplicación:**
- Por `file_id` — el mismo archivo no se reprocesa aunque se vuelva a ejecutar la ingesta
- Por `md5_drive` — si se sube el mismo PDF con otro nombre, se detecta y se omite por contenido

**Organización automática en Drive:**
Cada PDF procesado se renombra a `Nómina <Mes> <Año>.pdf` y se mueve a una subcarpeta anual (`/2025`, `/2026`…). Si la subcarpeta no existe, se crea.

**Procesado incremental:**
La ingesta solo busca archivos modificados desde la última ejecución registrada en `control`, con un margen de seguridad.

### Clasificación de conceptos

`subcategorias.json` es el catálogo editable que mapea cada concepto de nómina a una subcategoría. Si añades un concepto nuevo o cambia el nombre en el PDF, edítalo aquí.

### Cómo reprocesar un PDF concreto

Si necesitas volver a procesar un archivo ya ingestado:

```sql
-- En el SQL Editor de Supabase
DELETE FROM public.control WHERE file_id = '<id_del_archivo>';
```

Luego ejecuta la ingesta de nuevo. El `file_id` de cada archivo está visible en la pestaña `control` de Supabase.

### Automatización con GitHub Actions

El workflow `ingesta_nominas.yml` se ejecuta:
- El **día 1 de cada mes** a las 08:00 UTC
- **Manualmente** desde Actions → Run workflow (con `limit` opcional)
- En cada push a `main` que toque archivos de `pipeline/`

**Secrets necesarios en GitHub** (Settings → Secrets and variables → Actions):

| Secret | Valor | Dónde encontrarlo |
|---|---|---|
| `GOOGLE_CREDENTIALS_JSON` | Contenido completo del JSON del Service Account | Fichero descargado en el paso anterior (pega el texto completo, no el nombre) |
| `DRIVE_FOLDER_ID` | ID de la carpeta de Drive | URL de la carpeta: `drive.google.com/drive/folders/<ID>` |
| `VITE_SUPABASE_URL` | URL del proyecto Supabase | Supabase → Settings → API → Project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Service Role Key | Supabase → Settings → API → `service_role` (distinta de la `anon`) |
| `SUPABASE_SCHEMA` | `public` | Dejar en `public` salvo que uses otro esquema |

> El pipeline Python reutiliza el secret `VITE_SUPABASE_URL` — el prefijo `VITE_` lo exige Vite para exponer variables al navegador, pero el nombre del secret en GitHub es solo un nombre y puede usarse desde cualquier workflow.

---

## App React (frontend)

### Desarrollo local

```bash
cd app
npm install
cp .env.example .env   # rellenar con tus credenciales Supabase
npm run dev            # http://localhost:5173
```

> Sin credenciales la app arranca en modo **mock** con datos de demostración.

### Scripts disponibles

```bash
npm run dev       # servidor de desarrollo
npm run check     # lint + tests + build (igual que CI)
npm test          # tests en modo watch
npm run lint      # solo ESLint
npm run build     # build de producción en app/dist/
```

---

## Despliegue en GitHub Pages

El despliegue es **automático** en cada push a `main` que modifique archivos de `app/`.

### Configuración inicial (una sola vez)

**1. Secrets en GitHub** (Settings → Secrets and variables → Actions):

| Secret | Valor |
|---|---|
| `VITE_SUPABASE_URL` | URL de tu proyecto Supabase |
| `VITE_SUPABASE_ANON_KEY` | Clave **anon/pública** de Supabase |

**2. Activar GitHub Pages** (Settings → Pages):
- Source: **Deploy from a branch**
- Branch: `gh-pages` / `/ (root)`

Tras el primer push la app estará en `https://kiltro87.github.io/nominas-react/`.

---

## Gestión de usuarios

### Crear un usuario

En **Supabase Dashboard → Authentication → Users → Add user**.

### Establecer o cambiar contraseña

Desde la pantalla de login de la app:

1. Haz clic en **"¿No tienes contraseña o la olvidaste?"**
2. Introduce tu email → recibes un enlace
3. Al hacer clic en el enlace la app muestra el formulario de nueva contraseña

### Métodos de acceso

| Método | Cuándo usarlo |
|---|---|
| Email + contraseña | Acceso habitual |
| Magic link | Primera vez o si olvidaste la contraseña |
