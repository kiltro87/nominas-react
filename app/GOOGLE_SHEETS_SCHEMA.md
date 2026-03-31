# Google Sheets schema

Para que la app cargue datos reales desde Google Sheets, crea estas pestañas:

- `annual_by_year`
- `history`
- `tax_brackets`
- `vesting_schedule`

## annual_by_year

Columnas esperadas:

- `year`
- `monthly_bruto`
- `monthly_neto`
- `monthly_irpf`
- `monthly_total_ingresos`
- `monthly_ahorro_fiscal`
- `monthly_jubilacion`
- `monthly_especie`
- `annual_bruto`
- `annual_neto`
- `annual_irpf_efectivo`
- `annual_ahorro_total`
- `annual_total_impuestos`
- `annual_total_ss`

## history

Columnas esperadas:

- `year`
- `month`
- `bruto`
- `neto`
- `tax`

## tax_brackets

Columnas esperadas:

- `limit`
- `rate`
- `paid`

## vesting_schedule

Columnas esperadas:

- `date`
- `type`
- `amount`
- `status`

## Requisitos de acceso

- Configura OAuth en Google Cloud y añade en `app/.env`:
  - `VITE_GOOGLE_CLIENT_ID`
  - `VITE_GOOGLE_SHEET_URL`
- Habilita Google Sheets API en tu proyecto de Google Cloud.
- Añade tu origen (por ejemplo `http://localhost:5173`) en "Authorized JavaScript origins".
- Comparte la hoja con la cuenta Google que inicie sesion en la app.
