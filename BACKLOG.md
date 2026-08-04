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

## Rendimiento

- **Recortar el payload RSC de las páginas de 526 filas** — el HTML está bien; lo
  que pesa es el flight data de hidratación que Next embebe: `/items` ~305 kB
  crudos / 39 kB gzip, los hubs hasta ~438 kB / 45 kB. Opciones evaluadas:
  serializar el `<tbody>` con `dangerouslySetInnerHTML` (una sola cadena en vez
  de 526 × 4 nodos) o quitar `ThemeProvider` del árbol de esas rutas.
- **Prerenderizar los 526 × 140 desgloses** — *degradado a improbable.* Era por
  la latencia de la primera visita a una URL de la cola larga; con el shell de
  16.3 esa visita ya pinta la página en 5 ms (medido en `next start`: TTFB 4,6
  ms de esqueleto, contenido completo a los 45 ms) y la segunda ya sale de
  disco en 3 ms. Prerrenderizar 74 k páginas costaría ~7 min de build y un
  artefacto mucho mayor para ganar ~40 ms una sola vez por URL. Se mantiene el
  apunte por si el artefacto de despliegue cambia de forma, no como pendiente.

- **404 real en las rutas con `params`** — desde el corte params-bajo-Suspense
  (16.3, prefetch parcial) un código o slug inexistente responde 200 con el
  cuerpo del 404 y `<meta name="robots" content="noindex">`: el shell ya empezó
  a transmitirse cuando `notFound()` dispara, y el estado no se puede cambiar
  a mitad de flujo. Lo documenta Next (`04-functions/not-found.md`, «Calling
  `notFound()` after streaming has started»). Para devolver un 404 de verdad
  hay que comprobar la existencia **antes** del render, en `proxy.ts`, con la
  lista de códigos y slugs; son ~50 kB de índice en el borde. Medir si vale la
  pena: el `noindex` ya evita que un soft 404 entre al índice de búsqueda.

## Infraestructura

- **Despliegue en Vercel + dominio real** — falta `vercel.json`/proyecto y fijar
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

- **`<Link>` con prefetch al pasar el ratón** — el patrón `NavLink` de
  `next-beats`: envolver `Link` con `prefetch={false}` y activarlo en
  `onMouseEnter`. Hoy NO hace falta: con prefetch parcial las tablas piden un
  shell por ruta (14 peticiones / 85 kB en una vista completa), no uno por
  enlace. Retomarlo solo si esos shells llegan a medirse como un problema.

- **TanStack Charts** — sustituto candidato de recharts (~349 kB de chunk hoy).
  A 2026-08-03: v0.6.x, los docs se declaran "pre-alpha … API may change
  between releases"; SVG, ~27–32 KiB fríos según su web, sin guía SSR/Next.
  Spike de evaluación: plans/009. Mientras tanto los gráficos nuevos van sobre
  shadcn/recharts con APIs agnósticas de librería para poder migrar barato.
