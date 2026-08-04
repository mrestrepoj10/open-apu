# BACKLOG

Fuera del alcance de v0. Nada de esto entra al código hasta que se decida
explícitamente (no negociable 7: los bloques se mantienen de un solo propósito).
Una línea por asunto, con el contexto suficiente para retomarlo en frío.

## Superficies nuevas

- **CLI** — `apu <codigo> <provincia>` sobre `lib/data`. El explorador web ya
  cubre el caso «consultar un precio»; el CLI es para scripts y presupuestos.
- **Servidor MCP** — exponer catálogo + desglose como herramientas MCP. Depende
  de que el esquema de `lib/schema/` se considere estable.
- **Página de búsqueda** — hoy no hay `/buscar` ni índice: se navega por
  capítulo. Un índice estático (526 ítems, ~60 kB) alcanza; falta decidir si va
  client-side o con params.
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

## Rendimiento

- **Recortar el payload RSC de las páginas de 526 filas** — el HTML está bien; lo
  que pesa es el flight data de hidratación que Next embebe: `/items` ~305 kB
  crudos / 39 kB gzip, los hubs hasta ~438 kB / 45 kB. Opciones evaluadas:
  serializar el `<tbody>` con `dangerouslySetInnerHTML` (una sola cadena en vez
  de 526 × 4 nodos) o quitar `ThemeProvider` del árbol de esas rutas.
- **Prerenderizar los 526 × 140 desgloses** — hoy son 30 destacados × 140 y el
  resto sale por ISR. El build hace 4.909 páginas en ~26 s, así que 74 k
  extrapola a ~7 min: viable, pero hay que medir el tamaño del artefacto de
  despliegue antes.

## Infraestructura

- **Despliegue en Vercel + dominio real** — falta `vercel.json`/proyecto y fijar
  `NEXT_PUBLIC_SITE_URL` (hay un TODO en `lib/site.ts`; el valor por defecto es
  `https://apu-stack.vercel.app`).
- **README.md** — sigue siendo la plantilla de Next.js. Reescribirlo para el
  proyecto (qué es, cómo correr el pipeline, licencias de código y de datos).
- **TanStack Charts** — sustituto candidato de recharts (~349 kB de chunk, hoy
  cargado solo en páginas de ítem y desglose). Está en pre-alpha: reevaluar
  cuando estabilice.
