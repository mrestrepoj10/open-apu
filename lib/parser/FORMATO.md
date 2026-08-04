# Formato de los libros APU INVIAS 2026-1

Reconocimiento del formato real de los 140 libros `.xlsx` publicados por INVIAS
(«Análisis de Precios Unitarios de Referencia Regionalizados», vigencia 2026-1).
Este documento es la especificación desde la cual se construye el parser en `lib/parser/`.

**Base empírica.** Se inspeccionaron 7 libros de departamentos y geografías distintas:

| Libro                                             | Nota                       |
| ------------------------------------------------- | -------------------------- |
| `APU_0509_ANTIOQUIA__VALLE_DE_ABURRA_2026_1.xlsx`  | urbano andino              |
| `APU_0501_ANTIOQUIA__BAJO_CAUCA_2026_1.xlsx`       | mismo depto., otra provincia |
| `APU_8100_ARAUCA__ARAUCA_2026_1.xlsx`              | llano, provincia única     |
| `APU_5203_NARINO__COSTA_2026_1.xlsx`               | pacífico                   |
| `APU_2703_CHOCO__PACIFICO_NORTE_2026_1.xlsx`       | pacífico, alto costo       |
| `APU_8800_SAN_ANDRES__ARCHIPIELAGO_..._2026_1.xlsx`| insular                    |
| `APU_9100_AMAZONAS__SELVA_AMAZONICA_2026_1.xlsx`   | selva                      |

**Resultado central: los 140 libros son estructuralmente idénticos.** Mismo número de
hojas (544), mismos nombres, mismas coordenadas de celda, mismos ítems (526), mismas
anomalías. **Lo único que cambia entre libros son los precios.** El parser puede
asumir coordenadas fijas y *verificar* en lugar de *buscar*.

> Notación: `Bn` = columna B, fila n. Las columnas se citan también por índice
> 1-based (`B` = 2, `N` = 14) porque exceljs usa índices numéricos.

---

## 1. Inventario de hojas

544 hojas por libro, en este orden exacto (índice 0-based tal como las devuelve
`workbook.xml`):

| # | Nombre | Estado | Rol |
| -- | ------ | ------ | --- |
| 0 | `PORTADA` | visible | metadatos de la provincia (depto, provincia, altitud, factores) |
| 1 | `ÍNDICE` | visible | **índice maestro de los 526 ítems + subtotales** |
| 2 | `MENÚ` | visible | navegación (formas/botones, sin datos en celdas) |
| 3 | `APU´S` | veryHidden | **receta nacional**: qué insumos y cantidades usa cada ítem |
| 4 | `INSUMO_EQUIPO` | veryHidden | matriz de precios de equipo × 140 provincias |
| 5 | `INSUMO MATERIALES` | veryHidden | matriz de precios de materiales × 140 provincias |
| 6 | `INSUMO_TRANSPORTE` | veryHidden | matriz de tarifas de transporte × 140 provincias |
| 7 | `INSUMO_MANO DE OBRA` | veryHidden | matriz de factores prestacionales × 140 provincias |
| 8 | `IMAGENES_PROVINCIAS` | veryHidden | imágenes (origen de varios `#VALUE!`) |
| 9 | `CLASIFICACIÓN_APU` | veryHidden | ítem → TIPOAPU (A–E) y FACTOR de rendimiento |
| 10 | `HOJA DE CALCULOS ` | veryHidden | tabla de factores altitud/temperatura por provincia |
| 11 | `LISTADO DE PROVINCIAS` | visible | **mapa DANE municipio → provincia** |
| 12 | `MATERIALES` | visible | listado de materiales resuelto para *esta* provincia |
| 13 | `EQUIPO` | visible | listado de equipo resuelto para *esta* provincia |
| 14 | `MANO DE OBRA` | visible | listado de mano de obra resuelto para *esta* provincia |
| 15 | `TRANSPORTE` | visible | listado de transporte resuelto para *esta* provincia |
| 16 | `APU BASE` | visible | plantilla vacía con el layout de hoja de ítem — **ignorar** |
| 17…542 | `200,1,1` … `900,3,2` | visible | **526 hojas de ítem**, una por APU |
| 543 | `CONSIDERACIONES ` | visible | texto legal/metodológico |

### 1.1 Clasificación programática

```ts
const ES_HOJA_ITEM = /^\d+(,\d+)*$/;
```

Esa expresión aísla exactamente las 526 hojas de ítem y excluye las 18 de apoyo
(incluida `APU BASE`, cuyo nombre no es numérico). No dependas del índice de hoja:
usa el nombre.

### 1.2 Acentos y caracteres invisibles en los nombres

Trampas reales, verificadas por codepoint:

| Nombre | Detalle |
| ------ | ------- |
| `APU´S` | usa **U+00B4 ACUTE ACCENT** (`´`), **no** `'` (U+0027) ni `’` (U+2019) |
| `ÍNDICE` | `Í` = U+00CD |
| `MENÚ` | `Ú` = U+00DA |
| `CLASIFICACIÓN_APU` | `Ó` = U+00D3 |
| `HOJA DE CALCULOS ` | **espacio final** |
| `CONSIDERACIONES ` | **espacio final** |
| `INSUMO MATERIALES` | espacio, mientras `INSUMO_EQUIPO`, `INSUMO_TRANSPORTE` e `INSUMO_MANO DE OBRA` usan guion bajo |

Escribe estos nombres como literales copiados, nunca a mano. Si vas a normalizar,
compara con `.trim()` y `.normalize("NFC")`.

---

## 2. Hoja `ÍNDICE`

`dimension = A1:N530`. Es el punto de entrada del parser.

### Encabezado

| Celda | Contenido |
| ----- | --------- |
| `K1:K2` (merged) | `"DEPARTAMENTO:"` |
| `L1:L2` (merged) | fórmula `=+PORTADA!D24` → p. ej. `"ANTIOQUIA"` |
| `K3` | `"PROVINCIA:"` |
| `L3` | fórmula `=+PORTADA!F24` → p. ej. `"VALLE DE ABURRÁ"` |
| `A2:J3` (merged) | título multilínea del INVIAS + vigencia `2026-1` |

### Fila de encabezados de columna: **fila 4**

