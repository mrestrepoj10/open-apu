# BACKLOG

Fuera del alcance de v0. Nada de esto entra al código hasta que se decida
explícitamente (no negociable 7: los bloques se mantienen de un solo propósito).
Una línea por asunto, con el contexto suficiente para retomarlo en frío.

## Superficies nuevas

- **CLI** — `apu <codigo> <provincia>` sobre `lib/data`. El explorador web ya
  cubre el caso «consultar un precio»; el CLI es para scripts y presupuestos.
- **Servidor MCP** — exponer catálogo + desglose como herramientas MCP. Depende
  de que el esquema de `lib/schema/` se considere estable.
- **Consola DuckDB-WASM** — SQL sobre `data/parquet/` desde el navegador, para
  quien quiera cruzar los 74 k pares ítem × provincia sin descargar nada.
- **Drop-zone de parseo en el navegador** — el usuario suelta su propio .xlsx de
  INVIAS y ve el APU. El parser YA es browser-safe (raw OOXML con `fflate`, sin
  `node:*`, ver `lib/parser/FORMATO.md`): falta solo la UI y un worker.
- **Calculadora de presupuesto** — cantidades × APU, con AIU explícito y aparte.
  Ojo con el no negociable 2: el AIU nunca se mezcla con el costo directo.
- **Diffs entre vigencias** — qué subió y cuánto entre 2026-1 y 2026-2. Necesita
  ≥2 vigencias publicadas y `data/json/<vigencia>/` en paralelo.
- **i18n EN** — el sitio es Spanish-first a propósito. Traducir solo si aparece
  demanda real; duplica 74 k URLs.

## Datos

- **Datasets departamentales (CC BY-SA)** — datos abiertos de gobernaciones,
  otro parser (CSV) y otra licencia; no mezclar con el árbol INVIAS.
- **Derecho de petición a INVIAS** — pendiente de respuesta; pediría los APU en
  formato abierto y aclarar el aviso legal de uso comercial.
- **Matriz nacional de insumos** — las hojas ocultas `INSUMO_*` de un solo libro
  traen las 140 provincias. Publicarla evitaría parsear los 140 .xlsx para
  responder «¿cuánto vale el cemento en cada región?».
- **Reportar a INVIAS los insumos sin resolver** — 801.1 y 801.2 referencian
  `B0033052` / `B0033053` / `B0033054`, códigos que no existen en el listado
  regional. Hoy se omiten del desglose y se explica en `notaFuente`.
- **Huella de `data/samples/sample-provincia.xlsx`** — 384 kB commiteados para
  que las pruebas corran offline (no negociable 6). Decidir si se recorta más o
  se sustituye por un fixture sintético.

## Infraestructura

- **Despliegue en Vercel + dominio real** — falta el proyecto de Vercel y fijar
  `NEXT_PUBLIC_SITE_URL` (hay un TODO en `lib/site.ts`; el valor por defecto es
  `https://apu-stack.vercel.app`).
- **README.md** — sigue siendo la plantilla de Next.js. Reescribirlo para el
  proyecto (qué es, cómo correr el pipeline, licencias de código y de datos).
- **Higiene de View Transitions en `globals.css`** — con prefetch parcial las
  navegaciones entre ítem, hub y desglose ya son suaves (soft nav), así que
  activar transiciones de vista tiene sentido por primera vez. Antes hay que
  poner las reglas defensivas de `next-beats` (`view-transition-name` único,
  `::view-transition-*` sin animar lo que cambia de tamaño): sin ellas una tabla
  de 526 filas parpadea. Opcional, puramente estético.
- **404 real en las rutas con `params`** — con el corte params-bajo-Suspense un
  código o slug inexistente responde 200 + `noindex` (el shell ya empezó a
  transmitirse cuando `notFound()` dispara). Para un 404 de verdad habría que
  comprobar existencia antes del render, en `proxy.ts`, con ~50 kB de índice en
  el borde. Medir si vale la pena: el `noindex` ya protege el índice de búsqueda.
- **TanStack Charts** — veredicto del spike (2026-08-04, rama
  `spike/009-tanstack-charts`): **adoptar cuando corte beta/pre-1.0**. Medido en
  este repo: la misma gráfica pasa de 100,7 a 22,6 KiB gz (~5,5×), el SSR
  completo funciona (SVG determinista en el HTML inicial) y declara React 19;
  los docs SSR van dentro del paquete npm aunque la web no los muestre. Sigue
  siendo pre-alpha declarado («API may change between releases»). Los gráficos
  actuales van sobre shadcn/recharts con APIs agnósticas de librería: la
  migración es por componente.
- **TypeScript 7** — bloqueado aguas arriba (2026-08-04). El typecheck nativo
  funciona y es ~6× más rápido (exige `"types": ["bun", "node"]` en tsconfig),
  pero (a) typescript-eslint no soporta TS 7 aún
  (typescript-eslint/typescript-eslint#10940) y (b) bun 1.3.3 resuelve mal el
  alias anidado del patrón side-by-side oficial de Microsoft — con npm el mismo
  package.json funciona, así que es bug de bun (reportable a oven-sh/bun).
  Retomar cuando caiga cualquiera de los dos; la subida preparada vive en la
  rama `advisor/010-typescript-7` (commit `a9137f8`).
