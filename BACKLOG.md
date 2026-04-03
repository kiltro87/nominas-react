# Backlog

Tareas pendientes ordenadas por prioridad. Marcar con `[x]` cuando estén completadas.

---

## Pipeline

- [ ] **Alertar al usuario cuando el extractor detecta un concepto no clasificado**
  Actualmente los conceptos desconocidos se guardan con `Subcategoría = "No clasificado"` sin ninguna señal visible. El ingestor debería emitir un aviso (log + resumen al final de cada ejecución) listando los conceptos nuevos para que el usuario pueda añadirlos a `Categorias de conceptos.json`.

## Frontend


## Acciones e Inversiones

- [ ] **Revisar solapamiento entre `portfolio_transactions` y `stock_transactions`**
  Una vez implementadas US 2-5, evaluar si `portfolio_transactions` (ingesta actual desde PDFs via pipeline Python) puede migrarse o unificarse con `stock_transactions` (nueva tabla AEAT). Documentar la decisión y eliminar la tabla redundante si procede.

- [ ] **Auto-sincronizar BDE al subir el Excel de acciones**
  Cuando el usuario suba un BenefitHistory.xlsx, disparar automáticamente la sincronización de tipos de cambio del BDE antes de procesar el fichero, para garantizar que `exchange_rates` tiene cobertura para todas las fechas del Excel. Si la sync falla, advertir al usuario pero permitir continuar.

- [ ] **Leer documentos de calendario de liberación de RSU**
  Procesar los documentos de vesting schedule (PDFs o similares) para extraer automáticamente las fechas y cantidades de cada liberación futura de RSU. Los datos deberían guardarse en Supabase y la app debería mostrar una línea de tiempo con los próximos eventos de vesting.

- [ ] **Permitir precio manual de CRM cuando la API no está disponible**
  Si la petición al API de Yahoo Finance falla (o devuelve error), mostrar al usuario un campo para introducir manualmente el precio de la acción de Salesforce (CRM) y calcular con ese valor hasta que el precio automático vuelva a estar disponible. El valor introducido debería persistir en `localStorage` para no pedirlo en cada visita.

- [X] US 1: Sincronización Automatizada de Divisas (BDE API)
Descripción: Como usuario, quiero que el sistema consuma los datos del Banco de España mediante su API para tener siempre los tipos de cambio actualizados sin subir archivos manuales.

Detalle de Implementación
Botón UI: "Actualizar Divisas desde BDE".

Endpoint: https://app.bde.es/bierest/resources/srdatosapp/listaSeries?idioma=es&series=DTCCBCEUSDEUR.B&rango=36M

Procesamiento del JSON:

Navegar por la estructura del JSON hasta llegar al array de datos de la serie DTCCBCEUSDEUR.B.

Mapeo: Extraer el campo de fecha (formato ISO o similar según respuesta) y el valor del tipo de cambio (USD por 1 EUR).

Acción de Persistencia:

Realizar un Upsert en la tabla exchange_rates de Supabase.

Clave Primaria: exchange_date.

Feedback: Mostrar mensaje "Sincronización completada: [X] nuevos registros añadidos".

- [ ] US 2: Procesamiento Detallado de "Restricted Stock" (RSU)
Descripción: Como usuario, quiero procesar la pestaña de RSU siguiendo las reglas de unificación de filas de adquisición e impuestos del script original.

Reglas de Extracción (Pestaña: Restricted Stock)
Paso 1 (Identificación): Localizar filas donde Columna A (Record Type) = Grant. Guardar el Grant Number (Col. B).

Paso 2 (Fila Adquisición): Localizar fila con mismo Grant Number, donde Columna G (Event Type) esté VACÍO.

Extraer: Fecha (Col. E), Cantidad Bruta (Col. H), Market Value (Col. I).

Paso 3 (Fila Impuestos - Merging): Localizar la fila inmediatamente posterior que cumpla:

Mismo Grant Number (Col. B).

Mismo Vest Period (Col. D).

Columna G (Event Type) contenga la palabra "Tax".

Extraer: Cantidad Retenida (Col. H, valor negativo).

Cálculos de Negocio:

NET_QTY (Acciones en cartera) = Col.H (Adq) + Col.H (Tax).

AEAT_NUM_TITULOS (Base imponible) = Col.H (Adq) (La cantidad bruta entregada).

Exclusiones: Omitir filas donde Columna A = Total.

- [ ] US 3: Procesamiento Detallado de "ESPP"
Descripción: Como usuario, quiero mapear las compras y ventas de la pestaña ESPP validando la integridad de las cantidades compradas.

Reglas de Extracción (Pestaña: ESPP)
Evento Compra:

Cabecera: Columna A = Purchase.

Detalle: Fila inferior donde Columna G (Event Type) = PURCHASE.

Extraer: Fecha (Col. E), Cantidad (Col. H), Purchase Price (Col. I).

Validación Crítica: Col. H de la fila de detalle debe ser igual a Col. K (Purchased Quantity) de la fila cabecera.

Evento Venta:

Fila donde Columna G (Event Type) = Sell.

Extraer: Fecha (Col. E), Cantidad (Col. H). Marcar operación como TR (Venta).

- [ ] US 4: Motor de Validación y Lookback de 10 días
Descripción: Como usuario, quiero que el sistema asigne el tipo de cambio correcto usando la lógica de "búsqueda hacia atrás" si el día exacto no existe.

Lógica del Algoritmo
Para cada Fecha_Evento obtenida del Excel:

Consultar en la tabla exchange_rates de Supabase.

Si no existe el dato (Lookback):

Restar 1 día a la fecha y reintentar.

Repetir el proceso hasta un máximo de 10 días atrás.

Si tras 10 días no hay dato: Marcar la fila con Status: ERROR y Error_Msg: "Falta cambio BDE para esta fecha".

Cálculo AEAT: AEAT_Importe_Euro = (Cantidad * Precio_USD) / Tipo_Cambio_BDE.

- [ ] US 5: Interfaz de Usuario y Persistencia Final
Descripción: Como usuario, quiero gestionar los errores visualmente y confirmar el guardado definitivo en Supabase.

Requerimientos de UI
Botón 1: "Sincronizar BDE" (Llamada a API + Upsert Supabase).

Botón 2: "Subir Excel Acciones" (Procesamiento en memoria + Validación contra BD).

Visualización de Errores:

Tabla de resultados con filas en rojo si el Lookback de 10 días falló.

Tooltip o columna de error indicando la fecha exacta que falta en el maestro de divisas.

Control de Flujo:

El botón "Guardar en Base de Datos" estará bloqueado si hay errores.

Al guardar, insertar en la tabla stock_transactions con los campos calculados de la AEAT.

Exportación: Botón para descargar un Excel con el mismo formato de salida que el script original para facilitar la declaración de impuestos.