| Col | Índice | Encabezado |
| --- | ------ | ---------- |
| A | 1 | `#` (consecutivo 1…526) |
| B | 2 | `CAPÍTULO CONSTRUCTIVO` |
| C | 3 | `ARTÍCULO` |
| D | 4 | `CLASIFICACIÓN ESPECIFICACIÓN TÉCNICA` |
| E | 5 | `ÍTEM DE PAGO` ← **código del ítem** |
| F | 6 | `DESCRIPCIÓN ACTIVIDAD` |
| G | 7 | `UNIDAD` |
| H | 8 | `SUBTOTAL EQUIPOS ($ COP)` |
| I | 9 | `SUBTOTAL MATERIALES ($ COP)` |
| J | 10 | `SUBTOTAL TRANSPORTE ($ COP)` |
| K | 11 | `SUBTOTAL MANO DE OBRA ($ COP)` |
| L | 12 | `COSTO DIRECTO ($ COP)` |

Las columnas `M` y `N` existen en `dimension` pero están vacías.

### Datos: **filas 5 a 530** (526 filas, contiguas, sin filas en blanco)

La lista **no** tiene fila de totales ni marcador de fin. Termina porque `E531` no
existe en el XML. Terminación robusta:

```ts
// leer mientras E<n> tenga valor; parar en la primera vacía a partir de la fila 5
for (let r = 5; ; r++) {
  const code = norm(idx.getRow(r).getCell(5).value);
  if (!code) break;
  …
}
```

En los 7 libros esto da exactamente 526 filas (5…530).

### Naturaleza de las celdas

Casi todo en `ÍNDICE` son **fórmulas con resultado cacheado** — hay que leer el
`result`, nunca evaluar:

| Celda | Fórmula | Resultado cacheado |
| ----- | ------- | ------------------ |
| `E5` | `HYPERLINK("#'" & CLASIFICACIÓN_APU!C3 & "'!C33", CLASIFICACIÓN_APU!C3)` | `"200,1,1"` (`t="str"`) |
| `F5` | `VLOOKUP(E5,APU´S!$C$4:$E$530,3,FALSE)` | descripción |
| `G5` | `VLOOKUP(E5,APU´S!$C$4:$E$530,2,FALSE)` | `"ha"` |
| `H5` | `(INDIRECT("'"&E5&"'!N53"))` | `5436439.05` |
| `I5` | `INDIRECT("'"&E5&"'!N74")` | `3316228.76` |
| `J5` | `INDIRECT("'"&E5&"'!N84")` | `747920` |
| `K5` | `INDIRECT("'"&E5&"'!N99")` | `577522.93` |
| `L5` | `INDIRECT("'"&E5&"'!N101")` | `10078110.74` |

**Las referencias `N53 / N74 / N84 / N99 / N101` están escritas literalmente en las
526 filas del índice.** Es la confirmación más fuerte de que el layout de las hojas
de ítem es fijo.

Las columnas A–D son valores literales (no fórmulas). Valores distintos observados:

- `D` (clasificación): solo `"GENERAL"` y `"NUEVA \r\nTECNOLOGIA"`.
- `B` (capítulo): 8 valores, `"Capitulo 2\r\nExplanaciones"` … `"Capitulo 9\r\nTransporte"`.
- `C` (artículo): p. ej. `"Artículo 621 - \r\n22 Pilotes preexcavados"`.

---

## 3. Hojas de ítem (526)

**Layout idéntico en las 526 hojas × 7 libros verificados.** `dimension = A1:R142`,
114 filas con contenido, 153 rangos combinados. Nada se desplaza.

### 3.1 Bloque de cabecera (filas 1–28) — mayormente formulario en blanco

Lo aprovechable:

| Celda | Contenido |
| ----- | --------- |
| `K1` / `L1:N1` | `"CÓDIGO"` / `"FR-APU-1"` (código del formato INVIAS) |
| `N1` | celda de **error `#VALUE!`** (fórmula de imagen) — ignorar |
| `C3:Q3` | `"ANÁLISIS DE PRECIOS UNITARIOS DE REFERENCIA REGIONALIZADOS "` |
| `K3` / `L3` | `"VERSIÓN"` / `"2021"` (versión del *formato*, no de los precios) |
| `F10` | `"PUBLICACIÓN:"` |
| `H10` | **`"2026-1, Julio de 2025"`** ← vigencia legible |
| `H14` / `J14` | `"DIRECCIÓN TERRITORIAL:"` / departamento (fórmula `=+PORTADA!D24`) |
| `K14` / `L14` | `"PROVINCIA:"` / provincia (fórmula `=+PORTADA!F24`, en algunos libros `=+PORTADA!CL24` — misma celda combinada) |

Filas 12–28 son campos de contrato/interventoría vacíos por diseño (el formato
está pensado para que el contratista lo diligencie). No extraer.

### 3.2 Identidad del ítem (filas 30–34)

| Celda | Merge | Contenido |
| ----- | ----- | --------- |
| `B30:N30` | sí | `"DATOS ESPECÍFICOS"` |
| `B32` | — | `"ÍTEM"` |
| `C32:J32` | sí | `"DESCRIPCIÓN"` |
| `K32` | — | `"GRUPO DE AJUSTE "` |
| `L32:M32` | sí | `"UNIDAD"` |
| `N32` | — | `"CANTIDAD"` |
| **`B33`** | — | **código del ítem** (literal, no fórmula) |
| **`C33:J33`** | sí | **descripción** — fórmula `VLOOKUP(B33,ÍNDICE!E5:G984,2,FALSE)` |
| `K33` | — | vacío (grupo de ajuste, no diligenciado) |
| **`L33:M33`** | sí | **unidad** — fórmula `VLOOKUP(B33,ÍNDICE!E5:G984,3,FALSE)` |
| `N33` | — | vacío (cantidad, la diligencia el usuario) |
| `B34` | — | **`","` literal** — celda basura, ignorar |

### 3.3 Las cuatro secciones de componentes

Estructura constante de cada sección: **banner** (fila combinada `B:N`), fila en
blanco combinada, **fila de encabezados**, **filas de línea**, **fila de subtotal**.

