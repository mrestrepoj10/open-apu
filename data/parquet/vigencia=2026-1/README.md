# APU Stack — Parquet, vigencia 2026-1

Generado por `scripts/pipeline.ts` (`bun run pipeline`) con el CLI de DuckDB; el
SQL, comentado, está en `scripts/sql/`. **No se editan a mano**: para
regenerarlos hay que descargar los 140 libros `.xlsx` oficiales a
`data/archivo/2026-1/` y volver a ejecutar el pipeline.

## Procedencia

| Campo | Valor |
| ----- | ----- |
| Fuente | INVIAS |
| Publicación | <https://www.invias.gov.co/publicaciones/4149/analisis-de-precios-unitarios-apu-regionalizados-de-referencia/> |
| Vigencia | 2026-1 |
| Fecha de descarga | 2026-08-03 |
| Versión de esquema | 0.1.0 |

## Licencia

Datos oficiales de referencia del Instituto Nacional de Vías (INVIAS), “Análisis de Precios Unitarios (APU) Regionalizados de Referencia”, vigencia 2026-1. Los libros .xlsx NO se redistribuyen en este repositorio: data/archivo/2026-1/ está en .gitignore y cada usuario debe descargarlos de la fuente oficial. El aviso legal de INVIAS restringe el uso comercial o con ánimo de lucro sin autorización previa. Los valores son costos directos de referencia (sin AIU) y no constituyen precios de mercado.

Los valores son **costo directo de referencia**: no incluyen AIU
(administración, imprevistos, utilidad) ni IVA y **no son precios de mercado**.
Un `costoDirecto` de `0` significa "el ítem no aplica en esta región", no que
cueste cero.

## Archivos

| Archivo | Filas | Orden | Grupo de fila | SQL |
| ------- | ----- | ----- | ------------- | --- |
| `apus.parquet` | 73.640 | `codigo`, `slug` | 16 384 | `scripts/sql/apus.sql` |
| `apu_lineas.parquet` | 619.920 | `codigo`, `slug`, `orden` | 8 192 | `scripts/sql/apu_lineas.sql` |
| `insumos.parquet` | 101.500 | `codigoInsumo`, `slug` | 16 384 | `scripts/sql/insumos.sql` |

Compresión zstd en los tres. El orden no es cosmético: ordenar
`apu_lineas.parquet` por `codigo` hace que las ~1 260 filas de un ítem (sus
líneas × 140 provincias) caigan en **un solo grupo de fila**, así que
un lector como hyparquet resuelve el desglose de un ítem leyendo un fragmento
del archivo en vez de los 619.920 registros.

Por eso el desglose se sirve desde aquí y no como JSON: las
619.920 líneas ocupan pocos MB en Parquet y cientos en
JSON.

## Semántica de las columnas

`cantidad` y `precioUnitario` significan cosas distintas según el
`componente` (FORMATO.md §3.3):

| Componente | `cantidad` | Cálculo del subtotal |
| ---------- | ---------- | -------------------- |
| `equipo` | horas de equipo por unidad de obra | `cantidad × precioUnitario` |
| `materiales` | insumo por unidad de obra | `cantidad × precioUnitario` |
| `transporte` | cantidad transportada | `cantidad × distancia × precioUnitario`, con `distancia` **siempre 1** (la tarifa es por unidad-kilómetro) |
| `manoDeObra` | **rendimiento** (unidades de obra por jornal) | `precioUnitario ÷ cantidad` |

La herramienta menor es una línea de `equipo` con `porcentaje` (0.05) y
`base` (el subtotal de mano de obra): no es un equipo real.

Se redondean a 2 decimales solo los valores que la propia hoja INVIAS calcula
con `ROUND(x, 2)` —`subtotal`, `base`, los totales por componente y
`costoDirecto`—, cuyo valor cacheado llega con ruido IEEE-754. Las tarifas,
cantidades y factores prestacionales se publican con todos sus decimales.
