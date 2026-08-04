# APU Stack — datos JSON, vigencia 2026-1

Artefactos estáticos generados por `scripts/pipeline.ts` (`bun run pipeline`) a
partir de los 140 libros `.xlsx` oficiales de INVIAS.
**No se editan a mano**: para regenerarlos hay que descargar el archivo oficial
a `data/archivo/2026-1/` y volver a ejecutar el pipeline.

## Procedencia

| Campo | Valor |
| ----- | ----- |
| Fuente | INVIAS |
| Publicación | <https://www.invias.gov.co/publicaciones/4149/analisis-de-precios-unitarios-apu-regionalizados-de-referencia/> |
| Vigencia | 2026-1 |
| Fecha de descarga | 2026-08-03 |
| Versión de esquema | 0.1.0 |

Cada archivo de este directorio embebe ese mismo bloque `procedencia` y su
`schemaVersion`, para que siga siendo autodescriptivo si se sirve suelto
(no negociable 1 de `AGENTS.md`).

## Licencia y advertencias

Datos oficiales de referencia del Instituto Nacional de Vías (INVIAS), “Análisis de Precios Unitarios (APU) Regionalizados de Referencia”, vigencia 2026-1. Los libros .xlsx NO se redistribuyen en este repositorio: data/archivo/2026-1/ está en .gitignore y cada usuario debe descargarlos de la fuente oficial. El aviso legal de INVIAS restringe el uso comercial o con ánimo de lucro sin autorización previa. Los valores son costos directos de referencia (sin AIU) y no constituyen precios de mercado.

- Los valores son **costo directo de referencia**: no incluyen AIU
  (administración, imprevistos, utilidad) ni IVA, y **no son precios de
  mercado**.
- Un `costoDirecto` de `0` significa que el ítem **no aplica** en esa región
  (p. ej. transporte marítimo tierra adentro), no que cueste cero. Por eso los
  agregados (`min`, `max`, `mediana`, `promedio`) se calculan omitiendo los
  ceros y se acompañan de `provinciasConDato`.
- En transporte la distancia es **1 por definición**: la tarifa es por
  unidad-kilómetro y el usuario multiplica por su distancia real.
- **Bogotá D.C. no está**: está fuera del alcance de INVIAS (32 departamentos,
  140 provincias). La referencia para Bogotá es el IDU.
- Los libros `.xlsx` de origen **no se redistribuyen** en este repositorio.

## Artefactos

| Archivo | Cantidad | Contenido | Esquema (`lib/schema`) |
| ------- | -------- | --------- | ---------------------- |
| `catalogo.json` | 1 | los 526 ítems de pago con agregados nacionales de costo directo | `CatalogoSchema` |
| `items/{codigo}.json` | 526 | un ítem con su costo directo y totales por componente en las 140 provincias | `ItemRegionalSchema` |
| `provincias/{slug}.json` | 140 | una provincia con el resumen de sus 526 ítems | `ProvinciaResumenSchema` |
| `stats.json` | 1 | cifras globales para la portada | `StatsSchema` |

El nombre de los archivos de ítem usa el código con **puntos**
(`630.1.1.json`), que es la forma normalizada del esquema; el libro fuente lo
escribe con comas (`630,1,1`).

En `provincias/{slug}.json` cada ítem trae `titulo` (la primera línea de la
descripción INVIAS) en vez de la descripción completa: la lista de ítems se
repite en las 140 provincias, y el texto íntegro —con el
alcance del análisis entre paréntesis— está en `catalogo.json` y en
`items/{codigo}.json`.

## Lo que NO está aquí

El **desglose de insumos** y el **catálogo regional de insumos**
(619.920 y 101.500 filas) no
se publican como JSON: viven en `data/parquet/vigencia=2026-1/`
(`apu_lineas.parquet`, `insumos.parquet`), ordenados por ítem y provincia para
poder consultarlos por rangos desde el navegador.

## Líneas sin resolver

El libro fuente deja 840 líneas sin
resolver: un código de insumo que no existe en el listado regional, así que la
fila llega sin descripción ni precio y no suma al costo directo. Se omiten del
desglose en vez de publicarlas en cero, y los ítems afectados lo declaran en su
campo `notaFuente`.