| Sección | Banner | (blanco) | Encabezados | Líneas | Subtotal | Cap. |
| ------- | ------ | -------- | ----------- | ------ | -------- | ---- |
| I. EQUIPO | `B35:N35` `"I. EQUIPO"` | `B36:N36` | **37** | **38–51** + **52** (herramienta menor) | **`N53`**, etiqueta `B53:M53` | 14 (+1) |
| II. MATERIALES | `B55:N55` `"II. MATERIALES"` | `B56:N56` | **57** | **58–73** | **`N74`**, etiqueta `B74:M74` | 16 |
| III. TRANSPORTES | `B76:N76` `"III. TRANSPORTES"` | `B77:N77` | **78** | **79–83** | **`N84`**, etiqueta `B84:M84` | 5 |
| IV. MANO DE OBRA | `B86:N86` `"IV. MANO DE OBRA"` | `B87:N87` | **88** | **89–98** | **`N99`**, etiqueta `B99:M99` | 10 |

> El banner dice **`"III. TRANSPORTES"`** (plural) aunque el `ÍNDICE` rotula la
> columna `"SUBTOTAL TRANSPORTE"` (singular). Si validas por texto, usa el plural.

La etiqueta de subtotal es siempre `"SUBTOTAL $"` en `B<fila>` (combinada `B:M`);
el valor va en la columna `N`.

#### I. EQUIPO — filas 38–52

Encabezados (fila 37) y columnas de datos:

| Col | Índice | Merge | Encabezado | Contenido de línea |
| --- | ------ | ----- | ---------- | ------------------ |
| B | 2 | — | `CÓDIGO` | código de insumo, p. ej. `C0010052` |
| C | 3 | `C<r>:I<r>` | `DESCRIPCIÓN` | nombre del equipo (VLOOKUP a `EQUIPO`) |
| J | 10 | — | `TIPO` | vacío en líneas normales; `"%"` solo en la fila 52 |
| K | 11 | — | `TARIFA/HORA` | tarifa horaria COP |
| L | 12 | `L<r>:M<r>` | `RENDIMIENTO` | horas por unidad de obra |
| N | 14 | — | `Vr. UNITARIO` | `ROUND(L*K, 2)` |

**Fila 52 — herramienta menor (siempre presente, en las 526 × 7 hojas):**

| Celda | Valor |
| ----- | ----- |
| `B52` | `"HERMENINV"` (código fijo) |
| `C52:I52` | `"HERRAMIENTA MENOR (% MANO DE OBRA)"` |
| `J52` | `"%"` |
| `K52` | fórmula `=IF(B52="","",N99)` → **el subtotal de mano de obra** |
| `L52:M52` | porcentaje, `0.05` en todos los casos observados |
| `N52` | `ROUND(L52*K52, 2)` |

Es decir: **herramienta menor = 5 % del subtotal de mano de obra, y se contabiliza
dentro del subtotal de EQUIPO.** El parser debe tratarla como línea de equipo (entra
en `SUM(N38:N52)`) pero marcarla aparte, porque no es un equipo real y su «cantidad»
es un porcentaje, no un rendimiento.

#### II. MATERIALES — filas 58–73

| Col | Índice | Merge | Encabezado | Contenido |
| --- | ------ | ----- | ---------- | --------- |
| B | 2 | — | `CÓDIGO` | p. ej. `B0013791` |
| C | 3 | `C<r>:I<r>` | `DESCRIPCIÓN` | nombre del material |
| J | 10 | — | `UNIDAD` | `"m3"`, `"kg"`, `"L"`… |
| K | 11 | — | `CANTIDAD` | cantidad por unidad de obra |
| L | 12 | `L<r>:M<r>` | `PRECIO UNIT.` | precio regional COP |
| N | 14 | — | `Vr. UNITARIO` | `ROUND(L*K, 2)` |

#### III. TRANSPORTES — filas 79–83

Única sección con columnas propias (distancia). **Encabezados en la fila 78:**

| Col | Índice | Merge | Encabezado | Contenido |
| --- | ------ | ----- | ---------- | --------- |
| B | 2 | — | `CÓDIGO` | p. ej. `T0010032` |
| C | 3 | `C<r>:H<r>` | `DESCRIPCIÓN` | nombre del transporte |
| I | 9 | — | `UNIDAD` | `"m3-km"`, `"kg-km"`, `"Km"` |
| J | 10 | — | `CANTIDAD (1)` | volumen/peso a transportar |
| K | 11 | — | `DISTANCIA (2)` | **siempre `1`** (`=IF(B79="","",1)`) |
| L | 12 | — | `(1) * (2)` | `=IF(C79="","",K79*J79)` |
| M | 13 | — | `TARIFA` | tarifa unitaria COP |
| N | 14 | — | `Vr. UNITARIO` | `ROUND(L*M, 2)` |

> ⚠️ La distancia es **1 por definición** en los APU de referencia: el precio se da
> por unidad-kilómetro y el usuario multiplica por su distancia real. Al presentar
> transporte hay que decirlo, o el número se malinterpreta.

#### IV. MANO DE OBRA — filas 89–98

| Col | Índice | Merge | Encabezado | Contenido |
| --- | ------ | ----- | ---------- | --------- |
| B | 2 | — | `CÓDIGO` | p. ej. `A0030040` |
| C | 3 | `C<r>:H<r>` | `DESCRIPCIÓN` | p. ej. `"Obrero (4)"` |
| I | 9 | — | `JORNAL` | `= VLOOKUP(...)/30` — salario **diario** |
| J | 10 | — | `PRESTACIONES (%)` | **factor multiplicador**, ≈ `2.05` (¡no un porcentaje!) |
| K | 11 | — | `JR. TOTAL` | `= I * J` |
| L | 12 | `L<r>:M<r>` | `RENDIMIENTO` | **unidades de obra por día** |
| N | 14 | — | `Vr. UNITARIO` | **`ROUND(K / L, 2)`** ← división, no producto |

> ⚠️ Dos asimetrías respecto a las otras secciones:
> 1. `PRESTACIONES (%)` es un **factor** (`2.0518…`), no un porcentaje. `JR. TOTAL = JORNAL × FACTOR`.
> 2. El valor unitario **divide** entre el rendimiento, mientras EQUIPO multiplica.

### 3.4 Costo directo

