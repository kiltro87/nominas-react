# Payroll Intelligence

Dashboard personal para analizar nóminas de Salesforce España: IRPF, retenciones, ESPP, RSU, plan de pensiones y evolución mensual.

**URL de producción:** https://kiltro87.github.io/nominas-react/

---

## Tabla de contenidos

1. [Arquitectura](#arquitectura)
2. [Requisitos previos](#requisitos-previos)
3. [Configuración de Supabase](#configuración-de-supabase)
4. [Desarrollo local](#desarrollo-local)
5. [Despliegue en GitHub Pages](#despliegue-en-github-pages)
6. [Gestión de usuarios](#gestión-de-usuarios)
7. [Pipeline de datos (Python)](#pipeline-de-datos-python)
8. [Estructura del proyecto](#estructura-del-proyecto)

---

## Arquitectura

```
GitHub (este repo)
├── GitHub Actions  →  ejecuta lint + tests + build en cada push a main
├── GitHub Pages    →  sirve la app React compilada
└── Python workflows (rama separada)  →  lee nóminas de Google Drive e inserta en Supabase

Supabase
├── PostgreSQL: tabla `nominas` + materialized view `payroll_metrics_mv`
└── Auth: gestión de usuarios con RLS

Google Drive
└── PDFs/Excel de nóminas  →  input del pipeline Python
```

La app React **solo lee** la materialized view `payroll_metrics_mv`. Nunca escribe en la base de datos.

---

## Requisitos previos

- Node.js 20+
- Una cuenta en [Supabase](https://supabase.com) (plan gratuito suficiente)
- Repositorio en GitHub con GitHub Pages habilitado

---

## Configuración de Supabase

### 1. Crear el proyecto

1. Crea un proyecto en https://supabase.com/dashboard
2. Anota el **Project URL** y la **anon public key** (Settings → API)

### 2. Crear la tabla `nominas`

En el SQL Editor ejecuta:

```sql
create table public.nominas (
  id          bigserial primary key,
  año         text not null,
  mes         text not null,
  concepto    text not null,
  importe     numeric not null,
  "categoría"    text,
  "subcategoría" text,
  file_id     text,
  file_name   text,
  created_at  timestamptz default now()
);
```

### 3. Crear la materialized view

Ejecuta el contenido completo de [`app/supabase/payroll_dashboard_mv.sql`](app/supabase/payroll_dashboard_mv.sql).

Para refrescarla manualmente después de insertar datos:

```sql
refresh materialized view public.payroll_metrics_mv;
```

> El pipeline Python refresca la view automáticamente tras cada carga.

### 4. Activar Row Level Security (RLS)

```sql
alter table public.nominas enable row level security;

-- Solo el propietario de los datos puede leer sus filas
create policy "owner can read" on public.nominas
  for select using (auth.uid() = user_id);
```

> Si la tabla no tiene columna `user_id` y es de uso personal, puedes usar una política más simple:
> `create policy "authenticated read" on public.nominas for select to authenticated using (true);`

### 5. Configurar URLs de autenticación

En **Authentication → URL Configuration**:

| Campo | Valor |
|---|---|
| Site URL | `https://kiltro87.github.io/nominas-react/` |
| Redirect URLs | `https://kiltro87.github.io/nominas-react/**` |

Para desarrollo local añade también:
- `http://localhost:5173/**`

---

## Desarrollo local

### 1. Clonar e instalar

```bash
git clone https://github.com/kiltro87/nominas-react.git
cd nominas-react/app
npm install
```

### 2. Variables de entorno

```bash
cp .env.example .env
```

Edita `.env` con tus credenciales de Supabase:

```env
VITE_SUPABASE_URL=https://<tu-project-ref>.supabase.co
VITE_SUPABASE_ANON_KEY=<tu-anon-key>
```

> Si no tienes credenciales, la app arranca igualmente en modo **mock** con datos de demostración.

### 3. Arrancar el servidor de desarrollo

```bash
npm run dev
```

Abre http://localhost:5173

### 4. Ejecutar tests y lint

```bash
npm run check       # lint + tests + build (igual que CI)
npm test            # solo tests en modo watch
npm run lint        # solo ESLint
```

---

## Despliegue en GitHub Pages

El despliegue es **automático** en cada push a `main` via GitHub Actions (`.github/workflows/deploy.yml`).

### Configuración inicial (una sola vez)

#### 1. Añadir secrets en GitHub

En **Settings → Secrets and variables → Actions** crea:

| Secret | Valor |
|---|---|
| `VITE_SUPABASE_URL` | URL de tu proyecto Supabase |
| `VITE_SUPABASE_ANON_KEY` | Clave anon/pública de Supabase |

> Usa siempre la clave **anon (pública)**, nunca la `service_role`. La anon key es segura en el frontend porque Supabase RLS controla el acceso a los datos.

#### 2. Activar GitHub Pages

En **Settings → Pages**:
- Source: **Deploy from a branch**
- Branch: `gh-pages` / `/ (root)`

#### 3. Hacer push a main

```bash
git push origin main
```

El workflow se encarga de todo: lint → tests → build → publicar en `gh-pages`.

### Cómo funciona la SPA en GitHub Pages

GitHub Pages devuelve 404 para rutas que no sean `index.html`. Se soluciona con dos piezas:

1. **`app/public/404.html`** — codifica la ruta en la query string y redirige a `/`
2. **Script en `app/index.html`** — decodifica la query string y restaura la URL antes de que React se monte

---

## Gestión de usuarios

### Crear un usuario

En **Supabase Dashboard → Authentication → Users → Add user**.

### Establecer o cambiar contraseña

Desde la pantalla de login de la app:

1. Haz clic en **"¿No tienes contraseña o la olvidaste?"**
2. Introduce tu email y haz clic en **"Enviar enlace de restablecimiento"**
3. Abre el email y haz clic en el enlace
4. La app te lleva directamente al formulario para establecer la nueva contraseña

### Métodos de acceso disponibles

| Método | Cuándo usarlo |
|---|---|
| Email + contraseña | Acceso habitual una vez establecida la contraseña |
| Magic link | Acceso sin contraseña; útil la primera vez o si olvidaste la contraseña |

---

## Pipeline de datos (Python)

Los workflows de Python (en rama separada) se encargan de:

1. Leer los PDFs/Excel de nóminas desde Google Drive
2. Parsear y categorizar cada concepto
3. Insertar los registros en la tabla `nominas` de Supabase
4. Ejecutar `REFRESH MATERIALIZED VIEW payroll_metrics_mv`

La app React es completamente independiente de este pipeline: solo lee la view y nunca escribe.

---

## Estructura del proyecto

```
nominas-react/
├── .github/
│   └── workflows/
│       └── deploy.yml          # CI/CD: lint + test + build + GitHub Pages
├── app/
│   ├── public/
│   │   └── 404.html            # Redirección SPA para GitHub Pages
│   ├── src/
│   │   ├── components/
│   │   │   ├── ProgressBar.jsx
│   │   │   └── StatCard.jsx
│   │   ├── data/
│   │   │   └── payrollData.js  # Dataset mock (usado si no hay Supabase)
│   │   ├── hooks/
│   │   │   ├── usePayrollData.js    # Orquesta carga Supabase vs mock
│   │   │   ├── useStockPrice.js     # Precio en tiempo real de CRM (Salesforce)
│   │   │   └── useSupabaseAuth.js   # Auth: login, magic link, reset password
│   │   ├── services/
│   │   │   ├── payrollRepository.js # Consulta a payroll_metrics_mv
│   │   │   └── supabaseClient.js    # Singleton del cliente Supabase
│   │   ├── utils/
│   │   │   ├── format.js       # formatCurrency, formatPercent
│   │   │   ├── irpf.js         # Cálculo de tramos IRPF (Madrid 2024)
│   │   │   └── trends.js       # Comparativa año anterior
│   │   ├── App.jsx             # Componente raíz + todas las vistas
│   │   └── main.jsx
│   ├── supabase/
│   │   └── payroll_dashboard_mv.sql  # DDL de la materialized view
│   ├── .env.example
│   ├── vite.config.js
│   └── package.json
└── README.md
```
