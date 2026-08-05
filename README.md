# Explorador APU

**Los precios unitarios de referencia de INVIAS, abiertos, navegables y con
procedencia en cada número.**

🔗 <https://apu-stack.vercel.app>

Los APU (Análisis de Precios Unitarios) son la unidad atómica del presupuesto
de construcción en Colombia. INVIAS publica APU regionalizados de referencia
—140 libros `.xlsx`, uno por dirección territorial— pero nada de eso es legible
por máquina ni consultable sin abrir un libro de 500 hojas. Este repositorio
arregla eso: **dato → esquema → parsers → un explorador web público**.

## Qué encuentras

Para la vigencia **2026-1**: 526 ítems de pago × 140 provincias = **73.640 APU**
con **619.920 líneas de desglose** (equipo, materiales, transporte y mano de
obra, en el formato FR-APU-1).

- Una página por **ítem** (precio en las 140 provincias, mapa, curva de
  dispersión) y por **ítem × provincia** (el desglose completo del APU).
- Un hub por **provincia** con sus 526 ítems y su posición nacional.
- **Búsqueda, filtro y orden** en las tablas, y gráficos interactivos como
  contenido de primera clase — los números clave viven siempre también en el
  HTML del servidor.

## La honestidad del dato

Estas reglas no son adorno; gobiernan cada página y cada agregado:

- **Todo número lleva procedencia**: fuente, vigencia y licencia, visibles.
- Los valores son **costo directo de referencia**: sin AIU (administración,
  imprevistos, utilidad) y sin IVA. **No son precios de mercado** y nunca se
  presentan como tales.
- Un costo en **0 significa «no aplica»** en esa región (así lo publica la
  fuente), nunca «cuesta cero»: se rotula, no se formatea como precio.
- **Bogotá D.C. está fuera del alcance INVIAS**: se representa honestamente,
  con un puntero al IDU, que es quien publica sus precios de referencia.
- El catálogo **mezcla unidades** (COP/m3, COP/kg-km…): entre ítems solo se
  comparan medidas sin unidad (participaciones, razones, conteos).

## Cómo está hecho

La cadena completa, de la fuente a la página — cada eslabón está en el repo
salvo el primero:

1. **Archivo fuente** — los 140 libros `.xlsx` (~1,9 GB) **no se
   redistribuyen**: cada quien los descarga a mano del portal oficial. Solo se
   versiona `data/archivo/manifest.json` (nombres, tamaños, sha256).
2. **`lib/parser/`** — lector del formato FR-APU-1 sobre OOXML crudo
   (`fflate`), compatible con navegador; `lib/parser/FORMATO.md` documenta el
   formato y `__goldens__/` fija la salida contra los valores del propio libro.
3. **`scripts/pipeline.ts`** — parsea los 140 libros, valida con `zod`, carga
   en DuckDB y emite los artefactos estáticos versionados: parquet (~4 MB) y
   JSON (~30 MB), ambos en el repo. Sin base de datos, sin backend.
4. **`lib/data/`** — lectores cacheados sobre el JSON, y consultas puntuales al
   parquet con `hyparquet` para el desglose.
5. **La web** — Next.js (App Router, estático primero + ISR), TypeScript de
   punta a punta, Bun como runtime y gestor de paquetes.

## Desarrollo

Requisitos: [Bun](https://bun.sh).

```bash
bun install
bun run dev        # el explorador, con el dato ya versionado en data/
bun test           # todo corre offline: los fixtures viven en data/samples/
bun run build      # el sitio completo, prerrenderizado
```

Para regenerar el dato desde la fuente (opcional; los artefactos ya están
versionados): descarga los libros de la vigencia desde el
[portal de INVIAS](https://www.invias.gov.co/publicaciones/4149/analisis-de-precios-unitarios-apu-regionalizados-de-referencia/)
a `data/archivo/<vigencia>/`, y luego:

```bash
bun scripts/manifest.ts   # regenera el manifiesto (nombres, tamaños, sha256)
bun run pipeline          # xlsx → NDJSON → DuckDB → parquet + JSON
```

**Nada de scraping**: la descarga es manual a propósito, por respeto al portal
oficial. No hay automatización contra los servidores de INVIAS y no la habrá.

## Principios

- Tecnología aburrida, dependencias pequeñas, todo probable offline.
- Los bloques hacen una sola cosa; lo que se salga del objetivo no entra al
  código.
- Los parsers funcionan en el navegador: cualquiera puede verificar un libro
  fuente sin instalar nada.

`AGENTS.md` es la guía de arquitectura para quien quiera contribuir; issues y
PRs son bienvenidos.

## Licencias

- **El código es MIT** (ver [LICENSE](LICENSE)).
- **El dato derivado** conserva su procedencia y el aviso legal de INVIAS: son
  datos oficiales de referencia y su uso comercial o con ánimo de lucro
  requiere autorización previa de la fuente. Cada directorio de datos lleva su
  nota de procedencia.
- **Los libros `.xlsx` originales no se redistribuyen** en este repositorio.