| Celda | Contenido |
| ----- | --------- |
| `B101:M101` | `"TOTAL COSTO DIRECTO $"` |
| **`N101`** | **`ROUND((N99+N84+N74+N53), 2)`** ← el número que publica el proyecto |

### 3.5 Bloque AIU (filas 103–111) — **siempre vacío**

| Celda | Contenido |
| ----- | --------- |
| `B103:N103` | `"V. COSTOS INDIRECTOS"` |
| `B105:H105` / `K105` / `L105:N105` | `"DESCRIPCIÓN"` / `"Porcentaje"` / `"Valor Total"` |
| `B106:H106` | `"ADMINISTRACION"` — `K106`, `L106:N106` **vacías** |
| `B107` | `"IMPREVISTOS "` — vacías |
| `B108` | `"UTILIDAD"` — vacías |
| `B109:M109` | `"SUBTOTAL $"` — `N109` **vacía** |
| `B111:M111` | `"Precio Unitario Total Aproximado al Peso $"` — `N111` **vacía** |

Esto confirma en el dato la no-negociable #2 del repo: **los libros no traen AIU**.
El parser **no debe** emitir ningún campo de AIU ni de «precio total»; solo costo
directo. Verificar que `N109`/`N111` están vacías es una buena aserción defensiva:
si algún día vinieran con valor, el supuesto cambió.

### 3.6 Pie (filas 116–142)

Firmas, observaciones de interventoría (`B122`, `B127`, fórmulas normalmente vacías)
y en `B140:N140` la nota legal:

> «NOTA: Los documentos publicados periódicamente son propiedad del Instituto
> Nacional de Vías…»

Vale la pena conservarla como parte de la procedencia.

---

## 4. Hojas de listado de insumos (resueltas para la provincia del libro)

Son las cuatro hojas **visibles** que los ítems consultan por `VLOOKUP`. Ya traen el
precio de *esta* provincia, así que son la fuente natural del catálogo de insumos.

### 4.1 `EQUIPO`

Encabezados en la **fila 5**; datos desde la **fila 6** (rango referenciado por las
fórmulas: `EQUIPO!C$6:G$164`; ~152 filas con datos).

| Col | Índice | Encabezado |
| --- | ------ | ---------- |
| B | 2 | `#` |
| C | 3 | `Código` |
| D | 4 | `Unidad` (`"h"`, `"%"`) |
| E | 5 | `Insumo` (descripción) |
| F | 6 | `CLASIFICACIÓN` (p. ej. `"MIXTO - HERRAMIENTA MENOR"`, `"CONCRETO Y MORTERO"`) |
| G | 7 | `PRECIO ($ COP)` — tarifa horaria de esta provincia |

### 4.2 `MATERIALES`

Encabezados en la **fila 6**; datos desde la **fila 7** (`MATERIALES!C$7:I$494`; ~482 filas).

| Col | Índice | Encabezado |
| --- | ------ | ---------- |
| B | 2 | `#` |
| C | 3 | `Código` |
| D | 4 | `unidad` (minúscula en el original) |
| E | 5 | `Insumo` |
| F | 6 | `PRECIO ($ COP)` |
| G | 7 | `CATEGORÍA` (p. ej. `"AGREGADOS"`, `"MADERA"`) |

### 4.3 `TRANSPORTE`

Encabezados en la **fila 6**; datos desde la **fila 7** (`TRANSPORTE!C$7:I$57`; ~49 filas).

| Col | Índice | Encabezado |
| --- | ------ | ---------- |
| B | 2 | `#` |
| C | 3 | `Código` |
| D | 4 | `Unidad` (`"m3-km"`, `"kg-km"`, `"Km"`) |
| E | 5 | `Insumo` |
| F | 6 (`F:G` merged) | `PRECIO ($ COP)` |

### 4.4 `MANO DE OBRA`

Tiene **dos bloques**.

Bloque salarial de referencia (filas 3–7), columnas `B` (unidad), `D` (ítem), `G` (valor):

| Fila | Ítem | Valor 2026-1 |
| ---- | ---- | ------------ |
| 4 | `Salario mínimo legal mensual vigente - SMLMV básico 2025` | `1 423 500` |
| 5 | `Subsidio de transporte 2025` | `200 000` |
| 6 | `SMLMV 2025 + Subsidio de transporte` | `=G4+G5` → `1 623 500` |
| 7 | `Jornal + subsidio de transporte 2025` | `=G6/30` → `54 116.67` |

> Los precios de la vigencia **2026-1** se calculan sobre el **SMLMV de 2025**. Dato
> de procedencia importante: no es un error de lectura.

Listado (encabezados filas 10–11, datos desde la **fila 12**; `'MANO DE OBRA'!C$12:H$109`; ~70 filas):

| Col | Índice | Encabezado |
| --- | ------ | ---------- |
| B | 2 | `#` |
| C | 3 | `Código` |
| D | 4 | `Insumo` (p. ej. `"Obrero (4)"`) |
| E | 5 | `Precio Base (COP)` — **mensual** (`I<r>` del ítem lo divide entre 30) |
| F | 6 | `Factor Jornal 2025` (multiplicador de cuadrilla: 1, 2, 3…, 1.05, 1.87) |
| G | 7 (`G:H` merged) | `FACTOR PRESTACIONAL` (≈ 2.03–2.05, regional) |

---

## 5. Hojas ocultas de apoyo

### 5.1 `APU´S` (veryHidden) — la receta nacional

`dimension` hasta la columna ~100. Encabezados en la **fila 3**, datos **4–529** (526 ítems).

| Col | Índice | Encabezado |
| --- | ------ | ---------- |
| B | 2 | `#` |
| C | 3 | `ITEM` |
| D | 4 | `UNIDAD` |
| E | 5 | `DESCRIPCIÓN ACTIVIDAD` |
| F | 6 | `M&HMenor` → `"HERMENINV"` |
| G | 7 | `%DES` → `0.05` |
| H, J, L, … | 8, 10, 12… | `M&E1`, `M&H2`, `M&H3`… códigos de equipo |
| I, K, M, … | 9, 11, 13… | `CANT1`, `CANT2`, `CANT3`… rendimientos |

