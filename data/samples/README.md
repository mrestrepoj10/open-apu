# data/samples

Datos de prueba de `bun test`. Hay dos cosas distintas aquí, con procedencias
distintas: **fixtures escritos a mano** (valores inventados) y **un extracto
recortado de un archivo oficial de INVIAS** (valores reales).

---

## 1. `sample-provincia.xlsx` — extracto de un libro oficial de INVIAS

> ⚠️ **Contiene datos oficiales reales, no inventados.**

|                      |                                                                                                                |
| -------------------- | -------------------------------------------------------------------------------------------------------------- |
| **Fuente**           | Instituto Nacional de Vías (INVIAS), «Análisis de Precios Unitarios (APU) Regionalizados de Referencia»        |
| **URL**              | <https://www.invias.gov.co/publicaciones/4149/analisis-de-precios-unitarios-apu-regionalizados-de-referencia/> |
| **Vigencia**         | `2026-1` (publicada en julio de 2025; los precios se calculan sobre el SMLMV de 2025)                          |
| **Archivo original** | `APU_0509_ANTIOQUIA__VALLE_DE_ABURRA_2026_1.xlsx` (13 MB, 544 hojas)                                           |
| **Descargado**       | 2026-08-03, manualmente desde el portal oficial                                                                |
| **Uso**              | **solo pruebas.** No es una publicación de datos ni una redistribución del archivo fuente                      |

### Qué es exactamente

Un **extracto recortado** del libro de Antioquia / Valle de Aburrá: 11 hojas de
las 544, y **sin fórmulas** (solo los valores ya calculados). Pesa ~300 kB.

Se genera con `bun scripts/make-sample.ts`, que lee el archivo completo desde
`data/archivo/2026-1/` (que **no** está en el repo: cada quien lo descarga de la
fuente oficial). El script es determinista: dos ejecuciones producen el mismo
archivo byte a byte.

**Se conserva:**

| Hoja                                                 | Por qué                                                                                       |
| ---------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| `PORTADA`                                            | departamento, provincia, altitud y factores territoriales                                     |
| `ÍNDICE`                                             | las 526 filas del índice: código, descripción, unidad, subtotales y costo directo             |
| `MATERIALES`, `EQUIPO`, `MANO DE OBRA`, `TRANSPORTE` | los cuatro listados de insumos ya resueltos para esta provincia                               |
| `200,1,1`                                            | los cuatro componentes con líneas; es el ítem verificado a mano en `lib/parser/FORMATO.md` §7 |
| `630,1,1`                                            | familia 630 (concreto), el caso de demostración del proyecto                                  |
| `650,5`                                              | costo directo `0`: transporte marítimo/fluvial no aplica en esta región (§6.5)                |
| `730,4`                                              | uno de los 6 ítems cuyo código está guardado como número, `730.4` (§6.4)                      |
| `801,1`                                              | sección de transporte vacía + 3 líneas que el propio libro deja sin resolver                  |

**Se descarta:** las 533 hojas restantes —incluidas **todas las ocultas**: la
receta nacional `APU´S`, las matrices `INSUMO_*` con los precios de las 140
provincias, `CLASIFICACIÓN_APU`, `LISTADO DE PROVINCIAS`— y también las
fórmulas, los dibujos, las imágenes, los comentarios y la cadena de cálculo.

### Condiciones de uso

Los documentos publicados por INVIAS son de su propiedad. **Su uso con fines
comerciales o de lucro, a cualquier título y sin autorización previa, está
prohibido.** Este extracto está aquí como material de prueba del parser, no como
publicación de datos: para trabajar con los datos completos hay que descargar los
archivos de la fuente oficial.

Los valores son **costo directo**: no incluyen AIU (administración, imprevistos,
utilidad) ni IVA, y no son precios de mercado. Un `0` significa «no aplica en
esta región», no «precio cero».

---

## 2. Fixtures escritos a mano

Los `.json` de esta carpeta son fixtures para validar `lib/schema` sin depender
de archivos descargados.

- **Estructura:** replica el formato INVIAS FR-APU-1 y sus listados de insumos.
- **Valores:** son **ilustrativos y no oficiales**. Son cifras plausibles
  escritas a mano, no transcripciones de los archivos INVIAS.
- El bloque `procedencia` de cada fixture apunta a la fuente real
  (<https://hermes2.invias.gov.co/SeguimientoInversiones/>, vigencia `2026-1`) y
  lleva una `nota` que aclara que el contenido es un fixture.

| Archivo                                      | Qué valida                                                                |
| -------------------------------------------- | ------------------------------------------------------------------------- |
| `apu-630-1-1-antioquia-valle-de-aburra.json` | APU completo con líneas en los 4 componentes, herramienta menor y acarreo |
| `apu-320-1-1-atlantico-norte.json`           | APU completo en otra región (prefijo DANE distinto)                       |
| `apu-minimo-201-12-caqueta.json`             | APU mínimo: solo campos obligatorios, una línea, provincia `00`           |
| `insumos-antioquia-valle-de-aburra.json`     | Listado de insumos de una región (los 4 componentes)                      |

---

## Goldens del parser

Las salidas esperadas del parser sobre `sample-provincia.xlsx` viven en
`lib/parser/__goldens__/` y se regeneran con `bun scripts/make-goldens.ts` (que
solo necesita el extracto, no el archivo completo). Si un golden cambia, cambió
lo que el proyecto publica: hay que revisar el diff antes de aceptarlo.