Después de los equipos siguen, en pares `código/cantidad`, los bloques de materiales,
transporte y mano de obra. Los desplazamientos se deducen de los `VLOOKUP` de las
hojas de ítem, que usan siempre el rango `APU´S!C$4:CO$995` (columna 1 = `C`):

| Bloque | Índice de columna dentro del rango `C:CO` | Primera columna real |
| ------ | ----------------------------------------- | -------------------- |
| Herramienta menor (código / %) | 4 / 5 | `F` / `G` |
| Equipo (par 1) | 6 / 7 | `H` / `I` |
| Materiales (par 1) | 32 / 33 | `AH` / `AI` |
| Transporte (par 1) | 64 / 65 | `BN` / `BO` |
| Mano de obra (par 1) | 74 / 75 | `BX` / `BY` |
| Observaciones / aprobación | 94 / 95 | `CR` / `CS` |

Cada par siguiente avanza 2 columnas.

**Consecuencia clave: la composición de cada APU es nacional.** Los mismos insumos y
las mismas cantidades en los 140 libros; solo cambia el precio. Verificado: el
número de ítems con sección vacía es **idéntico** en los 7 libros (equipo 100,
materiales 17, transporte 203, mano de obra 51).

### 5.2 `CLASIFICACIÓN_APU` (veryHidden)

Encabezados **fila 2**, datos **3–528** (526 ítems).

| Col | Índice | Encabezado |
| --- | ------ | ---------- |
| C | 3 | `ÍTEM` — mismo orden que `ÍNDICE` y que las hojas |
| D | 4 | `DESCRIPCIÓN ACTIVIDAD` |
| E | 5 | `UNIDAD` |
| F | 6 | `TIPOAPU` — `A`…`E` |
| G | 7 | `FACTOR` — factor de ajuste de rendimiento (`1` o `0.95`) |

Leyenda en `J3:L7`:

| Tipo | Significado |
| ---- | ----------- |
| A | El APU tiene equipo y mano de obra, pero el rendimiento lo lleva el equipo |
| B | El APU tiene equipo y mano de obra, pero el rendimiento lo lleva la mano de obra |
| C | El APU solo tiene mano de obra |
| D | El APU solo tiene equipos |
| E | Suministro |

`ÍNDICE!E<r>` apunta a `CLASIFICACIÓN_APU!C<r-2>`, así que esta hoja define el orden canónico.

### 5.3 `INSUMO_*` (veryHidden) — matrices nacionales de precio

**Hallazgo importante: cada libro contiene los precios de las 140 provincias**, no
solo los de la suya. La hoja visible correspondiente simplemente extrae la columna
de esta provincia con `MATCH` contra `'HOJA DE CALCULOS '`.

`INSUMO_EQUIPO` (150 × 142), `INSUMO MATERIALES` (~479 filas), `INSUMO_TRANSPORTE` (~52 filas):

| Fila | Contenido |
| ---- | --------- |
| 1 | nombre de **departamento** por columna (desde `C`) |
| 2 | nombre de **provincia** por columna |
| 3 | número de columna |
| 4 | clave concatenada, p. ej. `"AntioquiaValle de Aburrá"` |
| 5+ | `A` = código, `B` = insumo, `C…` = precio por provincia |

`INSUMO_MANO DE OBRA` (63 × 143) **difiere**: encabezados en filas 1–3 (sin fila de
número de columna), datos desde la **fila 4**, y las columnas van en **orden inverso**
(empiezan en Vichada, no en Amazonas). Columnas: `A` = Código, `B` = Trabajador,
`C` = Salario, `D…` = factor prestacional por provincia.

> Si algún día se quiere el dataset nacional completo de precios de insumo, **basta
> un solo libro**. Los 140 solo hacen falta para los APU ya resueltos.

### 5.4 `HOJA DE CALCULOS ` (veryHidden)

Tabla de factores territoriales, **filas 4–168** (una por provincia):

| Col | Índice | Contenido |
| --- | ------ | --------- |
| B | 2 | `DEPARTAMENTO` |
| C | 3 | `PROVINCIA` |
| D | 4 | clave `=B&C` |
| E | 5 | `ALTITUD PROMEDIO (msnm)` |
| F | 6 | `RANGOS ALTITUD` (`"0-1000"`, `"1001-2300"`, `"2301-3800"`) |
| G | 7 | `FACTOR DE AJUSTE` (1, 0.9437, 0.8189) |
| H | 8 | `TEMPERATURA PROMEDIO (°C)` |
| I | 9 | `RANGO TEMPERATURA` |
| J | 10 | `FACTOR DE AJUSTE MANO DE OBRA` (1, 0.98, 0.95, 0.92…) |

Bloque `L4:S4` = los valores ya resueltos para **esta** provincia (`N4` altitud,
`P4` factor altitud, `Q4` temperatura, `S4` factor mano de obra).

### 5.5 `LISTADO DE PROVINCIAS` (visible) — mapa DANE

Encabezados **fila 6**, datos **7–1125** (~1119 municipios). Las columnas de provincia
están **combinadas verticalmente** por bloque de municipios: solo la primera fila del
bloque tiene valor.

| Col | Índice | Encabezado |
| --- | ------ | ---------- |
| B | 2 | `Nombre Departamento` (merged por bloque) |
| C | 3 | `Nombre Provincia` (merged) |
| D | 4 | `Codigo Departamento` (merged) |
| E | 5 | `Código Provincia ` (merged) — **coincide con el código del nombre de archivo** (`9100` ↔ `APU_9100_…`) |
| F | 6 | `Código de Municipio` (DANE, 5 dígitos) |
| G | 7 | `Nombre Municipio` |
| H | 8 | `Altura` |
| I | 9 | `Tmperatura` *(sic, falta la `e`)* |
| J–P | 10–16 | totales y factores (merged por bloque) |

Datos en las filas **7–1125** (la 1126 está vacía; `dimension = B1:P1126`).

**Esta hoja resuelve el problema de las URL por municipio** del explorador web:
municipio DANE → provincia → libro. Al leerla hay que rellenar hacia abajo (forward
fill) las columnas combinadas B–E y J–P.

> ⚠️ **Bogotá D.C. sí aparece aquí, pero no tiene libro.** Fila 175:
> `B="BOGOTÁ D.C."`, `C="BOGOTA"`, `D="1100"`, `F="11001"`, `G="BOGOTA D.C."`.
> Sin embargo **no existe ningún `APU_1100_*.xlsx`** entre los 140 archivos: el
> archivo cubre 32 departamentos y ninguna provincia con código `11xx`.
> Es decir, la tabla territorial la lista pero INVIAS no publica APU para ella.
> Coherente con la no-negociable #5 del repo: hay que representarlo honestamente
> («fuera del alcance de INVIAS; ver IDU»), **no** silenciarlo ni inventarle precio.

### 5.6 `PORTADA` (visible) — procedencia

| Celda | Contenido |
| ----- | --------- |
| `C2` | `"ANALISIS DE PRECIOS UNITARIOS DE REFERENCIA\r\nREGIONALIZADOS"` |
| `D23` / `F23` / `G23` | `"DEPARTAMENTO"` / `"PROVINCIA"` / `"FACTORHORARIO"` |
| **`D24`** | **departamento** (combinada `D24:E24`) |
| **`F24`** | **provincia** (celda combinada muy ancha: se la referencia como `F24` o `CL24`) |
| `G24` | `"42 HORAS"` (jornada legal aplicada) |
| `D26`–`G26` | etiquetas de altitud/temperatura |
| `D27` | altitud promedio (msnm) |
| `E27` | factor de ajuste por altitud |
| `F27` | temperatura promedio (°C) |
| `G27` | factor de ajuste de mano de obra |
| `I4` | error `#VALUE!` (imagen) — ignorar |

### 5.7 `MENÚ`, `APU BASE`, `IMAGENES_PROVINCIAS`, `CONSIDERACIONES `

- `MENÚ`: 443 celdas declaradas pero **solo 1 con valor**; es navegación por
  formas/botones. Ignorar.
- `APU BASE`: copia en blanco del layout de hoja de ítem (142 filas). **Ignorar** —
  el regex de clasificación ya la excluye, pero conviene una aserción explícita.
- `IMAGENES_PROVINCIAS`: solo imágenes.
- `CONSIDERACIONES `: `E2:O4` el título y **`C5:O77`** un bloque de texto largo con la
  metodología y las restricciones de uso. Vale la pena extraerlo íntegro para la
  página de procedencia.

---

## 6. Rarezas, variaciones y trampas

### 6.1 exceljs consume ~3.7 GB de RAM por libro de 13 MB ⚠️

Medido (`process.memoryUsage().rss`) tras `workbook.xlsx.readFile()` sobre
`APU_0509_…`: **3.68 GB**. Con 544 hojas y ~114 filas útiles cada una, exceljs
materializa todo el modelo de objetos.

Consecuencias:

- Un solo libro **roza el heap por defecto de Node/Bun**; dos procesos en paralelo
  provocan swap y `SIGKILL` (exit 137). Comprobado en esta investigación.
- **Cargar un libro completo con exceljs en el navegador no es viable.** Choca con
  el objetivo de «parsers compatibles con navegador» del repo. Opciones:
  1. Parsear el XML crudo del zip (`xl/worksheets/sheetN.xml`) hoja por hoja — es lo
     que se usó aquí y procesa las 526 hojas en **~15 s con memoria plana**.
  2. Usar el lector *streaming* de exceljs.
  3. Reservar exceljs solo para el pipeline offline de `scripts/`, y servir JSON
     estático al navegador (que es el diseño previsto en AGENTS.md).
- Nunca cargues dos libros a la vez. Procesa uno, libera, sigue.

### 6.2 `"formula" in cell` es **siempre true** en exceljs ⚠️

El objeto `Cell` de exceljs expone *getters* `formula` y `result` en su prototipo.
Un chequeo tipo `if ("formula" in cell)` da `true` incluso para una celda de texto
plano, y `cell.result` devuelve `undefined` → **lees cadenas vacías en todas partes**.
Este bug costó dos rondas de diagnóstico en esta recon.

```ts
// MAL — cell es el objeto Cell
raw(ws.getRow(33).getCell(2));
// BIEN — pasa siempre .value
raw(ws.getRow(33).getCell(2).value);
```

Aplica la comprobación de forma sobre `cell.value`, no sobre `cell`.

### 6.3 Fórmulas: casi todo es fórmula con resultado cacheado

Prácticamente **ninguna** celda de datos de una hoja de ítem es un literal. Las
excepciones son `B33` (código) y `B34` (`","`).

`cell.value` puede tomar estas formas:

| Forma | XML | exceljs |
| ----- | --- | ------- |
| Fórmula normal | `<f>ROUND(SUM(N38:N52),2)</f><v>5792090.86</v>` | `{ formula: "ROUND(...)", result: 5792090.86 }` |
| **Fórmula compartida** | `<f t="shared" si="3"/><v>89844.06</v>` | `{ sharedFormula: "N39", result: 89844.06 }` — **el texto de la fórmula no se repite** |
| **Resultado vacío** | `t="str"` + `<v/>` | `{ formula: "...", result: undefined }` |
| Error | `t="e"` `<v>#VALUE!</v>` | `{ error: "#VALUE!" }` |
| Texto enriquecido | — | `{ richText: [{ text }] }` |

Normalizador recomendado:

```ts
function valor(v: unknown): string | number | null {
  if (v === null || v === undefined) return null;
  if (typeof v === "object") {
    const o = v as Record<string, unknown>;
    if ("error" in o) return null;                       // #VALUE! decorativo
    if ("formula" in o || "sharedFormula" in o) {
      const r = o.result;
      if (r === undefined || r === "") return null;      // línea vacía
      if (typeof r === "object") return null;            // {error} anidado
      return r as string | number;
    }
    if ("richText" in o)
      return (o.richText as { text: string }[]).map((t) => t.text).join("");
  }
  return v as string | number;
}
```

**Detección de línea vacía:** `valor(B<r>) === null`. Las filas no usadas de cada
sección sí existen en el XML, con fórmula y `<v/>` vacío. No basta con `!== undefined`.

### 6.4 Seis ítems con código **numérico** en lugar de texto ⚠️

En los 7 libros, exactamente estos ítems:

| Nombre de hoja | `ÍNDICE!E<r>` | `B33` | Fila del índice |
| -------------- | ------------- | ----- | --------------- |
| `730,4` | `730.4` (`t="n"`) | `730.4` (número) | 454 |
| `730,5` | `730.5` | `730.5` | 455 |
| `730,6` | `730.6` | `730.6` | 456 |
| `730,7` | `730.7` | `730.7` | 457 |
| `730,8` | `730.8` | `730.8` | 458 |
| `731,1` | `731.1` | `731.1` | 459 |

Los otros 520 son cadenas con **coma** (`"200,1,1"`, `t="str"`). Los seis anómalos
están guardados como **número con punto decimal**, mientras el nombre de la hoja
conserva la coma.

- Buscar la hoja por el valor de `ÍNDICE!E` **falla** para estos seis.
- No son ítems rotos: sus APU están completos (`730,4` en Arauca → costo directo
  `534 210.28`). Es solo un problema de tipado de la celda.

Normaliza siempre antes de comparar:

```ts
const normCodigo = (v: string | number | null): string | null => {
  if (v === null) return null;
  return String(v).trim().replace(/\./g, ",");   // 730.4 -> "730,4"
};
```

Y **usa el nombre de la hoja como identidad canónica**, no `B33` ni `ÍNDICE!E`.

### 6.5 Ítems presentes pero en cero

`650,5` y `650,9` («TRANSPORTE MARÍTIMO Y/O FLUVIAL DE ESTRUCTURA METÁLICA» y
similar) tienen **costo directo `0`** en provincias sin acceso marítimo/fluvial
(Valle de Aburrá, Nariño Costa) y valor real en otras (Arauca: `13.65`).

No es un fallo de parseo: la hoja existe, las fórmulas están, los insumos no aplican.
El parser debe emitirlos con `costoDirecto: 0` y la UI debe distinguir «no aplica en
esta región» de «no hay dato». **Nunca** presentar un `0` como precio.

Ningún ítem tuvo `N101` no numérico en los 7 libros; solo esos dos llegan a cero.

### 6.6 Secciones vacías (lo normal, no la excepción)

Sobre 526 ítems, en **todos** los libros:

| Sección | Ítems sin ninguna línea |
| ------- | ----------------------- |
| EQUIPO (excl. herramienta menor) | **100** |
| MATERIALES | **17** |
| TRANSPORTE | **203** |
| MANO DE OBRA | **51** |

El subtotal de una sección vacía es `0` (no vacío), porque la fórmula es
`ROUND(SUM(rango),2)`. Un APU sin transporte es perfectamente válido.

Máximo de líneas realmente usadas (frente a la capacidad del formato): equipo 9/14,
materiales 16/16, transporte 2/5, mano de obra 4/10. **Materiales llega al tope de
16**: si INVIAS añade un material en una vigencia futura tendrá que cambiar el
layout. Merece una aserción.

### 6.7 Celdas combinadas

153 merges por hoja de ítem. Regla: **el valor vive solo en la celda superior
izquierda**; las demás devuelven `null`.

- Descripción del ítem: `C33:J33` → leer `C33`.
- Unidad del ítem: `L33:M33` → leer `L33`.
- Descripción de línea: `C<r>:I<r>` (equipo/materiales) o `C<r>:H<r>` (transporte/MO).
- Rendimiento / precio unit.: `L<r>:M<r>` → leer `L<r>`.
- Etiquetas de subtotal: `B<r>:M<r>`; el valor va aparte en `N<r>`.

En `LISTADO DE PROVINCIAS` los merges son **verticales** y sí requieren forward fill.

### 6.8 Ruido numérico en los valores cacheados

Aunque las fórmulas terminan en `ROUND(...,2)`, el valor **cacheado** es un `double`:

```
N53  -> 5792090.8600000003
K52  -> 547434.55000000005
L300 (ÍNDICE, costo directo) -> 526956.44999999995
```

Nunca compares con `===`. Redondea a 2 decimales o usa tolerancia (§7).

### 6.9 Texto: CRLF y unidades sucias

- Las descripciones traen **`\r\n`** (CRLF, no `\n`). Convención: la primera línea
  es el título del ítem; lo que sigue, entre paréntesis, delimita el alcance del
  análisis. Conviene separarlos en `titulo` y `alcance`.
- Las unidades **no están normalizadas**. 14 variantes distintas en `ÍNDICE!G`:

  ```
  ha  m2  m  kg  u  m3  Kg  L  m³  tf-m  kg-km  m3 - E  m3 - Km  m3 - km
  ```

  Hay que canonicalizar: `Kg`→`kg`, `m³`→`m3`, `m3 - Km`/`m3 - km`/`m3 - E`→`m3-km`.
  **Guarda también el valor crudo**, para poder mostrar procedencia fiel.
- Hay dobles espacios en encabezados y etiquetas (`"ÍNDICE DE ÍTEMS  DE…"`,
  `"GRUPO DE AJUSTE "`, `"IMPREVISTOS "`). Compara siempre con `.trim()` y colapsando
  espacios.

### 6.10 Celdas de error decorativas

`#VALUE!` aparece de forma estable y benigna en `N1` de cada hoja de ítem, en `F1`/`H1`
de las hojas de insumo y en `PORTADA!I4`. Vienen de fórmulas que referencian imágenes.
Ignóralas; no indican corrupción.

### 6.11 Lo que **no** varía entre libros

Verificado en los 7: número de hojas (544), nombres y orden de hojas, número de
ítems (526), filas del índice (5–530), todas las coordenadas de sección, los 6
códigos numéricos, y los conteos de secciones vacías. Un parser puede afirmar todo
esto y fallar ruidosamente si un libro futuro se desvía.

---

## 7. Verificación aritmética

Comprobado línea a línea sobre `APU_8100_ARAUCA__ARAUCA` (y los subtotales sobre los
526 ítems × 7 libros).

### Ítem `200,1,1` — «DESMONTE Y LIMPIEZA EN BOSQUE», unidad `ha`

```
I. EQUIPO           (rendimiento × tarifa)
  r38 C0010052   tarifa 277 595.37932   rend 8      -> 2 220 763.03
  r39 C0010140   tarifa 271 673.438925  rend 8      -> 2 173 387.51
  r40 C0010620   tarifa  11 422.076666  rend 8      ->    91 376.61
  r41 C0010015   tarifa 150 173.524085  rend 8      -> 1 201 388.19
  r42 C0010190   tarifa   9 725.473333  rend 8      ->    77 803.79
  r52 HERMENINV  base   547 434.55      5 %         ->    27 371.73
                                        Σ líneas = 5 792 090.86
  N53 = 5 792 090.86                              Δ = 0            ✓

II. MATERIALES      (cantidad × precio)
  r58 B0013791   400 m3 × 7 433.959551             -> 2 973 583.82
  N74 = 2 973 583.82                              Δ = 0            ✓

III. TRANSPORTES    ((cantidad × distancia) × tarifa)
  r79 T0010032   400 m3-km × 1 × 1 869.80          ->   747 920.00
  N84 = 747 920                                   Δ = 0            ✓

IV. MANO DE OBRA    (jornal × prestaciones ÷ rendimiento)
  r89 A0030040   233 454 × 2.05181849 ÷ 0.875      ->   547 434.55
  N99 = 547 434.55                                Δ = 0            ✓

TOTAL COSTO DIRECTO
  N101 = 10 061 029.23
  N53 + N74 + N84 + N99 = 10 061 029.23           Δ = 0            ✓
  ÍNDICE!L (misma fila)  = 10 061 029.23          Δ = 0            ✓
```

Nótese el bucle: `N52` (herramienta menor) depende de `N99` (mano de obra), que se
calcula más abajo. Al reconstruir desde insumos hay que resolver mano de obra
**antes** que herramienta menor.

### Ítem `630,1,1` — «TIPO DE CONCRETO ______», unidad `m3`

```
I. EQUIPO         3 líneas + herramienta menor (4 147.26 = 5 % de 82 945.11)
  N53  =     11 154.78   Σ líneas =     11 154.78            Δ = 0                    ✓
II. MATERIALES    2 líneas (concreto 1.05 m3 × 382 028.60; acero 1 kg × 12 898.33)
  N74  =    414 028.36   Σ líneas =    414 028.36            Δ = 5.8e-11  ← float     ✓
III. TRANSPORTES  1 línea (1.05 m3-km × 1 × 1 615.61)
  N84  =      1 696.39   Σ líneas =      1 696.39            Δ = 0                    ✓
IV. MANO DE OBRA  2 líneas (Obrero (6) + otro, rendimiento 13.3 m3/día)
  N99  =     82 945.11   Σ líneas =     82 945.11            Δ = 0                    ✓
TOTAL
  N101 =    509 824.64   Σ subtotales = 509 824.64           Δ = 0                    ✓
```

### Tolerancia recomendada

- **Σ líneas vs. subtotal de sección:** desviación máxima observada **5.8 × 10⁻¹¹**
  (ruido IEEE-754 puro; los propios valores de línea ya vienen redondeados a 2
  decimales por la hoja). Tolerancia segura: **0.005**.
- **Σ subtotales vs. `N101`:** exacta en los 526 × 7 ítems. Tolerancia **0.011**
  (holgura para cuatro subtotales redondeados a 2 decimales).
- **`N101` vs. `ÍNDICE!L`:** exacta en los 526 × 7 (`0` desviaciones), ya que el
  índice hace `INDIRECT` a la misma celda.

Estrategia sugerida: `Math.abs(a - b) <= 0.011`, o comparar
`Math.round(x * 100) / 100`. **No** re-derives el costo directo sumando líneas y lo
publiques: publica `N101`, y usa la suma solo como *aserción de integridad*.

---

## 8. Recomendaciones para el parser

1. **Identidad canónica del ítem = nombre de la hoja** (`"200,1,1"`). `B33` y
   `ÍNDICE!E` sirven de verificación cruzada, pero fallan en los 6 ítems numéricos.
2. **Lee el `ÍNDICE` primero**: da los 526 códigos, descripción, unidad, los cuatro
   subtotales y el costo directo — suficiente para la vista de listado, con **una
   sola hoja leída**. Las hojas de ítem solo hacen falta para el desglose.
3. **No evalúes fórmulas.** Usa siempre el resultado cacheado.
4. **Coordenadas fijas + aserciones.** Verifica que `B35 === "I. EQUIPO"`,
   `B101 === "TOTAL COSTO DIRECTO $"`, `N109` y `N111` vacías, y que el índice tiene
   526 filas. Si algo falla, aborta con un error que nombre la hoja y la celda: es
   la señal de que INVIAS cambió el formato.
5. **Memoria**: un libro a la vez. Para el pipeline de `scripts/`, considera leer el
   XML crudo del zip en lugar de exceljs (§6.1).
6. **Procedencia por número**: cada valor emitido debe arrastrar `fuente` (INVIAS),
   `vigencia` (`2026-1`, publicada «Julio de 2025», calculada sobre el SMLMV 2025),
   `departamento`/`provincia` (de `PORTADA!D24`/`F24`), y la advertencia de que es
   **costo directo sin AIU**.
7. **Nunca emitas un campo de AIU o de precio total**: el libro los trae vacíos a
   propósito (§3.5).
8. **Transporte**: la distancia es siempre `1`; el valor es por unidad-kilómetro.
   Etiquétalo así en la UI.
9. **Herramienta menor**: márcala aparte dentro de EQUIPO; su «cantidad» es un
   porcentaje (5 %) sobre el subtotal de mano de obra, no un rendimiento.
10. **Mano de obra**: `PRESTACIONES (%)` es un factor (~2.05), y el valor unitario
    **divide** por el rendimiento. Es la sección donde más fácil se cuela un error.
11. **`LISTADO DE PROVINCIAS`** es la fuente para el mapa municipio DANE → provincia
    → libro, y por tanto para las URL del explorador. `Código Provincia` coincide con
    el código de 4 dígitos del nombre de archivo.
12. **Bogotá D.C. figura en `LISTADO DE PROVINCIAS` (código `1100`, municipio
    `11001`) pero no tiene libro.** No hay `APU_1100_*.xlsx` entre los 140. Al
    construir el mapa municipio → libro hay que dejarla explícitamente sin precio y
    apuntar al IDU (no-negociable #5), en vez de omitirla en silencio.
